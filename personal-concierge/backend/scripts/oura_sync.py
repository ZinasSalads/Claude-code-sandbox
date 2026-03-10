#!/usr/bin/env python3
"""Standalone script to sync Oura Ring data to Supabase.

Usage:
    python scripts/oura_sync.py           # sync last 30 days
    python scripts/oura_sync.py --days 7  # sync last 7 days
"""

import argparse
import asyncio
import json
import logging
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

from config import supabase, OURA_TOKEN
from services.oura import OuraClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("oura_sync")


async def sync(days: int = 30):
    if not OURA_TOKEN:
        print("ERROR: OURA_PERSONAL_ACCESS_TOKEN not set.")
        print("  Get your token from: https://cloud.ouraring.com/personal-access-tokens")
        print("  Add it to .env: OURA_PERSONAL_ACCESS_TOKEN=your_token_here")
        sys.exit(1)

    if not supabase:
        print("ERROR: Supabase not configured.")
        print("  Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
        sys.exit(1)

    client = OuraClient()
    end = date.today()
    start = end - timedelta(days=days)

    print(f"Syncing Oura data from {start} to {end} ({days} days)...")

    data = await client.fetch_all_for_range(start, end)

    if not data:
        print("No data returned from Oura API.")
        return

    upserted = 0

    for day_str, record in data.items():
        row = {k: v for k, v in record.items()}
        row["raw_oura"] = json.dumps(row["raw_oura"]) if row.get("raw_oura") else None

        result = supabase.table("health_data").upsert(
            row,
            on_conflict="date",
        ).execute()

        if result.data:
            upserted += 1

    print(f"\nSync complete!")
    print(f"  Processed {len(data)} days of data.")
    print(f"  Upserted {upserted} records.")


def main():
    parser = argparse.ArgumentParser(description="Sync Oura Ring data to Supabase")
    parser.add_argument("--days", type=int, default=30, help="Number of days to sync (default: 30)")
    args = parser.parse_args()
    asyncio.run(sync(args.days))


if __name__ == "__main__":
    main()
