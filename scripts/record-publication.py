#!/usr/bin/env python3
"""Record a successful game publication in an isolated www checkout and push it."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def git(*args):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], text=True).strip()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', required=True)
    parser.add_argument('--kind', choices=['deployment', 'release'], required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--tag')
    parser.add_argument('--published', default=datetime.now(timezone.utc).isoformat())
    parser.add_argument('--write-only', action='store_true')
    args = parser.parse_args()
    games = json.loads((ROOT / 'content/games.json').read_text())
    if args.game not in games or not re.fullmatch('[a-f0-9]{40}', args.commit):
        raise SystemExit('Unknown game or invalid source commit')
    if args.kind == 'release' and not re.fullmatch(r'v\d+\.\d+\.\d+', args.tag or ''):
        raise SystemExit('Release requires a version tag')
    if datetime.fromisoformat(args.published.replace('Z','+00:00')).tzinfo is None:
        raise SystemExit('Publication date requires a timezone')
    identity = args.tag if args.kind == 'release' else args.commit
    relative = Path('content/publications') / args.game / f'{args.kind}-{identity}.json'
    target = ROOT / relative
    for attempt in range(4):
        if not args.write_only:
            git('pull', '--ff-only', 'origin', 'main')
        if target.exists():
            existing = json.loads(target.read_text())
            if existing['commit'] != args.commit:
                raise SystemExit('An immutable publication already names another commit')
            print('Publication already recorded: ' + str(relative))
            return
        record = {'kind': args.kind, 'commit': args.commit, 'published': args.published}
        if args.kind == 'release':
            record['tag'] = args.tag
        else:
            record['id'] = args.commit[:12]
            previous = [json.loads(p.read_text()) for p in target.parent.glob('deployment-*.json')]
            if previous:
                record['previous'] = max(previous, key=lambda p: datetime.fromisoformat(p['published'].replace('Z','+00:00')))['commit']
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(record, indent=2) + '\n')
        if args.write_only:
            return
        git('add', str(relative))
        git('-c', 'user.name=unbought publishing', '-c', 'user.email=publishing@unbought.games',
            'commit', '-m', f'chore: publish {args.game} {args.kind} {identity}')
        try:
            git('push', 'origin', 'HEAD:main')
            print('Published ' + str(relative))
            return
        except subprocess.CalledProcessError:
            if attempt == 3:
                raise
            # Only undo the commit this script just created. The isolated checkout
            # has no user edits. Recompute previous against the latest main.
            git('reset', '--hard', 'HEAD^')
    raise SystemExit('Publication retries exhausted')

if __name__ == '__main__':
    main()
