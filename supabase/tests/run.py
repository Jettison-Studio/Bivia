"""Run Bivia's real local database/API verification; return nonzero on TAP failures."""
from pathlib import Path
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
for name in ('gameplay.sql', 'edge_cases.sql', 'engine.sql', 'profile_names.sql', 'daily.sql', 'gameplay_flow.sql', 'timed_curve.sql', 'editorial_daily.sql', 'editorial_archive.sql'):
    result = subprocess.run(
        ['docker', 'exec', '-i', 'supabase_db_Bivia', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
        input=(root / 'supabase/tests' / name).read_text(), text=True, capture_output=True,
    )
    plan = re.search(r'^1\.\.(\d+)$', result.stdout, re.M)
    passed = len(re.findall(r'^ok \d+', result.stdout, re.M))
    if result.returncode or not plan or passed != int(plan[1]) or re.search(r'^not ok|Looks like', result.stdout, re.M):
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise SystemExit(1)
    print(f'PASS: {name}: {passed} assertions', flush=True)
for script in ('concurrency.py', 'storage_account.py'):
    subprocess.run([sys.executable, str(root / 'supabase/tests' / script)], cwd=root, check=True)
