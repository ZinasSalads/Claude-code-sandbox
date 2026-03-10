"""Science & Research Engine — PubMed sweep, relevance grading.

Uses NCBI E-utilities to search PubMed for articles relevant to the user's
health profile, supplements, and biomarkers. Claude grades relevance.
"""

import json
import logging
from datetime import date, timedelta
from typing import Optional
from xml.etree import ElementTree

import anthropic
import httpx

from config import ANTHROPIC_API_KEY, PUBMED_EMAIL, supabase

logger = logging.getLogger("concierge.research")

MODEL = "claude-sonnet-4-20250514"

RELEVANCE_PROMPT = """You are a medical research analyst. Given the user's health profile and a list of PubMed article abstracts, rate each article's relevance and provide a brief explanation.

USER PROFILE:
{profile}

ARTICLES:
{articles}

For each article, return:
- pubmed_id: the PMID
- relevance_score: 0.0 to 1.0 (1.0 = highly relevant to this user's specific situation)
- relevance_reasons: 1-2 sentences explaining why this is relevant to this user
- evidence_grade: "high" (RCT, meta-analysis), "moderate" (cohort, case-control), "low" (case report, opinion), "unknown"
- domains: list of health domains this applies to (e.g., ["cardiovascular", "nutrition", "supplementation"])
- study_type: type of study (e.g., "meta-analysis", "RCT", "review", "cohort", "case study")

Return ONLY valid JSON array (no markdown fences):
[{{"pubmed_id": "", "relevance_score": 0.0, "relevance_reasons": "", "evidence_grade": "", "domains": [], "study_type": ""}}]"""


