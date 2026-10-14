# Unbought public website

Pure static HTML/CSS, hosted on **Cloudflare Pages**. The canonical domain is
**https://unbought.games/**; `unboughtgames.com` and both `www` aliases redirect to
it with HTTP 301, preserving path and query. The future DigitalOcean server is
only a documented decision; no game infrastructure is being built now.

Repository: [unbought-games/www](https://github.com/unbought-games/www).
The site is **not deployed** yet; Cloudflare credentials are still needed.
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

R2 must be activated on the account. If activation requires accepting terms or
adding billing details, the account owner completes that once. After Terraform
creates the private `unbought-terraform-state` bucket, create an **R2 Object Read
& Write** token scoped only to that bucket, and add its returned values to
`.env.local`:

```dotenv
AWS_ACCESS_KEY_ID=the_r2_access_key_id
AWS_SECRET_ACCESS_KEY=the_r2_secret_access_key
```

The variable names are required by the S3-compatible backend; no AWS account is
used. An optional Pages-only token can go in `CLOUDFLARE_DEPLOY_TOKEN` to keep
routine releases separate from infrastructure access.

## Terraform ownership and bootstrap

- `bootstrap/`: private R2 state bucket, public development URL explicitly disabled.
- `infra/`: Pages Direct Upload project, custom domain, four DNS records, and
  canonical redirects on the two existing zones.
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
local variables and an inspection report. Existing website DNS records, Pages
resources, and redirect rulesets must be imported into Terraform before applying.
Merge existing redirect rules instead of replacing unrelated rules. Mail and other
DNS records are outside the configuration.

The state bucket is the one-time bootstrap dependency:

```sh
terraform -chdir=bootstrap init
terraform -chdir=bootstrap plan -out=bootstrap.tfplan
terraform -chdir=bootstrap apply bootstrap.tfplan
```

If the bucket exists, inspect/import it first. Once its bucket-scoped R2 key is
available, load `.env.local` again and migrate bootstrap state:

```sh
cp bootstrap/backend.tf.example bootstrap/backend.tf
terraform -chdir=bootstrap init -migrate-state \
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
| `infrastructure` | `CLOUDFLARE_INFRA_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` |
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
web fonts, tracking scripts, or cookies. HTML, CSS, and favicon total about 4 KB
uncompressed. Sharing crawlers fetch the separate 1200 × 630 PNG; its editable
source is `artwork/social.svg`.

Automated local checks cover metadata, assets, transfer budgets, Terraform schema,
and workflow YAML. Browser visual QA was blocked by the app's browser security
policy. Live DNS, TLS, redirects, and account permissions remain unverified until
the credentials are supplied and CI deployment succeeds.
