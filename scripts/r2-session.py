"""Issue a one-hour R2 session for this site's state bucket; never print credentials."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description=__doc__)
mode = parser.add_mutually_exclusive_group(required=True)
mode.add_argument("--github-env", action="store_true")
mode.add_argument("--output", type=Path, help="Private local credentials JSON file")
mode.add_argument("--exec", dest="command", nargs=argparse.REMAINDER,
                  help="Run a command with the temporary credentials in its environment")
args = parser.parse_args()
account = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
token = os.environ.get("CLOUDFLARE_API_TOKEN", "")
if not re.fullmatch(r"[a-f0-9]{32}", account) or not token:
    sys.exit("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.")
if args.github_env and (os.environ.get("GITHUB_ACTIONS") != "true" or not os.environ.get("GITHUB_ENV")):
    sys.exit("--github-env must run inside GitHub Actions.")
if args.command is not None and not args.command:
    sys.exit("--exec requires a command.")


def request(path, body=None):
    headers = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}
    payload = json.dumps(body).encode() if body is not None else None
    req = Request("https://api.cloudflare.com/client/v4/" + path, data=payload, headers=headers)
    with urlopen(req, timeout=30) as response:
        result = json.load(response)
    if not result.get("success"):
        raise RuntimeError("Cloudflare rejected the request.")
    return result["result"]


try:
    try:
        identity = request("user/tokens/verify")
    except HTTPError as error:
        if error.code not in (400, 401, 403):
            raise
        identity = request(f"accounts/{account}/tokens/verify")
    if identity.get("status") != "active":
        sys.exit("Cloudflare token is not active.")
    credentials = request(f"accounts/{account}/r2/temp-access-credentials", {
        "bucket": "unbought-terraform-state",
        "parentAccessKeyId": identity["id"],
        "permission": "object-read-write",
        "ttlSeconds": 3600,
    })
except HTTPError as error:
    sys.exit(f"Cloudflare returned HTTP {error.code}; verify R2 permissions.")
except (RuntimeError, KeyError):
    sys.exit("Cloudflare did not return a valid token identity or R2 session.")

keys = {"AWS_ACCESS_KEY_ID": "accessKeyId", "AWS_SECRET_ACCESS_KEY": "secretAccessKey",
        "AWS_SESSION_TOKEN": "sessionToken"}
if not all(isinstance(credentials.get(k), str) and credentials[k] and
           "\n" not in credentials[k] and "\r" not in credentials[k] for k in keys.values()):
    sys.exit("Cloudflare returned an incomplete or invalid R2 session.")

if args.github_env:
    # GitHub consumes and masks these workflow commands; do not run this mode locally.
    for key in keys.values():
        print("::add-mask::" + credentials[key])
    with open(os.environ["GITHUB_ENV"], "a") as output:
        for name, key in keys.items():
            output.write(name + "=" + credentials[key] + "\n")
elif args.command:
    environment = os.environ.copy()
    environment.update({name: credentials[key] for name, key in keys.items()})
    environment.update(AWS_EC2_METADATA_DISABLED="true", AWS_DEFAULT_REGION="auto")
    sys.exit(subprocess.run(args.command, env=environment).returncode)
else:
    args.output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "w") as output:
        json.dump(credentials, output)
    args.output.chmod(0o600)
print("R2 session ready: one hour, object access to unbought-terraform-state only.")
