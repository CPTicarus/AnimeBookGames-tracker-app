# run_backend.py
import os
import sys
import time
import subprocess
from pathlib import Path

# set DJANGO settings module
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")  # change to your project name

# Optional: run migrations on first run
def run_migrations():
    try:
        import django
        django.setup()
        from django.core.management import call_command
        call_command("migrate", "--noinput")
    except Exception as e:
        print("Migration failed:", e)

def main():
    # ensure current working dir is project root
    PROJECT_ROOT = Path(__file__).resolve().parent
    os.chdir(PROJECT_ROOT)

    # run migrations (optional)
    run_migrations()

    # Serve with uvicorn (ASGI). Use imports to avoid requiring uvicorn at top-level if unavailable.
    try:
        import uvicorn
        uvicorn.run("backend.asgi:application", host="127.0.0.1", port=8000, log_level="info")
    except Exception as e:
        print("Failed to start uvicorn:", e)
        sys.exit(1)

if __name__ == "__main__":
    main()
