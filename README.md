# Unbought public website

Pure static HTML/CSS, hosted on **Cloudflare Pages**. The canonical domain is
**https://unbought.games/**; `unboughtgames.com` and both `www` aliases redirect to
it with HTTP 301, preserving path and query. The approved Accounts and Orbit
launch uses AWS EC2 with RDS PostgreSQL; application infrastructure is owned by the sibling
[`infra` repository](https://github.com/unbought-games/infra).

Repository: [unbought-games/www](https://github.com/unbought-games/www).
Production URL: **https://unbought.games/**. Releases and infrastructure runs are
tracked in [GitHub Actions](https://github.com/unbought-games/www/actions).
See [hosting decision](docs/hosting.md).

## What to provide

Copy `.env.example` to `.env.local` and fill in:

```dotenv
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_scoped_token
```

Keep `.env.local` outside `public/`, gitignored, with permissions `600`. Do not
paste tokens in chat. The account ID itself is not a secret. GitHub Actions runs
in `unbought-games/www`.

Create a custom token in [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens):

| Scope | Permission | Limit to |
| --- | --- | --- |
| Account | Cloudflare Pages — Edit | The account hosting the site |
| Account | Workers R2 Storage — Edit | The account, to create the state bucket |
| Zone | Zone — Read | `unbought.games` and `unboughtgames.com` |
| Zone | DNS — Edit | Those two zones |
| Zone | Single Redirect — Edit | Those two zones |

Cloudflare's API documentation calls some Edit permissions Write; Single Redirect
may also appear as Dynamic URL Redirects. There is no need for a Global API Key,
billing access, or permission to create other tokens.

R2 is active and the dedicated `unbought-terraform-state` bucket is provisioned.
The provided API token can generate one-hour, object-only R2 credentials scoped
exclusively to this bucket. `scripts/r2-session.py` handles this locally and in CI;
no separate permanent R2 access key or Terraform Cloud account is needed.

For local Terraform commands, load `.env.local` and use:

```sh
python3 scripts/r2-session.py --exec terraform -chdir=infra plan
```

The wrapper keeps temporary credentials in the child process environment. The
`--github-env` mode masks them and exports them only for that GitHub Actions job.
An optional narrower Pages-only token can be used for content deployments.

## Terraform ownership and bootstrap

- `bootstrap/`: private R2 state bucket, public development URL explicitly disabled.
- `infra/`: Pages Direct Upload project, custom domain, website DNS records,
  Zoho Mail verification/MX/SPF/DKIM records, and canonical redirects on the two
  existing zones. Zoho mail delivery and authentication records use a 60-second TTL.
  `infra/launch.tf` also owns the Accounts host A record and AWS SES DKIM CNAMEs;
  the AWS infrastructure supplies their values. Existing mailbox records remain
  independent of transactional email.
- GitHub Actions: infrastructure plan/apply and static file releases.

Use Terraform **1.10+** (CI pins 1.16.5) for native S3 lockfiles.

Load local credentials without printing them, then inspect the account:

```sh
set -a
source .env.local
set +a
export TF_VAR_account_id="$CLOUDFLARE_ACCOUNT_ID"
python3 scripts/cloudflare-inspect.py
```

The inspector only reads Cloudflare. It discovers zone IDs and writes ignored
local variables and an inspection report. On the initial launch, the owner explicitly requested removal of all existing
DNS records: four registrar mail-forwarding MX records and one SPF TXT record
were removed using an isolated Terraform plan. No existing R2 buckets were
changed. For subsequent changes, inspect and import existing resources before
applying; do not repeat the initial cleanup automatically.

The state bucket is the one-time bootstrap dependency:

```sh
terraform -chdir=bootstrap init
terraform -chdir=bootstrap plan -out=bootstrap.tfplan
terraform -chdir=bootstrap apply bootstrap.tfplan
```

Bootstrap has already completed for this account. For a new account, inspect or
import an existing bucket before proceeding, then migrate bootstrap state using
a temporary R2 session:

```sh
cp bootstrap/backend.tf.example bootstrap/backend.tf
python3 scripts/r2-session.py --exec terraform -chdir=bootstrap init -migrate-state \
  -backend-config="endpoints={s3=\"https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com\"}"
```

Keep local state until remote migration is verified. The site and bootstrap use
different state keys in the same bucket. Native lockfiles prevent concurrent
writers. R2 has no S3 object versioning; the infrastructure workflow saves a
private state snapshot after every attempted apply, including partial failures.
Save an additional snapshot before any manual state import or migration.

There is no Terraform Cloud dependency. Cloudflare resources are managed by the
locked provider version. The public website files are release artifacts uploaded
by CI, rather than thousands of Terraform-managed objects.

## GitHub Actions setup

This directory is the root of `unbought-games/www`. The workflows run from the
repository root.

Configure repository variables:

| Variable | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID |
| `CLOUDFLARE_ZONE_IDS` | `{"games":"zone-id","com":"zone-id"}`, discovered by the inspector |
| `DEPLOY_ENABLED` | `true` after provisioning |

Configure GitHub environments restricted to `main`:

| Environment | Secrets |
| --- | --- |
| `infrastructure` | `CLOUDFLARE_INFRA_TOKEN` (also issues temporary R2 sessions) |
| `production` | `CLOUDFLARE_DEPLOY_TOKEN` (Pages-only preferred) |

No secrets belong in committed `.tfvars`, plan files, or backend configuration.
Configure the desired environment review policy before enabling production.

Run **Website infrastructure** with `apply=false` to inspect the actual plan,
then with `apply=true` to apply it through CI. Site state lives at
`www/terraform.tfstate`; the workflow supplies the R2 endpoint and credentials.
After infrastructure is ready, set `DEPLOY_ENABLED=true` and run **Website**.
Subsequent pushes to `main` deploy automatically. PRs run checks without secrets.

The live release check verifies exact published files, the social PNG, security
headers, a genuine 404, HTTPS canonicalization, and alias path/query preservation.
DNS/certificate issuance may require waiting before the first check succeeds.
Rollback by reverting a content commit and redeploying through CI.

## Local development

```sh
npm ci
npm run dev
npm run check
```

Preview at `http://localhost:4173`. Only `public/` is uploaded. Wrangler is
development/deployment tooling; the page has no browser JavaScript, framework,
web fonts, tracking scripts, or cookies. HTML, CSS, favicon, and the outlined
logo stay under 12 KB uncompressed. Sharing crawlers fetch the separate
1200 × 630 PNG; its editable source is `artwork/social.svg`.

The approved F3 logo assets, 1024 px symbol, wordmarks, and offline mini design
guide are in [`artwork/brand/`](artwork/brand/README.md). Open
`artwork/brand/guide.html` locally, or serve that folder separately. The complete
handoff is `artwork/brand/unbought-brand-kit.zip`. Rebuild instructions and the
font license live with the assets. The site uses the one-line `public/logo.svg`
normally and `public/logo-stacked.svg` below 480 px. Only these two logos, the
favicon, and the social card are deployed; the full kit is not deployed.

The `no-transform` cache directive prevents Cloudflare from automatically injecting
its Web Analytics beacon into the HTML. Exact-file checks deliberately catch any
such changes in the delivered page. See [Cloudflare's explanation](https://developers.cloudflare.com/web-analytics/get-started/).

Automated checks cover metadata, assets, transfer budgets and Terraform schema.
The production workflow checks live DNS, TLS, redirects and exact deployed files
after each website release.
