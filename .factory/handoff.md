# Batch Artifact Export v0.1.1 — repair handoff

## Status: READY FOR INDEPENDENT VERIFICATION

The two recorded acceptance defects are fixed in production. The site now sends the required security headers, gives hashed assets a one-year immutable cache, hides deployment configuration, and caches successful GitHub release details locally for one hour.

## Deployment and release identity

- Live URL: <https://batch-artifact-export.sociobot.in/>
- Live static implementation SHA: `bb263d547552533483425392632ad4c9dcc0adc8`
- CLI release tag: `v0.1.1`, built from `7c7620ccf276d0a3ae5b6cb478eeb65bc2d91cc3`
- Package-metadata commit: `6be7778`
- Azure Static Web Apps production deployment: `541cd5e4-53ab-430d-bfdd-01808d6f18fe`
- The first deployment attempt rejected duplicate normalized `/demo` routes before upload. Commit `bb263d5` removed the duplicate; the next deployment succeeded.
- The later handoff/evidence commit does not require a new product image because it changes only tests and documentation.

## Recorded findings and disposition

| Prior finding | Disposition | Live evidence |
|---|---|---|
| `_headers` was downloadable and not enforced | Fixed at the cause. The build emits `staticwebapp.config.json`, which Azure consumes during deployment. It no longer emits `_headers`. | `/_headers` and `/staticwebapp.config.json` return the designed HTTP 404. |
| CSP and Permissions-Policy were absent | Fixed. Both are Azure `globalHeaders`. | Live HTML and assets send CSP with `frame-ancestors 'none'`, plus `camera=(), microphone=(), geolocation=()`. |
| Referrer-Policy was wrong | Fixed. | Live responses send `Referrer-Policy: no-referrer`. |
| Hashed assets cached for 30 seconds | Fixed. | The live content-hashed app script sends `Cache-Control: public, max-age=31536000, immutable`. |
| Release metadata used `no-store` and no one-hour local cache | Fixed. Successful metadata uses `batch-artifact-export:release:v1` with a 3,600,000 ms TTL. Stale data remains an offline fallback. | A fresh real browser made one GitHub API request; a reload made none. The expiry regression forces a second request after one hour. |
| Required one-click sample was absent | Fixed under the attached contract. | `/demo` and the first-screen action load three realistic outputs, show the persistent sample banner, reset edits, and leave without saving sample content. |
| Required CLI demo was absent | Fixed. | `batch-artifact-export demo` runs three bundled inputs through the normal engine in a new temporary folder and prints its location. |
| Claims, standard metadata, sitemap, custom 404, and copy audit were absent | Fixed. | `.factory/claims.json`, `.factory/copy-audit.md`, canonical/Open Graph metadata, `robots.txt`, `sitemap.xml`, and the styled HTTP 404 are present and tested. |

The earlier CLI, packaging, checksum, accessibility, mobile, offline, and privacy findings remained passing. No prior minor finding was left open.

## Clean verification

A fresh clone of `origin/main` at `7c7620c` ran the documented prerequisites and every claim command. The post-deployment tree at `bb263d5` then passed the full gate with the normalized-route regression. The complete clean-clone log is `/work/.evidence/clean-check.log`.

```sh
npm ci
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
# every command in .factory/claims.json
npm test
npm run build
cargo package
```

Results:

- Rust: 4 library tests, 6 CLI integration tests, and 1 doctest passed.
- Site: 5 Node tests and 26 Playwright checks passed across desktop Chrome and a 390 × 844 phone viewport.
- All eight claim commands passed individually from the clean clone.
- `cargo package` verified the packaged crate, including bundled demo assets.
- `dist/site/index.html` and `dist/site/staticwebapp.config.json` exist; `dist/site/_headers` does not.
- All 22 public live payloads byte-match `dist/site`. The deployment-only config is correctly not public.

## Release and clean consumer

- GitHub Actions run `33997133803` passed all four OS/architecture builds, macOS universal assembly, and publishing.
- Eight binary/package artifacts matched the published `SHA256SUMS`.
- `latest.json` reports `v0.1.1` and valid SHA-256 values for Linux, Windows, and universal macOS.
- The live shell installer downloaded the Linux release, verified SHA-256 `99fe8483e61ae9da62d55f294d1281c1b37ba2895c737a72040af1b538f9f201`, and installed version `0.1.1` into an empty directory.
- That installed binary passed the bundled demo, a normal export with source preservation, invalid-manifest reporting, `--jobs 0`, and required-sandbox recovery with exit codes 0, 2, 2, and 3.
- Checked-in Homebrew, Scoop, and winget metadata points at the measured `v0.1.1` release hashes.

## Live browser, accessibility, privacy, and performance

- Fresh unmocked desktop and phone contexts identified the job, audience, and sample action before scrolling.
- The sample produced PDF, SVG, PNG, and JSON output labels; Reset restored the manifest; Start for real left demo mode.
- Desktop and phone each made one GitHub release request on first load and none on reload. Only the public release cache key existed; there were no cookies.
- Offline `/demo` reload passed after the first visit. Reduced motion, keyboard tab controls, focus, invalid/empty recovery, legal routes, and the HTTP 404 passed.
- Axe found zero serious or critical issues on `/`, `/demo`, `/privacy/`, `/terms/`, and the 404 at desktop and 390 px.
- No console or page errors were recorded. No horizontal overflow occurred at 390 px.
- Lighthouse mobile completed cleanly: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.214 s, LCP 1.390 s, TBT 0 ms, CLS 0.00085.
- Built budgets: app JS 9.9 KB raw / 3.3 KB gzip, validator JS 2.0 KB raw, CSS 21.0 KB raw / 4.8 KB gzip, fonts 39.8 KB total, mobile hero 38.9 KB, desktop hero 99.2 KB.

## Run and deploy

```sh
npm ci
npm test
npm run build
cargo package

npm run build:site
/opt/fleet/lib/deploy-static.sh batch-artifact-export /work/repo/dist/site
```

## Known gaps and operator action

- Submit the checked-in `winget/` manifests to `microsoft/winget-pkgs`.
- The macOS and Windows packages remain unsigned. Signing requires owner certificates that are not present in this repository.
- Linux `--sandbox auto` needs Bubblewrap. `--sandbox required` fails closed when Bubblewrap is unavailable.
- The separate Homebrew tap may need its checked-in formula copied by its owner; this work order did not modify resources outside `sf-batch-artifact-export*`.
- No billing action is needed. The researched product is free and has no paid offer.