class ResearchService:
    """PubMed research sweep and relevance grading."""

    def _build_search_queries(self, profile_context: str) -> list[str]:
        """Generate PubMed search queries from user profile."""
        base_queries = [
            "longevity AND exercise AND biomarkers",
            "HRV AND recovery AND training",
            "sleep optimization AND health outcomes",
        ]

        # Add profile-aware queries
        dynamic_queries = []

        keywords = {
            "supplement": "supplementation AND health outcomes",
            "vitamin d": "vitamin D AND optimal levels AND health",
            "omega": "omega-3 AND cardiovascular AND longevity",
            "creatine": "creatine AND exercise AND cognitive",
            "magnesium": "magnesium AND sleep AND recovery",
            "glucose": "glucose regulation AND longevity",
            "cholesterol": "LDL AND cardiovascular AND mortality risk",
            "ApoB": "apolipoprotein B AND cardiovascular risk",
            "HbA1c": "HbA1c AND all-cause mortality",
            "strength training": "resistance training AND longevity AND muscle",
            "zone 2": "zone 2 training AND mitochondrial AND aerobic",
            "fasting": "intermittent fasting AND metabolic health",
            "protein": "protein intake AND muscle preservation AND aging",
        }

        profile_lower = profile_context.lower()
        for keyword, query in keywords.items():
            if keyword.lower() in profile_lower:
                dynamic_queries.append(query)

        return base_queries + dynamic_queries[:5]  # Cap at 8 total queries

    async def sweep(self, profile_context: Optional[str] = None) -> dict:
        """Run a research sweep: search PubMed, grade relevance, store results."""
        if not profile_context:
            profile_context = "General health optimization, longevity, fitness"

        queries = self._build_search_queries(profile_context)
        all_articles = []
        seen_pmids = set()

        for query in queries:
            articles = await self._search_pubmed(query, max_results=5)
            for a in articles:
                if a["pmid"] not in seen_pmids:
                    seen_pmids.add(a["pmid"])
                    all_articles.append(a)

        if not all_articles:
            return {"articles": [], "message": "No articles found"}

        # Grade relevance with Claude
        graded = await self._grade_relevance(all_articles, profile_context)

        # Store results
        saved = 0
        for article in graded:
            if await self._save_article(article):
                saved += 1

        # Sort by relevance
        graded.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)

        return {
            "sweep_date": date.today().isoformat(),
            "queries_run": len(queries),
            "articles_found": len(all_articles),
            "articles_saved": saved,
            "articles": graded[:20],  # Top 20
        }

    async def _search_pubmed(self, query: str, max_results: int = 5) -> list[dict]:
        """Search PubMed via E-utilities."""
        try:
            params = {
                "db": "pubmed",
                "term": query,
                "retmax": max_results,
                "sort": "relevance",
                "retmode": "json",
            }
            if PUBMED_EMAIL:
                params["email"] = PUBMED_EMAIL

            async with httpx.AsyncClient(timeout=15) as client:
                # Search
                search_resp = await client.get(
                    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                    params=params,
                )
                if search_resp.status_code != 200:
                    return []

                search_data = search_resp.json()
                pmids = search_data.get("esearchresult", {}).get("idlist", [])
                if not pmids:
                    return []

                # Fetch details
                fetch_resp = await client.get(
                    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
                    params={
                        "db": "pubmed",
                        "id": ",".join(pmids),
                        "retmode": "xml",
                    },
                )
                if fetch_resp.status_code != 200:
                    return []

                return self._parse_pubmed_xml(fetch_resp.text)

        except Exception as e:
            logger.error(f"PubMed search error for '{query}': {e}")
            return []

    def _parse_pubmed_xml(self, xml_text: str) -> list[dict]:
        """Parse PubMed XML response into article dicts."""
        articles = []
        try:
            root = ElementTree.fromstring(xml_text)
            for article_el in root.findall(".//PubmedArticle"):
                medline = article_el.find(".//MedlineCitation")
                if medline is None:
                    continue

                pmid_el = medline.find("PMID")
                pmid = pmid_el.text if pmid_el is not None else ""

                article = medline.find(".//Article")
                if article is None:
                    continue

                title_el = article.find("ArticleTitle")
                title = title_el.text if title_el is not None else ""

                abstract_el = article.find(".//AbstractText")
                abstract = abstract_el.text if abstract_el is not None else ""

                journal_el = article.find(".//Journal/Title")
                journal = journal_el.text if journal_el is not None else ""

                # Authors
                author_list = article.findall(".//Author")
                authors = []
                for auth in author_list[:5]:
                    last = auth.find("LastName")
                    first = auth.find("ForeName")
                    if last is not None:
                        name = last.text
                        if first is not None:
                            name = f"{last.text} {first.text[0]}"
                        authors.append(name)
                if len(author_list) > 5:
                    authors.append("et al.")

                # Date
                pub_date_el = article.find(".//PubDate")
                pub_date = ""
                if pub_date_el is not None:
                    year = pub_date_el.find("Year")
                    month = pub_date_el.find("Month")
                    if year is not None:
                        pub_date = year.text
                        if month is not None:
                            pub_date = f"{year.text}-{month.text}"

                articles.append({
                    "pmid": pmid,
                    "title": title,
                    "abstract": abstract or "",
                    "journal": journal,
                    "authors": ", ".join(authors),
                    "publication_date": pub_date,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                })
        except Exception as e:
            logger.error(f"XML parse error: {e}")
        return articles

    async def _grade_relevance(self, articles: list[dict], profile: str) -> list[dict]:
        """Use Claude to grade article relevance to user."""
        if not ANTHROPIC_API_KEY:
            # Return with default scores
            for a in articles:
                a["relevance_score"] = 0.5
                a["relevance_reasons"] = "Relevance grading unavailable (no API key)"
                a["evidence_grade"] = "unknown"
                a["domains"] = []
                a["study_type"] = "unknown"
            return articles

        # Format articles for Claude
        articles_text = "\n\n".join(
            f"PMID: {a['pmid']}\nTitle: {a['title']}\nJournal: {a['journal']}\nAbstract: {a['abstract'][:500]}"
            for a in articles
        )

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        try:
            response = client.messages.create(
                model=MODEL,
                max_tokens=3000,
                messages=[
                    {
                        "role": "user",
                        "content": RELEVANCE_PROMPT.format(
                            profile=profile[:2000], articles=articles_text[:6000]
                        ),
                    }
                ],
            )
            raw = response.content[0].text.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            grades = json.loads(raw)

            # Merge grades back into articles
            grade_map = {g["pubmed_id"]: g for g in grades}
            for a in articles:
                g = grade_map.get(a["pmid"], {})
                a["relevance_score"] = g.get("relevance_score", 0.5)
                a["relevance_reasons"] = g.get("relevance_reasons", "")
                a["evidence_grade"] = g.get("evidence_grade", "unknown")
                a["domains"] = g.get("domains", [])
                a["study_type"] = g.get("study_type", "unknown")

        except Exception as e:
            logger.error(f"Relevance grading error: {e}")
            for a in articles:
                a.setdefault("relevance_score", 0.5)
                a.setdefault("relevance_reasons", "")
                a.setdefault("evidence_grade", "unknown")
                a.setdefault("domains", [])
                a.setdefault("study_type", "unknown")

        return articles

    async def _save_article(self, article: dict) -> bool:
        """Save article to research_articles table."""
        if not supabase:
            return False
        try:
            row = {
                "pubmed_id": article["pmid"],
                "title": article["title"],
                "authors": article.get("authors"),
                "journal": article.get("journal"),
                "publication_date": article.get("publication_date") or None,
                "abstract": article.get("abstract"),
                "url": article.get("url"),
                "relevance_score": article.get("relevance_score"),
                "relevance_reasons": article.get("relevance_reasons"),
                "domains": article.get("domains"),
                "evidence_grade": article.get("evidence_grade"),
                "study_type": article.get("study_type"),
                "sweep_date": date.today().isoformat(),
            }
            supabase.table("research_articles").upsert(row, on_conflict="pubmed_id").execute()
            return True
        except Exception as e:
            logger.error(f"Failed to save article {article.get('pmid')}: {e}")
            return False

    async def get_saved_articles(self, limit: int = 20) -> list[dict]:
        """Get saved/relevant articles."""
        if not supabase:
            return []
        try:
            result = (
                supabase.table("research_articles")
                .select("*")
                .eq("dismissed", False)
                .order("relevance_score", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to fetch articles: {e}")
            return []

    async def save_article(self, pubmed_id: str) -> dict:
        """Mark an article as saved/bookmarked."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            result = (
                supabase.table("research_articles")
                .update({"saved": True})
                .eq("pubmed_id", pubmed_id)
                .execute()
            )
            return result.data[0] if result.data else {"error": "Article not found"}
        except Exception as e:
            return {"error": str(e)}

    async def dismiss_article(self, pubmed_id: str) -> dict:
        """Dismiss an article from recommendations."""
        if not supabase:
            return {"error": "Supabase not configured"}
        try:
            result = (
                supabase.table("research_articles")
                .update({"dismissed": True})
                .eq("pubmed_id", pubmed_id)
                .execute()
            )
            return result.data[0] if result.data else {"error": "Article not found"}
        except Exception as e:
            return {"error": str(e)}


research_service = ResearchService()
