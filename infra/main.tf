terraform {
  required_version = ">= 1.10, < 2.0"

  backend "s3" {
    bucket                      = "unbought-terraform-state"
    key                         = "www/terraform.tfstate"
    region                      = "auto"
    use_lockfile                = true
    use_path_style              = true
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    # R2 endpoint is supplied at init. Credentials come from environment variables.
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.25"
    }
  }
}

provider "cloudflare" {} # CLOUDFLARE_API_TOKEN, never a committed credential.

variable "account_id" {
  type        = string
  description = "Cloudflare account containing both existing DNS zones."
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.account_id))
    error_message = "Use the 32-character Cloudflare account ID."
  }
}

variable "zone_ids" {
  type = object({
    games = string
    com   = string
  })
  description = "Existing zone IDs: games = unbought.games, com = unboughtgames.com."
}

resource "cloudflare_pages_project" "www" {
  account_id        = var.account_id
  name              = "unbought-www"
  production_branch = "main"
  # Direct Upload: Terraform owns infrastructure; CI uploads public/ with Wrangler.
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_pages_domain" "primary" {
  account_id   = var.account_id
  project_name = cloudflare_pages_project.www.name
  name         = "unbought.games"
}

resource "cloudflare_dns_record" "primary" {
  zone_id    = var.zone_ids.games
  name       = "unbought.games"
  type       = "CNAME"
  content    = cloudflare_pages_project.www.subdomain
  proxied    = true
  ttl        = 1
  depends_on = [cloudflare_pages_domain.primary]
}

locals {
  aliases = {
    "www.unbought.games"    = var.zone_ids.games
    "unboughtgames.com"     = var.zone_ids.com
    "www.unboughtgames.com" = var.zone_ids.com
  }
}

# Proxied, reserved documentation IP: the redirect executes at the edge.
resource "cloudflare_dns_record" "aliases" {
  for_each = local.aliases
  zone_id  = each.value
  name     = each.key
  type     = "A"
  content  = "192.0.2.1"
  proxied  = true
  ttl      = 1
}

# One entrypoint per zone/phase. Import and merge existing redirect rules first.
resource "cloudflare_ruleset" "canonical" {
  for_each = { games = var.zone_ids.games, com = var.zone_ids.com }
  zone_id  = each.value
  name     = "Unbought canonical website"
  kind     = "zone"
  phase    = "http_request_dynamic_redirect"
  rules = [{
    ref         = "unbought_canonical"
    description = "Permanent HTTPS canonical URL; retain path and query"
    expression  = "(http.host in {\"www.unbought.games\" \"unboughtgames.com\" \"www.unboughtgames.com\"}) or (http.host eq \"unbought.games\" and not ssl)"
    action      = "redirect"
    enabled     = true
    action_parameters = {
      from_value = {
        status_code           = 301
        preserve_query_string = true
        target_url = {
          expression = "concat(\"https://unbought.games\", http.request.uri.path)"
        }
      }
    }
  }]
}

output "site_url" { value = "https://unbought.games" }
output "pages_project" { value = cloudflare_pages_project.www.name }
