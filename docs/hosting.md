# Hosting decision

## Accepted October 13, 2026

- **Public website now:** Cloudflare Pages, separate from the game server. Use
  `unbought.games` as canonical and redirect `unboughtgames.com` and `www` aliases.
- **Future games:** one DigitalOcean server, initially around $24/month, running
  Rust services, PostgreSQL, a reverse proxy, and monitoring agents. Allow extra
  budget for off-server backups and verify restores. Keep management simple with
  versioned containers, Terraform provisioning, and CI deployments.
- **Current scope:** publish the website only. Do not create DigitalOcean
  infrastructure, server setup, or backend CI yet.
- **Website infrastructure:** Terraform manages Cloudflare resources and a private
  R2 state bucket. CI releases the site's static files. No Terraform Cloud account
  is required. Account tokens and initial R2 activation remain bootstrap inputs.

The comparison below records the research behind the decision; it does not
override the selected single-server approach.

## Earlier cost research

Researched October 13, 2026. The public site is implemented; no provider has been
provisioned. Prices below exclude tax, domain renewals, CI subscriptions, paid
support, and excess usage. They are planning inputs, not capacity guarantees.

## Public site

Selected Cloudflare's free static hosting for `unbought.games`, independently of
the game backend. Static asset requests on Pages are free and unlimited when no
Functions execute. Terraform owns the infrastructure; GitHub Actions uploads the
static artifact. The configuration is included in `infra/`; `bootstrap/` manages
the private R2 bucket for Terraform state.

