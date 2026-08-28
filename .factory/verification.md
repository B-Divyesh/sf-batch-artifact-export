# Independent verification — FAIL

**Work order:** `batch-artifact-export-verify-1`  
**Candidate:** `03c905b1537110dff867933c3101cdfaff4e8711`  
**Live URL:** <https://batch-artifact-export.sociobot.in/>  
**Verified:** 2026-08-28 UTC  
**Method:** detached, clean clone at `/tmp/batch-artifact-export-qa.R4m438`; product code was not modified.

## Verdict

**FAIL.** The CLI, published release, static content, accessibility, and core browser flows work. The live deployment does not apply the candidate's required response-header and cache policy: it serves `dist/site/_headers` as a public file rather than enforcing it. This leaves the live site without its declared CSP and Permissions-Policy, uses the wrong Referrer-Policy, and applies only a 30-second cache lifetime to content-hashed static assets. The acceptance contract explicitly requires response-policy and caching verification, so this deployment-only defect blocks release acceptance.

## Checks that passed

### Clean checkout, test, lint, build, and package

From the detached clean clone at the exact candidate:

```sh
npm ci
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
npm test
npm run build
cargo package --allow-dirty
```

All commands passed. `npm test` passed 4 Rust unit tests, 5 CLI integration tests (including the 100-artifact pilot), 1 doctest, 3 site validator tests, and 8 Playwright checks (desktop plus 390 × 844 mobile). The exact production build created `dist/site/index.html`; `cargo package` created `target/package/batch-artifact-export-0.1.0.crate`.

### CLI, installer, package, and release

- Downloaded all eight `v0.1.0` release assets and ran `sha256sum --check SHA256SUMS`: all passed. `latest.json` is valid and contains Linux x86_64, Windows x86_64, and universal macOS URLs and SHA-256 values.
- Ran the actual hosted POSIX installer in an isolated directory. It downloaded `batch-artifact-export-linux-x86_64.tar.gz`, verified `80cd7839aba497f1d69d5a9901ed862217f8e135b54847423a3f0360210decba`, installed it, and reported `batch-artifact-export 0.1.0`.
- In the clean consumer project, a `cp` adapter exported `Release Notes v2!.md` with `--jobs 64 --sandbox off`; exit was 0, the input was preserved, output was deterministically named `exports/release-notes-v2.pdf`, and the JSON report recorded one success.
- Recovery/boundary probes used that installed public binary:

  | Case | Result |
  |---|---|
  | unsafe `output_dir = "../outside"` plus missing declarations | exit 2; JSON report written with all three validation errors |
  | converter exits 7 | exit 1; JSON report retains exit code 7 and stderr |
  | `--jobs 0` and `--jobs 65` | exit 2; helpful range error |
  | `--sandbox required` with no `bwrap` installed | exit 3; failure report written and no silent fallback |

### Live content, browser, privacy, and accessibility

- Rebuilt the candidate site and byte-compared every deployable payload to the live URL: all 17 files matched (`index.html`, hashed JS/CSS/fonts/images, service worker, legal pages, favicon, and both installers). The candidate's `_headers` file also matches the live file but is served as `application/octet-stream`, not consumed as deployment configuration.
- Playwright against the live site passed desktop and 390px mobile probes: no console errors or page errors; no horizontal overflow at 390px; keyboard Tab reaches the skip link with a visible `3px solid` outline; ArrowRight activates the Windows install tab; valid, invalid, and empty manifest-inspector states recover correctly; and reduced-motion media query is honored.
- Axe found **zero serious or critical** findings in both viewports. The page has one `h1`, a `main`, `lang=en`, title, labelled controls, and a working offline reload after service-worker activation.
- Browser requests outside the product origin were limited to the documented release lookup at `https://api.github.com/repos/B-Divyesh/sf-batch-artifact-export/releases/latest`. No analytics or other third-party runtime request was observed. Fresh contexts had no cookies and no localStorage entries. The CLI has no networking dependency/code path beyond user-declared external converters.
- Linux, Windows, and macOS user-agent probes selected real `v0.1.0` platform assets. The live primary download URL resolved to the correct Linux asset in the Linux probe.
- The product is static and exposes no product API/server endpoint, sign-in, persistence layer, or unlock call. Rate-limit burst testing and Entra authority validation are therefore not applicable.

### Budget and performance evidence

Built assets are within the static budget: initial app JS 5,286 B (validator module 1,970 B), CSS 18,773 B, all self-hosted fonts 39,816 B, desktop hero 99,180 B, mobile hero 38,854 B.

A mobile simulated Lighthouse run produced Performance 97, Accessibility 100, Best Practices 100, and SEO 100; FCP 1,052 ms, LCP 1,352 ms, TBT 183 ms, CLS 0.0007. Chromium crashed after Lighthouse collected the artifacts and wrote its JSON, so these figures are useful observations rather than a clean Lighthouse process exit. Direct Playwright console/error checks completed cleanly.

## Release/deployment identity

The public `v0.1.0` release exists and its tag points to `8f2f8b9cb8a5795ed963f5446425cdebd42158e4`, an ancestor of the candidate. The candidate's Rust CLI source and Cargo manifest are unchanged from that tag; its current static deployment payload is byte-for-byte the candidate build as noted above. The live website was last modified after the candidate and serves those current content hashes.

## Defects

| Severity | Defect | Fresh evidence and impact |
|---|---|---|
| High | Deployment ignores the generated header policy | The candidate emits `dist/site/_headers` declaring CSP, Permissions-Policy, `Referrer-Policy: no-referrer`, and immutable cache policy. Live `GET /_headers` returns that file as `application/octet-stream`. Live `GET /`, hashed JS/CSS/font assets, `/install.sh`, and `/sw.js` have no `Content-Security-Policy` or `Permissions-Policy`; Referrer-Policy is `strict-origin-when-cross-origin`, not `no-referrer`; and each has `Cache-Control: public, must-revalidate, max-age=30` rather than immutable long-lived caching. This is a live response-policy/security and cache-contract failure, despite the correct content payload. |
| Medium | Release metadata is not cached locally for an hour | `site/app.js` uses `fetch(RELEASE_API, { cache: "no-store" })`; a fresh live-browser context has `localStorageKeys: []`. The installer requirement calls for release metadata cached in localStorage for an hour, both to reduce GitHub dependency and to support the privacy/reliability behavior specified for the landing page. |

## Required follow-up before acceptance

1. Configure the factory static deployment to honor `_headers`, or translate those rules into the actual deployment platform's header configuration. Verify the live CSP, Permissions-Policy, `no-referrer`, and immutable hashed-asset headers with a fresh `curl -I` probe. Do not expose `_headers` as a downloadable production asset.
2. Update the landing-page release lookup to cache successful GitHub release metadata in localStorage for one hour and use it before the network request, retaining the existing calm offline fallback.
3. Redeploy and rerun this verification, especially header/caching probes and live-browser request checks.
