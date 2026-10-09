"""Run the additional persistence checks only against this sprint's demo copy."""
import os
from pathlib import Path
import subprocess
from urllib.parse import quote
base = Path(__file__).resolve().parents[3]
backend = base / 'morning-brew-platform-sprint-1oct-v2'
settings = {}
for line in (base / 'handoff-platform-2oct/.env.handoff').read_text().splitlines():
    if line.strip() and not line.startswith('#') and '=' in line:
        key,value=line.split('=',1)
        settings[key]=value.strip().strip('\"').strip("'")
url=f"postgresql+asyncpg://{quote(settings['POSTGRES_USER'])}:{quote(settings['POSTGRES_PASSWORD'])}@127.0.0.1:{settings['HANDOFF_POSTGRES_PORT']}/audentra_university_morning_brew_v2"
env={**os.environ,'MORNING_BREW_TEST_DATABASE_URL':url,'PYTHONPATH':str(backend/'apps/api/src')}
raise SystemExit(subprocess.call([str(backend/'apps/api/.venv/bin/python'),'-m','pytest','tests/test_brew_experience_postgres.py','-q'],cwd=backend/'apps/api',env=env))
