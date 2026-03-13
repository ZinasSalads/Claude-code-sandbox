"""Learning & Education service.

Books, courses, language goals, intellectual interests.
Daily learning streaks. Format-matched content delivery based on energy level.
"""

import json
import logging
from datetime import date, timedelta

import anthropic

from config import ANTHROPIC_API_KEY, supabase

logger = logging.getLogger("concierge.learning")

MODEL = "claude-sonnet-4-20250514"


class LearningService:

    async def get_profile(self) -> dict:
        """Get learning profile."""
        if not supabase:
            return {}
        try:
            result = (
                supabase.table("learning_profile")
                .select("*")
                .order("updated_at", desc=True)
                .limit(1)
                .execute()
            )
            return result.data[0] if result.data else {}
        except Exception as e:
            logger.error(f"Failed to get learning profile: {e}")
            return {}

    async def update_profile(self, data: dict) -> dict:
        """Update learning profile."""
        if not supabase:
            return data
        try:
            existing = await self.get_profile()
            if existing.get("id"):
                result = (
                    supabase.table("learning_profile")
                    .update(data)
                    .eq("id", existing["id"])
                    .execute()
                )
                return result.data[0] if result.data else data
            else:
                result = supabase.table("learning_profile").insert(data).execute()
                return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update learning profile: {e}")
            return {"error": str(e)}

    async def log_session(self, data: dict) -> dict:
        """Log a learning session. Updates streak."""
        if not supabase:
            return {"status": "ok"}
        try:
            row = {
                "log_date": data.get("date", date.today().isoformat()),
                "minutes_spent": data.get("minutes_spent", 0),
                "activity_type": data.get("activity_type", "reading"),
                "resource_id": data.get("resource_id"),
                "topic": data.get("topic"),
                "notes": data.get("notes"),
            }
            supabase.table("learning_log").insert(row).execute()

            # Update streak
            profile = await self.get_profile()
            if profile.get("id"):
                target = profile.get("daily_minutes_target", 20)
                if data.get("minutes_spent", 0) >= target:
                    new_streak = (profile.get("current_streak") or 0) + 1
                    longest = max(new_streak, profile.get("longest_streak") or 0)
                    supabase.table("learning_profile").update({
                        "current_streak": new_streak,
                        "longest_streak": longest,
                    }).eq("id", profile["id"]).execute()

                    message = f"{new_streak}-day learning streak!"
                    if new_streak in (7, 14, 21, 30, 60, 90, 365):
                        message = f"Milestone! {new_streak}-day learning streak!"

                    return {"status": "ok", "streak": new_streak, "message": message}

            return {"status": "ok", "message": "Session logged."}
        except Exception as e:
            logger.error(f"Failed to log learning session: {e}")
            return {"error": str(e)}

    async def get_today_recommendation(self) -> dict:
        """What to learn today — energy-matched."""
        recommendation = {
            "type": "reading",
            "resource": None,
            "suggestion": "Read for 20 minutes",
            "energy_match": "any",
            "format_options": ["book", "article", "podcast"],
        }

        if not supabase:
            return recommendation

        try:
            # Check current book
            reading = (
                supabase.table("books")
                .select("*")
                .eq("status", "reading")
                .limit(1)
                .execute()
            )
            if reading.data:
                book = reading.data[0]
                pages_left = (book.get("total_pages") or 300) - (book.get("current_page") or 0)
                recommendation = {
                    "type": "book",
                    "resource": book,
                    "suggestion": f"Continue reading '{book['title']}' — {pages_left} pages to go",
                    "energy_match": "medium",
                    "format_options": ["read", "audiobook"],
                }
                return recommendation

            # Check active courses
            course = (
                supabase.table("courses")
                .select("*")
                .eq("status", "active")
                .limit(1)
                .execute()
            )
            if course.data:
                c = course.data[0]
                recommendation = {
                    "type": "course",
                    "resource": c,
                    "suggestion": f"Continue '{c['title']}' — {c.get('completion_percent', 0)}% done",
                    "energy_match": "high",
                    "format_options": ["video", "practice"],
                }
                return recommendation

            # Check language goals
            profile = await self.get_profile()
            languages = profile.get("languages_learning", [])
            if languages:
                lang = languages[0]
                plan = await self.get_language_plan(lang)
                if plan:
                    recommendation = {
                        "type": "language",
                        "resource": plan,
                        "suggestion": f"Learn {lang} — {plan.get('todays_word', 'vocabulary practice')}",
                        "energy_match": "low",
                        "format_options": ["app", "flashcards"],
                    }
                    return recommendation

            return recommendation
        except Exception as e:
            logger.error(f"Today's recommendation failed: {e}")
            return recommendation

    async def get_books(self, status: str = None) -> list[dict]:
        """Get books filtered by status."""
        if not supabase:
            return []
        try:
            query = supabase.table("books").select("*")
            if status:
                query = query.eq("status", status)
            result = query.order("created_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get books: {e}")
            return []

    async def add_book(self, data: dict) -> dict:
        """Add a book."""
        if not supabase:
            return data
        try:
            result = supabase.table("books").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to add book: {e}")
            return {"error": str(e)}

    async def update_book(self, book_id: str, data: dict) -> dict:
        """Update a book."""
        if not supabase:
            return data
        try:
            # Auto-set dates
            if data.get("status") == "reading" and "started_date" not in data:
                data["started_date"] = date.today().isoformat()
            if data.get("status") == "completed" and "completed_date" not in data:
                data["completed_date"] = date.today().isoformat()

            result = (
                supabase.table("books")
                .update(data)
                .eq("id", book_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update book: {e}")
            return {"error": str(e)}

    async def get_courses(self, status: str = None) -> list[dict]:
        """Get courses filtered by status."""
        if not supabase:
            return []
        try:
            query = supabase.table("courses").select("*")
            if status:
                query = query.eq("status", status)
            result = query.order("created_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Failed to get courses: {e}")
            return []

    async def add_course(self, data: dict) -> dict:
        """Add a course."""
        if not supabase:
            return data
        try:
            result = supabase.table("courses").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to add course: {e}")
            return {"error": str(e)}

    async def update_course(self, course_id: str, data: dict) -> dict:
        """Update a course."""
        if not supabase:
            return data
        try:
            if data.get("status") == "active" and "started_date" not in data:
                data["started_date"] = date.today().isoformat()

            result = (
                supabase.table("courses")
                .update(data)
                .eq("id", course_id)
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            logger.error(f"Failed to update course: {e}")
            return {"error": str(e)}

    async def get_language_plan(self, language: str) -> dict | None:
        """Get language learning plan. If trip upcoming, calculates words/day."""
        profile = await self.get_profile()
        levels = profile.get("language_levels", {})
        level = levels.get(language, "beginner") if isinstance(levels, dict) else "beginner"

        plan = {
            "language": language,
            "level": level,
            "daily_target": 10,  # words per day
            "todays_word": f"Practice {language} today",
        }

        # Check for upcoming trip to country speaking this language
        if supabase:
            try:
                trips = (
                    supabase.table("trips")
                    .select("destination,departure_date")
                    .eq("status", "planning")
                    .order("departure_date")
                    .limit(5)
                    .execute()
                )
                for trip in (trips.data or []):
                    dest = (trip.get("destination") or "").lower()
                    # Simple language-country mapping
                    lang_countries = {
                        "japanese": ["japan", "tokyo", "osaka", "kyoto"],
                        "spanish": ["spain", "mexico", "barcelona", "madrid"],
                        "french": ["france", "paris", "lyon"],
                        "italian": ["italy", "rome", "milan", "florence"],
                        "german": ["germany", "berlin", "munich"],
                        "portuguese": ["portugal", "brazil", "lisbon"],
                        "korean": ["korea", "seoul"],
                        "mandarin": ["china", "beijing", "shanghai", "taiwan"],
                    }
                    countries = lang_countries.get(language.lower(), [])
                    if any(c in dest for c in countries):
                        dep = trip.get("departure_date")
                        if dep:
                            days_to_trip = (date.fromisoformat(dep) - date.today()).days
                            if days_to_trip > 0:
                                words_needed = days_to_trip * 10
                                plan["days_to_trip"] = days_to_trip
                                plan["destination"] = trip["destination"]
                                plan["words_to_go"] = words_needed
                                plan["todays_word"] = f"{language.title()} trip in {days_to_trip} days — learn 10 words today"
                                break
            except Exception:
                pass

        return plan

    async def get_weekly_summary(self) -> dict:
        """Weekly learning summary."""
        profile = await self.get_profile()
        target = profile.get("daily_minutes_target", 20)

        summary = {
            "minutes_this_week": 0,
            "daily_target_met_days": 0,
            "current_streak": profile.get("current_streak", 0),
            "books_completed_this_month": 0,
            "course_progress": [],
        }

        if not supabase:
            return summary

        try:
            week_ago = (date.today() - timedelta(days=7)).isoformat()
            logs = (
                supabase.table("learning_log")
                .select("minutes_spent,log_date")
                .gte("log_date", week_ago)
                .execute()
            )

            if logs.data:
                summary["minutes_this_week"] = sum(l.get("minutes_spent", 0) for l in logs.data)
                # Count days meeting target
                daily_totals: dict[str, int] = {}
                for l in logs.data:
                    d = l.get("log_date", "")
                    daily_totals[d] = daily_totals.get(d, 0) + l.get("minutes_spent", 0)
                summary["daily_target_met_days"] = sum(1 for v in daily_totals.values() if v >= target)

            # Books completed this month
            month_start = date.today().replace(day=1).isoformat()
            books = (
                supabase.table("books")
                .select("id", count="exact")
                .eq("status", "completed")
                .gte("completed_date", month_start)
                .execute()
            )
            summary["books_completed_this_month"] = books.count or 0

            # Active courses
            courses = (
                supabase.table("courses")
                .select("title,completion_percent")
                .eq("status", "active")
                .execute()
            )
            summary["course_progress"] = courses.data or []

            # Generate insight
            if ANTHROPIC_API_KEY and summary["minutes_this_week"] > 0:
                try:
                    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
                    resp = client.messages.create(
                        model=MODEL,
                        max_tokens=80,
                        system="Generate a 1-sentence encouraging learning insight. Warm and specific.",
                        messages=[{"role": "user", "content": json.dumps(summary)}],
                    )
                    summary["top_insight"] = resp.content[0].text.strip()
                except Exception:
                    pass

            return summary
        except Exception as e:
            logger.error(f"Weekly summary failed: {e}")
            return summary


learning_service = LearningService()
