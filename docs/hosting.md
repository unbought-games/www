# Hosting decision

## AWS consolidation approved October 21, 2026

The owner authorized Terraform changes and a tested AWS website without another
cost estimate. Website hosting moves to private S3 + CloudFront, and all three
DNS zones are prepared in Route 53. Nameserver cutover is held for the owner, who
will update Namecheap. Existing Cloudflare resources/state remain active during
preparation. See [migration preparation](aws-migration.md).

The game runtime allocation below is unchanged. The older decision to keep the
website on Pages is superseded by this staged migration.

## Accepted October 20, 2026

The public website stays on Cloudflare Pages. Accounts and Orbit share one AWS
EC2 application host, with PostgreSQL on private single-AZ RDS in Ohio
(`us-east-2`). The project owner approved this starting allocation:

| Resource | Approved estimated monthly cost |
| --- | ---: |
| EC2 `t3a.medium`, 2 vCPU / 4 GB RAM | $27.45 |
| RDS PostgreSQL `db.t4g.micro`, 1 GB RAM, single AZ | $11.68 |
| RDS storage, 20 GB | $2.30 |
| EC2 storage, 30 GB | $2.40 |
| One public IPv4 address | $3.65 |
| Base total, 730 hours | **$47.48** |

This is the approved launch estimate, not a spending cap. ECR storage, email,
logging, excess backups, traffic, CPU burst credits and tax can add charges.
Capacity changes need a fresh cost review. No load balancer or NAT gateway is
part of this starting allocation.

## Infrastructure ownership

- This repository owns the public static website, its Pages releases, the
  `unbought.games` and `unboughtgames.com` Cloudflare zones' managed records,
  canonical redirects and the website's R2 Terraform state.
- The [infra repository](https://github.com/unbought-games/infra) owns AWS compute,
  RDS, private ECR, deployment permissions, email sender identities and the
  `orbitimperium.com` zone. AWS output supplies the Accounts host address and
  transactional email DNS records to this repository; do not create duplicate
  AWS resources here.
- Existing Zoho verification, MX, SPF and DKIM records serve ordinary mailbox
  delivery. Preserve them when adding transactional email. SES uses its default
  MAIL FROM domain and three separate DKIM selectors. No custom MAIL FROM
  subdomain or change to the apex SPF/MX records is required.

`infra/launch.tf` points `accounts.unbought.games` at the application host's
Elastic IP and publishes the SES DKIM CNAMEs. These records are DNS-only;
Accounts TLS terminates on the application host. Update them from verified AWS
outputs if the Elastic IP or SES identity is replaced. Review the Terraform plan
for unintended website or mailbox changes before applying.

Accounts and Orbit releases use private ECR images identified by immutable
commit and image digest. Each application's web/API and workers use the same
application image. Application deployment and rollback belong to the AWS
workflows; changing website DNS does not deploy an application.

## Operations and future sizing

Keep database access private to the application host. A single EC2 host and
single-AZ database are deliberate initial availability limits. Monitor memory,
CPU, database connections, request latency, worker backlog and backup freshness.
Verify restores and keep release rollback compatible with database migrations.

Revisit capacity using observed application and database load. Keep Cloudflare
static hosting independent of application sizing. Bound log retention and image
retention, track actual spend and forecasts, and remember that budget alerts are
not hard spending limits.

This decision supersedes the October 13 DigitalOcean proposal.
