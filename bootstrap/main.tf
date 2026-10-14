terraform {
  required_version = ">= 1.10, < 2.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.25"
    }
  }
}

provider "cloudflare" {}

variable "account_id" {
  type        = string
  description = "Cloudflare account with R2 enabled."
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.account_id))
    error_message = "Use the 32-character Cloudflare account ID."
  }
}

# Initially bootstrapped with local state; migrate its state into this bucket.
resource "cloudflare_r2_bucket" "state" {
  account_id = var.account_id
  name       = "unbought-terraform-state"
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_r2_managed_domain" "state" {
  account_id  = var.account_id
  bucket_name = cloudflare_r2_bucket.state.name
  enabled     = false
}

output "state_bucket" { value = cloudflare_r2_bucket.state.name }
