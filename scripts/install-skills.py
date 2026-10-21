#!/usr/bin/env python3
"""Install the repository's maintained skills without overwriting other skills."""
import os
from pathlib import Path

root = Path(__file__).resolve().parents[1]
destination = Path(os.environ.get('CODEX_HOME', str(Path.home() / '.codex'))) / 'skills'
destination.mkdir(parents=True, exist_ok=True)
for source in (root / 'docs/skills').iterdir():
    if not (source / 'SKILL.md').is_file():
        continue
    target = destination / source.name
    if target.exists() or target.is_symlink():
        if target.resolve() == source.resolve():
            continue
        raise SystemExit(f'Refusing to overwrite existing skill: {target}')
    target.symlink_to(source, target_is_directory=True)
    print('Installed ' + source.name)
