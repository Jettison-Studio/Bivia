"""Local HTTP integration test: Storage ownership/limits and complete account deletion.
Creates its own accounts and removes their files through Storage API, then deletes accounts.
Run with local Supabase Storage enabled: python3 supabase/tests/storage_account.py
"""
import base64
import concurrent.futures
import json
import os
import secrets
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('BIVIA_TEST_SUPABASE_URL', 'http://127.0.0.1:56321')
KEY = os.environ.get('BIVIA_TEST_PUBLISHABLE_KEY', 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH')
# Refuse to run account-creating tests against a remote project by mistake.
assert BASE in ('http://127.0.0.1:56321', 'http://localhost:56321'), 'Local Bivia URL required'
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhN8AAAAASUVORK5CYII=')


def request(path, token=None, data=None, method='POST', content_type='application/json', extra=None):
    headers = {'apikey': KEY, 'Content-Type': content_type, **(extra or {})}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if data is not None and not isinstance(data, bytes):
        data = json.dumps(data).encode()
    req = urllib.request.Request(BASE + path, headers=headers, data=data, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status, body = response.status, response.read()
    except urllib.error.HTTPError as error:
        status, body = error.code, error.read()
    try:
        body = json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass
    return status, body


accounts = []
try:
    for _ in range(2):
        status, body = request('/auth/v1/signup', data={'email': f'bivia-qa-{uuid.uuid4()}@example.com', 'password': secrets.token_urlsafe(24)})
        assert status == 200 and body.get('access_token'), (status, body)
        accounts.append({'id': body['user']['id'], 'token': body['access_token']})
    owner, stranger = accounts
    status, body = request('/functions/v1/avatar-upload', data=PNG, content_type='image/png')
    assert status == 401, 'Unauthenticated Edge upload was allowed'
    status, body = request('/functions/v1/avatar-upload', owner['token'], PNG, content_type='image/png')
    assert status == 200 and body.get('path', '').startswith(owner['id'] + '/'), (status, body)
    path = body['path']
    object_path = '/storage/v1/object/avatars/' + path
    status, body = request(object_path, owner['token'], PNG, content_type='image/png', extra={'x-upsert': 'true'})
    assert status >= 400, 'Direct upload bypassed server coordination'
    status, body = request('/storage/v1/object/avatars/' + owner['id'] + '/direct.png', owner['token'], PNG, content_type='image/png')
    assert status >= 400, 'Direct owner upload bypassed server coordination' 
    status, _ = request('/storage/v1/object/public/avatars/' + path, method='GET')
    assert status == 200, 'Avatar is not publicly readable'
    status, body = request('/storage/v1/object/avatars/' + owner['id'] + '/other.png', stranger['token'], PNG, content_type='image/png')
    assert status >= 400, 'Another user could write the owner folder'
    status, body = request(object_path, stranger['token'], PNG, content_type='image/png', extra={'x-upsert': 'true'})
    assert status >= 400, 'Another user could overwrite the avatar'
    request('/storage/v1/object/avatars', stranger['token'], {'prefixes': [path]}, method='DELETE')
    status, _ = request('/storage/v1/object/public/avatars/' + path, method='GET')
    assert status == 200, 'Another user could delete the avatar'
    status, body = request('/functions/v1/avatar-upload', owner['token'], b'<svg/>', content_type='image/svg+xml')
    assert status >= 400, 'SVG upload bypassed type allowlist'
    status, body = request('/functions/v1/avatar-upload', owner['token'], b'x' * 2097153, content_type='image/jpeg')
    assert status >= 400, 'Oversized upload bypassed size limit'
    status, body = request('/rest/v1/rpc/bivia_group_action_v1', owner['token'], {'p_action': 'create', 'p_payload': {'name': 'Disposable QA group', 'visibility': 'private'}})
    assert status == 200, (status, body)
    status, body = request('/rest/v1/rpc/bivia_delete_account_v1', owner['token'], {'p_confirmation': 'DELETE MY ACCOUNT'})
    assert status >= 400 and 'avatar' in str(body), 'Account deletion did not require storage cleanup'
    status, body = request('/storage/v1/object/avatars', owner['token'], {'prefixes': [path]}, method='DELETE')
    assert status == 200, (status, body)
    status, body = request('/rest/v1/rpc/bivia_delete_account_v1', owner['token'], {'p_confirmation': 'DELETE MY ACCOUNT'})
    assert status == 200 and body == {'deleted': True, 'deletedOwnedGroups': 1}, (status, body)
    owner['deleted'] = True
    status, body = request('/rest/v1/rpc/bivia_leaderboard_v1', owner['token'], {})
    assert status >= 400, 'Deleted account retained leaderboard access'
    status, body = request('/rest/v1/rpc/bivia_group_action_v1', owner['token'], {'p_action': 'create', 'p_payload': {'name': 'Must fail'}})
    assert status >= 400, 'Deleted account retained mutation access'
    # Real concurrent HTTP requests: never allow a successful upload and successful delete.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        upload = pool.submit(request, '/functions/v1/avatar-upload', stranger['token'], PNG, 'POST', 'image/png')
        deletion = pool.submit(request, '/rest/v1/rpc/bivia_delete_account_v1', stranger['token'], {'p_confirmation': 'DELETE MY ACCOUNT'})
        upload_status, upload_body = upload.result()
        delete_status, delete_body = deletion.result()
    if delete_status == 200:
        stranger['deleted'] = True
    assert not (upload_status == 200 and delete_status == 200), 'Upload raced account deletion and left an orphan'
    if delete_status == 200:
        pass
    else:
        assert upload_status == 200 and 'avatar' in str(delete_body), (upload_status, upload_body, delete_status, delete_body)
    print('PASS: authenticated Edge avatar upload/public read, direct writes denied, cross-user write/delete denial, MIME and 2 MiB limits, Storage API cleanup, account/group deletion, stale-token denial, concurrent upload/delete serialization.')
finally:
    for account in accounts:
        if not account.get('deleted'):
            status, files = request('/storage/v1/object/list/avatars', account['token'], {'prefix': account['id'], 'limit': 100})
            if status == 200 and files:
                request('/storage/v1/object/avatars', account['token'], {'prefixes': [account['id'] + '/' + item['name'] for item in files]}, method='DELETE')
            status, body = request('/rest/v1/rpc/bivia_delete_account_v1', account['token'], {'p_confirmation': 'DELETE MY ACCOUNT'})
            if status != 200:
                raise RuntimeError(f'QA account cleanup failed for {account["id"]}: {body}')
