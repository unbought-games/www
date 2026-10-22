# Website journey measurement

`config/analytics.json` contains only a public property token and property/policy
configuration. `scripts/analytics.mjs` injects the same self-hosted SDK into every
published HTML page, including news/archive/policy pages. Local and preview origins
remain silent. The SDK is installed from a checked-in MIT package tarball with npm
lockfile integrity, independent of unpublished registry availability.

The configured identified profile can retain pseudonymous browser identifiers and
campaign touches for the collector's policy window. Outbound normal same-tab links
to the configured Accounts and game origins carry short-lived, audience-bound
handoff references in fragments. Modified/new-tab/download links retain normal
behavior and may not carry attribution. This static property does not identify a
logged-in account directly or redeem inbound capabilities; account attribution is
verified at Accounts and joined through campaign provenance. No account IDs, raw
query strings, form text, cookies, fingerprinting or replay are captured.

GPC and DNT disable collection. The operator's settings/disclosure UI can use
`window.unboughtAnalytics.disable()` to withdraw and persist local disable state;
`coverage()` exposes delivery/loss counters. Disclosure wording belongs to the
operator. No banner is introduced.

The collector must have the matching policy version, all nine SDK schemas and
allowlisted destination properties before this configuration is published. The
public token expires at `tokenExpiresAt`; renew it through authenticated engine
administration and rebuild before that date. Public tokens never grant querying,
identity administration or server ingestion. Website CSP must permit the collector
in `connect-src`; both the source `_headers` and AWS response-header policy are
updated. A stale policy or failed collector disables measurement without blocking
navigation. Rollback can disable the property or restore the prior configuration.

Validation: `npm run check` covers every generated page, local asset budgets and
security headers. SDK browser regressions live in the analytics repository.
