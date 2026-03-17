import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"


def configure_build_database():
    database_url_unpooled = os.getenv("DATABASE_URL_UNPOOLED")
    if database_url_unpooled:
        os.environ["DATABASE_URL"] = database_url_unpooled

    pg_host_unpooled = os.getenv("PGHOST_UNPOOLED")
    if pg_host_unpooled:
        os.environ["PGHOST"] = pg_host_unpooled


def run_manage_py(*args):
    subprocess.run(
        [sys.executable, "manage.py", *args],
        cwd=BACKEND_DIR,
        check=True,
    )


def main():
    configure_build_database()
    run_manage_py("migrate", "--noinput")
    run_manage_py("seed_questions")


if __name__ == "__main__":
    main()
