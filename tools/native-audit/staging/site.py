#!/usr/bin/env python3
"""Create/reuse a loopback-only WordPress QA stack. Secrets are never printed."""
import argparse
from pathlib import Path
import secrets
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('action', choices=['up', 'stop', 'status'])
parser.add_argument('--state-dir', type=Path, required=True, help='Private directory outside the repository')
parser.add_argument('--extras', type=Path, help='Optional local checkout of the private plugins')
args = parser.parse_args()
repo = Path(__file__).resolve().parents[3]
state = args.state_dir.expanduser().resolve()
if state == repo or repo in state.parents:
    parser.error('Keep QA secrets outside the repository.')
state.mkdir(parents=True, exist_ok=True, mode=0o700)
state.chmod(0o700)
env_file = state / 'qa.env'
if not env_file.exists():
    extras = args.extras.expanduser().resolve() if args.extras else state / 'empty-private'
    if not args.extras:
        extras.mkdir(exist_ok=True)
    if not extras.is_dir():
        parser.error('The private checkout directory does not exist.')
    values = {
        'FLUX_QA_DB_PASSWORD': secrets.token_urlsafe(30),
        'FLUX_QA_DB_ROOT_PASSWORD': secrets.token_urlsafe(30),
        'FLUX_QA_ADMIN_PASSWORD': secrets.token_urlsafe(30),
        'FLUX_QA_REPO': str(repo),
        'FLUX_QA_EXTRAS': str(extras),
        'FLUX_QA_ENV_FILE': str(env_file),
    }
    # Single-quoted dotenv values remain literal (including spaces and dollar signs in paths).
    def dotenv(value):
        if '\n' in value or "'" in value:
            parser.error('QA paths must not contain newlines or single quotes.')
        return "'" + value + "'"
    with open(env_file, 'x', opener=lambda path, flags: __import__('os').open(path, flags, 0o600)) as file:
        file.write(''.join(key + '=' + dotenv(value) + '\n' for key, value in values.items()))
env_file.chmod(0o600)
command = ['docker', 'compose', '--env-file', str(env_file), '-f', str(Path(__file__).with_name('compose.yaml'))]
def run(*arguments):
    subprocess.run(command + list(arguments), check=True)
if args.action == 'up':
    run('up', '-d', 'db', 'wordpress')
    for script, flags in [('bootstrap.php', ['--skip-wordpress']), ('provision.php', [])]:
        run('run', '--rm', '-T', 'cli', 'wp', 'eval-file', '/opt/fluxwp-public/tools/native-audit/staging/' + script, *flags)
    print('QA site: http://127.0.0.1:8874 — credentials stay in the private state directory.')
elif args.action == 'stop':
    run('stop')  # Keep the named volumes; never delete an existing QA database implicitly.
else:
    run('ps')