[Cloudflare static pricing](https://developers.cloudflare.com/pages/functions/pricing/)

S3/CloudFront is also a valid choice if keeping everything in AWS matters more
than simpler static billing. CloudFront advertises a $0 flat-rate tier, but its
Terraform subscription resource is still an open provider request. Do not assume
an ordinary `aws_cloudfront_distribution` is on that plan: pay-as-you-go can bill
overages. The low flat-rate tiers also restrict custom response-header policies.

[CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/),
[plan restrictions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html),
[Terraform provider request](https://github.com/hashicorp/terraform-provider-aws/issues/49232)

## First game: compare actual configurations

Assume one always-on Rust API/scheduler, modest activity, roughly 2 GB application
memory and 2 GB database memory. All starter rows below have a single database
instance. They are not equivalent CPU-performance or availability guarantees.

| Configuration | Base monthly cost | Responsibilities and limits |
| --- | ---: | --- |
| DigitalOcean 4 GB VM, application and PostgreSQL together | $24 + $7.20 daily VM backups = **$31.20** | We operate OS and database; add independent PostgreSQL base/WAL backups. One machine is a single failure domain. |
| DigitalOcean App Platform 2 GB service + 2 GB managed PostgreSQL | $25 + $30 = **$55** | Managed operations, one app instance and one DB instance; storage/traffic overages extra. |
| AWS Lightsail 2 GB container + 2 GB encrypted managed PostgreSQL | $40 + $30 = **$70** | Bundled service, limited compute tiers. Confirm private connectivity and workload fit before choosing it. |
| AWS Fargate ARM 1 vCPU/2 GB + RDS PostgreSQL 2 GB, ALB, IPv4 | **$81.87** fixed estimate | Managed compute/database; add usage charges. Budget **$90–100** for low-traffic initial operation. |

The earlier $40 DigitalOcean estimate uses a **1 GB** database ($25 + $15), not
the 2 GB database compared here. Lightsail's $15 database explicitly lacks
at-rest encryption; the comparison uses its $30 encrypted plan.

[DigitalOcean VM pricing](https://www.digitalocean.com/pricing/droplets),
[App Platform pricing](https://docs.digitalocean.com/products/app-platform/details/pricing/),
[PostgreSQL pricing](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/),
[Lightsail pricing](https://aws.amazon.com/lightsail/pricing/)

### AWS estimate, us-east-1, 730 hours/month

| Item | Calculation | Monthly |
| --- | --- | ---: |
| Fargate ARM, 1 vCPU + 2 GB | (0.03238 + 2 × 0.00356) × 730 | $28.84 |
| RDS `db.t4g.small`, single AZ | 0.032 × 730 | $23.36 |
| RDS gp3, 20 GB | 20 × 0.115 | $2.30 |
| Application Load Balancer base | 0.0225 × 730 | $16.43 |
| Public IPv4, one task + two ALB addresses | 3 × 0.005 × 730 | $10.95 |
| Total, calculated before rounding line items | | **$81.87** |

This includes no NAT gateway: the task has a public address with inbound access
restricted to the ALB security group; RDS remains private. Account for ALB capacity
units, egress, cross-AZ traffic, logs/metrics, ECR image storage, DNS, and backup
storage beyond the included allowance. Public IP count can grow with scaling.
RDS burst CPU credits are another possible usage charge under sustained load.
The $90–100 figure is a planning allowance, not a cap.

For a smaller API, 0.5 vCPU/2 GB ARM lowers the fixed estimate to **$70.05**.
Only load tests can justify this size. A NAT gateway would add about **$32.85**
per month per AZ at $0.045/hour, plus its IPv4 and data-processing charges.

Rates were checked against the official regional price-list JSON:
[Fargate/ECS](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonECS/current/us-east-1/index.json),
[RDS](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonRDS/current/us-east-1/index.json).
See also [Fargate pricing](https://aws.amazon.com/fargate/pricing/),
[ALB pricing](https://aws.amazon.com/elasticloadbalancing/pricing/), and
[VPC/IPv4 pricing](https://aws.amazon.com/vpc/pricing/).

### Availability and geography change the comparison

Two Fargate ARM tasks and Multi-AZ `db.t4g.small` would be about **$140/month**
in this model before variable usage (two app tasks, DB at $0.065/hour, duplicated
storage, ALB, and four public IPv4 addresses). Budget roughly $150–175 at low
traffic. Application correctness still needs durable scheduling, safe retries,
connection recovery, migrations, and tested restores. Multi-AZ is not multi-region.

DigitalOcean is changing new PostgreSQL plans from October 15 for accounts that
have never created a cluster, and November 30 for all accounts. New Standard
Edition clusters lose standby/read-replica options; Advanced Edition is needed.
Do not assume today's $60 standard HA database will be available to this project
later. New shared-CPU Advanced plans launch October 15; confirm their actual
pricing before making a long-term HA comparison.

[DigitalOcean plan changes](https://docs.digitalocean.com/release-notes/upcoming/dbaas-plan-changes/)

Hetzner's June price changes also matter. Published US prices list CPX21 at
$37.49/month before IPv4/backups, while the European CX23 is $6.49. The cheap
European option can be excellent for an EU-hosted world, subject to capacity,
but does not establish an equally cheap US deployment. Region must follow player
latency and actual availability, not an attractive price in another geography.

[Hetzner current price adjustment table](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)

## When to revisit the decision

The selected DigitalOcean VM keeps initial costs low and leaves us responsible
for operations. Revisit managed services when observed load or availability needs
justify the premium. Keep Cloudflare static hosting independent of that choice.

Do not create game infrastructure until there is a game to run. Use a Rust modular
monolith, PostgreSQL, static TypeScript clients, and container images. Share the
Terraform and CI patterns across games. Benchmark realistic command bursts,
database contention, event backlog, and WebSocket connections before sizing.
Persistent game state and scheduled work must survive restarts and redeploys.

## Monitoring and cost controls

Use OpenTelemetry for the game and managed Grafana as a candidate telemetry sink.
Its free tier has finite ingestion and retention; keep error/audit history needed
for competitive disputes separately. Terraform should manage probes, dashboards,
alert rules, and retention settings once the monitoring account is selected.

Measure request error rate, p95/p99 latency, database connections/locks, event
processing lag, CPU/RAM/disk, backup freshness, and tested restore duration. Alert
on player-impacting failures. Keep telemetry label cardinality bounded: player IDs
belong in controlled logs/traces, not metric labels. Sample routine traces, cap
log volume/retention, and monitor the telemetry bill itself.

Start with fixed replica counts; explicitly bound autoscaling before enabling it.
Track actual spend and forecasts, tag resources per game/environment, shut down
unused development systems, and set a budget for each world. Budget alerts are
not hard spending limits. Avoid Kubernetes, NAT gateways, Redis, streaming systems,
and separate per-feature services until an observed need justifies their costs.

[Grafana free-tier scope](https://grafana.com/products/cloud/free-tier/)
