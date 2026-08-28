# Batch Artifact Export — verification handoff

## Status: FAIL

Candidate `03c905b1537110dff867933c3101cdfaff4e8711` was independently verified on 2026-08-28 against <https://batch-artifact-export.sociobot.in/>. The core CLI and release are healthy, but the live deployment fails the required response-policy and caching acceptance gate.

The full evidence is in `.factory/verification.md`.

## What verified successfully

- Clean detached checkout: `npm ci`, formatting, Clippy with warnings denied, all tests, exact `npm run build`, and `cargo package --allow-dirty` passed.
- Test totals: 4 Rust units, 5 CLI integrations, 1 doctest, 3 site validator tests, and 8 Playwright checks passed.
- The real hosted installer SHA-256-verified and installed the released Linux binary into a clean consumer. Its public CLI passed normal export, validation failure, converter failure, jobs boundaries, and required-sandbox recovery paths with documented exit codes and JSON reports.
- All eight `v0.1.0` release/package assets matched `SHA256SUMS`; `latest.json` is valid.
- All 17 actual static payload files on the live site byte-match the candidate build. Desktop and 390px browser QA passed: no console/page errors, zero axe serious/critical issues, keyboard focus/tab behavior, reduced motion, no mobile overflow, and service-worker offline reload.
- No analytics/tracking, cookies, or unexpected browser egress were observed. The only external browser request is the documented GitHub release API lookup.

## Blocking defects

1. **High — deployment response policy is not applied.** The build creates `dist/site/_headers` with CSP, Permissions-Policy, `Referrer-Policy: no-referrer`, and immutable cache rules, but production serves it as a downloadable file. Live HTML, JS, CSS, fonts, service worker, and installers instead use `Cache-Control: public, must-revalidate, max-age=30`; lack CSP and Permissions-Policy; and send `Referrer-Policy: strict-origin-when-cross-origin`. Configure the deployment platform to enforce the generated rules (and stop serving `_headers`) before approval.
2. **Medium — release metadata is not locally cached for an hour.** The landing page fetches GitHub with `cache: "no-store"` and does not use localStorage, contrary to the installer landing-page contract.

## How to rerun

```sh
npm ci
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
npm test
npm run build
cargo package --allow-dirty
```

Then verify live headers with `curl -I https://batch-artifact-export.sociobot.in/` and a hashed asset, run live Playwright/axe checks at desktop and 390px, run the hosted installer in an empty `BAE_INSTALL_DIR`, and re-check every release asset against `SHA256SUMS`.

## Operator action

The factory deployment owner must apply the static header configuration and redeploy. The product owner must add the one-hour local release-metadata cache. No source or infrastructure fix was made by this verifier.
