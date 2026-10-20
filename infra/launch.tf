# AWS infrastructure owns the Elastic IP and SES identity. These public values
# come from that stack; this state owns only their unbought.games DNS records.
resource "cloudflare_dns_record" "accounts" {
  zone_id = var.zone_ids.games
  name    = "accounts.unbought.games"
  type    = "A"
  content = "77.114.19.207"
  proxied = false
  ttl     = 300
}

resource "cloudflare_dns_record" "ses_dkim" {
  for_each = toset([
    "asbizytcfvla6wpljgrr5fdi5pejh4sm",
    "vo5buv4acjq6gasymu7c65yqvmlhr4r2",
    "pzch52ee4ci72cvawhbsmgx4bpgudthj",
  ])
  zone_id = var.zone_ids.games
  name    = "${each.value}._domainkey.unbought.games"
  type    = "CNAME"
  content = "${each.value}.dkim.amazonses.com"
  proxied = false
  ttl     = 300
}
