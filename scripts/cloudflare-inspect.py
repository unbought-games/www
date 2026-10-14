"""Read existing Cloudflare resources before importing them. Never changes the account."""
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
if not re.fullmatch(r"[a-f0-9]{32}", ACCOUNT) or not TOKEN:
    sys.exit("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN first (see .env.example).")


def get(path, optional=False):
    request = Request("https://api.cloudflare.com/client/v4/" + path,
                      headers={"Authorization": "Bearer " + TOKEN})
    try:
        with urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except HTTPError as error:
        if optional and error.code == 404:
            return None
        # Do not echo request headers, token values, or unfiltered remote errors.
        sys.exit(f"Cloudflare returned HTTP {error.code} for {path}; check token scope.")
    if not payload.get("success"):
        sys.exit(f"Cloudflare request failed for {path}.")
    return payload["result"]


report = {"account_id": ACCOUNT, "zones": {}}
zone_ids = {}
for key, domain in {"games": "unbought.games", "com": "unboughtgames.com"}.items():
    zones = get("zones?" + urlencode({"name": domain, "account.id": ACCOUNT}))
    if len(zones) != 1 or zones[0]["status"] != "active":
        sys.exit(f"Expected one active zone for {domain} in this account.")
    zone_id = zone_ids[key] = zones[0]["id"]
    records = []
    for name in (domain, "www." + domain):
        records.extend(get(f"zones/{zone_id}/dns_records?" + urlencode({"name": name})))
    redirect = get(f"zones/{zone_id}/rulesets/phases/http_request_dynamic_redirect/entrypoint", optional=True)
    report["zones"][domain] = {"id": zone_id, "records": records, "redirect_entrypoint": redirect}
    print(f"{domain}: active; {len(records)} apex/www records; "
          f"redirect ruleset {'exists (merge before apply)' if redirect else 'absent'}")

report["pages_project"] = get(f"accounts/{ACCOUNT}/pages/projects/unbought-www", optional=True)
report["state_bucket"] = get(f"accounts/{ACCOUNT}/r2/buckets/unbought-terraform-state", optional=True)
print("Pages project: " + ("exists (import before apply)" if report["pages_project"] else "absent"))
print("State bucket: " + ("exists (inspect/import)" if report["state_bucket"] else "absent"))

private = ROOT / ".local"
private.mkdir(mode=0o700, exist_ok=True)
report_path = private / "cloudflare-inspection.json"
report_path.write_text(json.dumps(report, indent=2) + "\n")
report_path.chmod(0o600)
variables_path = ROOT / "infra" / "local.auto.tfvars.json"
variables_path.write_text(json.dumps({"account_id": ACCOUNT, "zone_ids": zone_ids}, indent=2) + "\n")
variables_path.chmod(0o600)
print("Saved private inspection report and local Terraform variables. No remote changes made.")
