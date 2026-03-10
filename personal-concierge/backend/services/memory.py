"""Memory service — wraps Mem0 with Supabase fallback.

Provides persistent user memory for AI agents. Uses Mem0 when configured,
falls back to Supabase-only storage otherwise.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from config import MEM0_API_KEY, supabase

logger = logging.getLogger("concierge.memory")

USER_ID = "primary_user"

CATEGORIES = ["fitness", "nutrition", "health", "preferences", "lifestyle", "goals", "personal"]

# Try to init Mem0
mem0_client = None
if MEM0_API_KEY:
    try:
        from mem0 import MemoryClient
        mem0_client = MemoryClient(api_key=MEM0_API_KEY)
        logger.info("Mem0 client initialized")
    except Exception as e:
        logger.warning(f"Mem0 init failed: {e}. Falling back to Supabase-only memory.")
else:
    logger.info("MEM0_API_KEY not set — using Supabase-only memory")


async def add_memory(content: str, category: str, source: str = "conversation") -> Optional[str]:
    """Store a memory in Mem0 (if available) and Supabase."""
    mem0_id = None

    # Store in Mem0
    if mem0_client:
        try:
            result = mem0_client.add(
                content,
                user_id=USER_ID,
                metadata={"category": category, "source": source},
            )
            if result and isinstance(result, list) and len(result) > 0:
                mem0_id = result[0].get("id")
        except Exception as e:
            logger.error(f"Mem0 add failed: {e}")

    # Store in Supabase
    if supabase:
        try:
            row = {
                "mem0_id": mem0_id,
                "category": category,
                "content": content,
                "source": source,
                "confidence": 1.0,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            supabase.table("memories").insert(row).execute()
        except Exception as e:
            logger.error(f"Supabase memory insert failed: {e}")

    return mem0_id


async def search_memories(query: str, limit: int = 5) -> list[dict]:
    """Search for relevant memories."""
    # Try Mem0 first
    if mem0_client:
        try:
            results = mem0_client.search(query, user_id=USER_ID, limit=limit)
            if results:
                return [
                    {
                        "content": r.get("memory", r.get("text", "")),
                        "category": r.get("metadata", {}).get("category", "general"),
                        "score": r.get("score", 0),
                    }
                    for r in results
                ]
        except Exception as e:
            logger.error(f"Mem0 search failed: {e}")

    # Fallback: search Supabase with text match
    if supabase:
        try:
            result = (
                supabase.table("memories")
                .select("content, category, confidence")
                .ilike("content", f"%{query}%")
                .limit(limit)
                .order("created_at", desc=True)
                .execute()
            )
            return [
                {
                    "content": r["content"],
                    "category": r["category"],
                    "score": r.get("confidence", 0.5),
                }
                for r in (result.data or [])
            ]
        except Exception as e:
            logger.error(f"Supabase memory search failed: {e}")

    return []


async def get_all_memories(category: Optional[str] = None) -> list[dict]:
    """Get all memories, optionally filtered by category."""
    if supabase:
        try:
            query = supabase.table("memories").select("content, category, source, created_at")
            if category:
                query = query.eq("category", category)
            result = query.order("created_at", desc=True).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Supabase get_all_memories failed: {e}")

    # Mem0 fallback
    if mem0_client:
        try:
            results = mem0_client.get_all(user_id=USER_ID)
            memories = []
            for r in results:
                cat = r.get("metadata", {}).get("category", "general")
                if category and cat != category:
                    continue
                memories.append({
                    "content": r.get("memory", r.get("text", "")),
                    "category": cat,
                    "source": r.get("metadata", {}).get("source", "unknown"),
                })
            return memories
        except Exception as e:
            logger.error(f"Mem0 get_all failed: {e}")

    return []


async def build_user_context() -> str:
    """Build a formatted string of key user facts for AI system prompts."""
    memories = await get_all_memories()

    if not memories:
        return "No user context available yet. This appears to be a new user."

    # Group by category
    by_category: dict[str, list[str]] = {}
    for m in memories:
        cat = m.get("category", "general")
        by_category.setdefault(cat, []).append(m["content"])

    lines = []
    for cat in CATEGORIES:
        items = by_category.get(cat, [])
        if items:
            lines.append(f"\n{cat.upper()}:")
            for item in items[:10]:  # Cap at 10 per category to avoid prompt bloat
                lines.append(f"  - {item}")

    # Include uncategorized
    for cat, items in by_category.items():
        if cat not in CATEGORIES:
            lines.append(f"\n{cat.upper()}:")
            for item in items[:5]:
                lines.append(f"  - {item}")

    return "\n".join(lines) if lines else "No user context available yet."
