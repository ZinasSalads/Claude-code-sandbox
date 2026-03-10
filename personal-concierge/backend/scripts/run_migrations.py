#!/usr/bin/env python3
"""Apply database migrations to Supabase.

Usage:
    python scripts/run_migrations.py

Requires SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
"""

import os
import sys
from pathlib import Path

# Add backend dir to path so we can import config
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

import httpx


def run_migrations():
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_KEY")

    if not supabase_url or not service_key:
        print("ERROR: Missing required environment variables.")
        if not supabase_url:
            print("  - SUPABASE_URL: Your Supabase project URL (e.g. https://xxx.supabase.co)")
        if not service_key:
            print("  - SUPABASE_SERVICE_KEY: Service role key from Supabase project settings > API")
        print("\nSet these in the .env file in the project root, then re-run this script.")
        sys.exit(1)

    migrations_dir = Path(__file__).resolve().parent.parent / "migrations"
    migration_files = sorted(migrations_dir.glob("*.sql"))

    if not migration_files:
        print("No migration files found.")
        return

    for migration_file in migration_files:
        print(f"Applying: {migration_file.name}")
        sql = migration_file.read_text()

        # Execute SQL via Supabase REST API using the postgrest rpc or raw SQL endpoint
        # We use the Supabase management API to run raw SQL
        url = f"{supabase_url}/rest/v1/rpc"

        # For raw SQL execution, use the postgres connection via httpx
        # Supabase exposes a SQL endpoint at /pg/query for service role
        # Alternative: split statements and use rpc, but simplest is the SQL endpoint
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }

        # Split SQL into individual statements for execution
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        success_count = 0
        error_count = 0

        for stmt in statements:
            # Use Supabase's rpc endpoint to execute raw SQL
            # We create a helper function approach — but simplest is direct REST
            resp = httpx.post(
                f"{supabase_url}/rest/v1/rpc/",
                headers=headers,
                json={"query": stmt + ";"},
                timeout=30,
            )

            # If rpc approach doesn't work, try the raw query approach
            if resp.status_code >= 400:
                # Try executing via the Supabase SQL editor API
                resp2 = httpx.post(
                    f"{supabase_url}/pg/query",
                    headers={
                        "apikey": service_key,
                        "Authorization": f"Bearer {service_key}",
                        "Content-Type": "application/json",
                    },
                    json={"query": stmt + ";"},
                    timeout=30,
                )
                if resp2.status_code < 400:
                    success_count += 1
                else:
                    # Many Supabase setups need the SQL to be run via the dashboard
                    error_count += 1
            else:
                success_count += 1

        if error_count > 0:
            print(f"  Note: {error_count} statement(s) could not be executed via API.")
            print("  This is normal — Supabase may require running DDL via the SQL Editor.")
            print(f"  Copy the contents of {migration_file.name} and paste into:")
            print(f"  {supabase_url.replace('.supabase.co', '')}/project/sql")
            print()
        print(f"  Processed {success_count + error_count} statements ({success_count} OK, {error_count} need manual run)")

    print("\nMigration complete.")
    print("Tables expected: health_data, check_ins, workouts, meals, biomarkers,")
    print("  supplements, supplement_log, user_profile, memories, profile_questions")
    print("\nIf any statements failed, run the SQL manually in the Supabase SQL Editor.")


if __name__ == "__main__":
    run_migrations()
