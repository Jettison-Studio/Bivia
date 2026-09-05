"""Real concurrent PostgreSQL sessions: answer retries must not duplicate points.
Run: python3 supabase/tests/concurrency.py (Docker local Bivia must be running).
Creates and removes only its own randomized auth fixture.
"""
import concurrent.futures
import json
import subprocess
import uuid


def sql(query):
    result = subprocess.run(
        ['docker', 'exec', '-i', 'supabase_db_Bivia', 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
        input=query, text=True, capture_output=True, check=True,
    )
    return result.stdout.splitlines()


user_id = str(uuid.uuid4())
request_id = str(uuid.uuid4())
quiz_id = '10000000-0000-4000-8000-000000000001'
claims = f"select set_config('request.jwt.claim.sub','{user_id}',false);"
try:
    sql(f"insert into auth.users(id,email,is_anonymous) values('{user_id}','{user_id}@example.invalid',false);")
    lines = sql(claims + f"select public.bivia_start_attempt_v1('{quiz_id}','category',true);")
    state = json.loads(next(line for line in lines if line.startswith('{')))
    attempt_id, question_id = state['id'], state['question']['id']
    sql(f"update public.attempts set question_started_at=clock_timestamp()-interval '1 second' where id='{attempt_id}';")
    query = (
        'begin;' + claims + 'set local role authenticated;'
        f"select public.bivia_answer_v1('{attempt_id}','{question_id}',0,'{request_id}');"
        'select pg_sleep(0.25);commit;'
    )
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(sql, [query, query]))
    states = [json.loads(next(line for line in result if line.startswith('{'))) for result in results]
    assert states[0] == states[1], 'Concurrent idempotency responses differed'
    assert states[0]['score'] == 3 and states[0]['questionIndex'] == 1
    score = sql(f"select score from public.attempts where id='{attempt_id}';")[0]
    assert score == '3', f'Duplicate points persisted: {score}'
    print('PASS: two concurrent authenticated retries returned the same response and persisted exactly 3 points.')
finally:
    sql(f"delete from auth.users where id='{user_id}';")
