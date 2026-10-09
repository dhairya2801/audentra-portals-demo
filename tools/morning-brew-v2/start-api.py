"""Launch only the isolated Morning Brew preview; never print provider credentials."""
import os
from pathlib import Path
import subprocess
from urllib.parse import quote
base = Path(__file__).resolve().parents[3]
backend = base / 'morning-brew-platform-sprint-1oct-v2'
settings = {}
for line in (base / 'handoff-platform-2oct/.env.handoff').read_text().splitlines():
    if line.strip() and not line.startswith('#') and '=' in line:
        key, value = line.split('=', 1)
        settings[key] = value.strip().strip('\"').strip("'")
database = 'audentra_university_morning_brew_v2'
container = 'audentra-handoff-postgres-1'
user = settings['POSTGRES_USER']
exists = subprocess.check_output(['docker','exec',container,'psql','-U',user,'-d','postgres','-tAc',f"SELECT 1 FROM pg_database WHERE datname='{database}'"],text=True).strip()
if not exists:
    subprocess.run(['docker','exec',container,'createdb','-U',user,database],check=True)
    dump = subprocess.Popen(['docker','exec',container,'pg_dump','-U',user,settings['POSTGRES_DB']],stdout=subprocess.PIPE)
    subprocess.run(['docker','exec','-i',container,'psql','-U',user,'-d',database,'-q'],stdin=dump.stdout,stdout=subprocess.DEVNULL,check=True)
    if dump.wait(): raise RuntimeError('Database copy failed')
venv = backend / 'apps/api/.venv'
if not venv.exists(): venv.symlink_to(base / 'handoff-platform-2oct/apps/api/.venv')
url = f"postgresql+asyncpg://{quote(user)}:{quote(settings['POSTGRES_PASSWORD'])}@127.0.0.1:{settings['HANDOFF_POSTGRES_PORT']}/{database}"
env = {**os.environ,**settings,'DATABASE_URL':url,'PYTHONPATH':str(backend/'apps/api/src'),'API_PORT':'4112','WEB_ORIGIN':'http://localhost:3012','AUTH_MODE':'demo','AUDENTRA_ENV':'development','BROWSER_AUTH_REQUIRED':'true','DEMO_STUDENT_ALLOWLIST':'SYN-000061','DEMO_STAFF_ALLOWLIST':'AU-55ff7e408818'}
subprocess.run([str(venv/'bin/python'),'-m','audentra.infrastructure.db.migrations','--migrations-dir',str(backend/'apps/api/migrations')],cwd=backend,env=env,check=True)
code = """from tools.university.run_runtime import runtime_settings
from audentra.bootstrap.api import create_production_app
import os, uvicorn
settings=runtime_settings(os.environ['DATABASE_URL'],enable_openai=bool(os.environ.get('OPENAI_API_KEY')),portal_origin='http://localhost:3012')
uvicorn.run(create_production_app(settings),host='127.0.0.1',port=4112)
"""
with open('/tmp/morning-brew-v2-api.log','a') as log:
    process = subprocess.Popen([str(venv/'bin/python'),'-c',code],cwd=backend,env=env,stdout=log,stderr=log,start_new_session=True)
print(f'Isolated Morning Brew API pid: {process.pid}')
