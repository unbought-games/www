# AWS website preparation

Verified AWS preview: https://d34vrnpxc6m9sz.cloudfront.net. Detailed evidence and
nameserver handoff are recorded in `infra/services/www/production/status.md`.

Authorized 2026-10-21. The AWS website is prepared independently of current public
DNS. The owner will update Namecheap after giving the go-ahead. Until then,
Cloudflare remains the public website and DNS provider.

Infrastructure ownership lives in the sibling infra repository:

- `services/www/production`: private S3 bucket, CloudFront, TLS, headers, routing,
  and GitHub OIDC deployment role.
- `dns/aws`: three prepared Route 53 zones, all existing mail/verification records,
  website aliases, and the certificate-validation copies.

The existing Cloudflare roots/workflows and R2 state stay intact during overlap.
AWS resources use the existing encrypted/versioned AWS Terraform state bucket.
No website source, artwork, policy text, or canonical URL changes are required.

## Deploy and test without changing DNS

Read the `website` output from `infra/services/www/production` for the exact IDs:

```sh
python3 scripts/deploy-aws.py --profile unbought --bucket unbought-www-888782969020-us-east-2 --distribution-id DISTRIBUTION_ID
python3 scripts/check-aws.py --edge DISTRIBUTION_DOMAIN
```

The checker uses curl connection overrides, retaining production Host and TLS SNI.
TLS verification stays enabled. It tests every asset, policy pages, security
headers, genuine 404s, aliases, HTTPS and directory redirects, repeated/encoded
query values, and preview indexing. It does not change DNS or the local hosts file.
The CloudFront preview hostname sends `X-Robots-Tag: noindex`.

Cloudflare's `_headers` file is not uploaded: AWS security headers are defined in
Terraform. Static content remains identical. CloudFront routes directory indexes
and handles the same canonical domain redirects through its edge functions.

## Automation and cutover

`AWS website` validates pull requests and deploys from `main` only when the
repository variable `AWS_DEPLOY_ENABLED` is `true`. Set `AWS_WEBSITE_ROLE_ARN`,
`AWS_WEBSITE_BUCKET`, `AWS_WEBSITE_DISTRIBUTION_ID`, and `AWS_WEBSITE_EDGE_DOMAIN`
from the infrastructure outputs. The existing `production` environment must
remain limited to `main`. The role uses temporary GitHub OIDC credentials.

Keep Cloudflare's `DEPLOY_ENABLED` active until cutover. Deploy the current content
to AWS and rerun both the AWS checker and infra's DNS comparison immediately before
the owner switches nameservers. After propagation and verification, disable the
old release job and retire Cloudflare through its existing Terraform owners.
The full DNS/legacy state retirement procedure is in `infra/dns/aws/README.md`.
