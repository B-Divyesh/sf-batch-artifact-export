# Batch Artifact Export verification 2 — FAIL

**Work order:** `batch-artifact-export-verify-2`  
**Verdict:** **FAIL**  
**Finding count:** 9  
**Untested claim count:** 6  
**Live URL:** <https://batch-artifact-export.sociobot.in/>  
**Implementation reviewed:** `bb263d50f056de8c1bc1592bdc2b6c09fd32f1d7`  
**Documentation reviewed:** `2a02dcd9995535c0d6109b06b9b94511fc872fb8`  
**Release reviewed:** `v0.1.1` from `7c7620ccf276d0a3ae5b6cb478eeb65bc2d91cc3`  
**Verified:** 2026-09-05 UTC

## Verdict

**FAIL.** The real CLI job, published release, sample flows, deployment headers, release cache, accessibility automation, and performance checks pass. Acceptance still fails because there are three interface findings and six public claims without complete declared claim tests. The work order permits PASS only with zero findings and zero untested claims.

The verification used a detached clean clone at `/tmp/batch-artifact-export-verify2.ou42a0`. Product code was not changed.

## First screen

Before scrolling in fresh desktop and 390 × 844 phone contexts, the page states:

- Job: “Export many files with one command.”
- Audience: technical writers, designers, and developers who need repeatable PDF, PNG, and SVG review files.
- First action: “Try it with sample data,” with a note that it loads three sample files and their results.

The action is fully visible in both viewports. Both contexts show one `h1`, one `main`, `lang="en"`, the correct route title, and no horizontal overflow.

## Findings

| ID | Severity | Finding | Evidence and impact |
|---|---|---|---|
| V2-01 | High | The manifest editor is a keyboard trap. | On live `/demo`, focus the TOML textarea and press Tab or Shift+Tab. Both keys leave focus on `#manifest-input` and insert spaces. A keyboard user cannot move to “Check manifest,” “Reset demo,” or “Start for real” without a pointer. This violates the attached no-keyboard-trap requirement. |
| V2-02 | Medium | The public Windows installer verification claim is not completely tested. | The landing page says each installer verifies SHA-256, and README documents the PowerShell installer. Claim `verified-installer` runs only `install.sh`; no declared claim command executes `install.ps1`, its checksum rejection, PATH update, or installed Windows artifact. |
| V2-03 | Medium | The published Homebrew command is untested while its required tap remains an operator action. | The landing page and README present `brew install B-Divyesh/batch-artifact-export/batch-artifact-export` as an install path. There is no claim entry or clean-consumer test for that command, and the prior handoff says the tap formula may still need copying by its owner. No out-of-scope tap resource was accessed during this review. |
| V2-04 | Medium | The CLI no-network and no-telemetry promise has no declared claim test. | The first screen says files stay local, the privacy page says the CLI sends no telemetry, and `--help` says “No network and no telemetry.” The registered privacy tests cover the website, not process-level CLI network behavior. |
| V2-05 | Medium | Successful Bubblewrap isolation is a public but untested claim. | The landing page and README say `--sandbox auto` isolates on Linux when Bubblewrap is present. Tests cover the fail-closed path when Bubblewrap is unavailable, but no claim entry installs Bubblewrap and proves a successful isolated conversion. |
| V2-06 | Medium | Reproducible-build wording has no reproducibility test. | The landing page says builds are reproducible in public GitHub Actions. The workflow and successful release run prove public builds, but no claim entry compares two independent build outputs. |
| V2-07 | Medium | The no-shell-interpolation safety promise has no declared claim test. | The landing page, README, and CLI help say converter arguments are passed directly without shell interpolation. Source inspection shows direct process construction, but no claim entry runs an injection-shaped filename or argument and proves that shell syntax is inert. |
| V2-08 | Low | Footer links miss the required 44 × 44 CSS-pixel touch target. | At 390 px, Privacy measures 43 × 21.7 px, Terms 39 × 21.7 px, and MIT license 75 × 21.7 px. The same footer appears on `/`, `/demo`, `/privacy/`, `/terms/`, and the 404 page. |
| V2-09 | Low | Several mobile task and support texts are below the stated 17 px baseline. | At 390 px, the manifest textarea is 12 px, its help is 13 px, install commands are 13 px, the action note is 15 px, and the footer is 14 px. The editor is primary task content, not decorative text. This conflicts with the attached mobile legibility baseline and the design document’s “body never drops below 16 px” rule. |

## Declared claim commands

Every command in `.factory/claims.json` ran exactly from the clean checkout after `npm ci`.

| Claim | Command result |
|---|---|
| `hundred-artifact-batch` | PASS — 100 outputs, 100 report entries, unchanged source. |
| `complete-failure-report` | PASS — one success, one failure, exit code 7 and stderr retained. |
| `cli-demo-sandbox` | PASS — real PDF, PNG, SVG and JSON report in a temporary folder; current folder unchanged. |
| `demo-sandbox` | PASS — one-click sample, persistent label, realistic output, reset, leave, and isolated storage. |
| `manifest-local` | PASS — private marker was not sent. |
| `verified-installer` | PASS for the POSIX shell installer — valid checksum accepted and changed checksum rejected. It does not cover the public PowerShell claim; see V2-02. |
| `release-cache-hour` | PASS — reload used the cache; an entry older than 3,600,000 ms refreshed. |
| `site-privacy` | PASS — no cookies and no saved sample manifest text. |

The six public claims in V2-02 through V2-07 are not represented by complete sandbox tests, so `untested_claim_count` is 6.

## Demo and browser paths

- Fresh, unmocked desktop and phone contexts made one GitHub release request, stored only `batch-artifact-export:release:v1`, and made no second request on reload.
- The one-click demo showed “Demo — sample data, nothing is saved,” `3 succeeded · 0 failed`, PDF, PNG, SVG, and JSON output labels.
- A private marker entered into the sample was removed by Reset and never appeared in local storage. Start for real hid the demo label and focused the install heading.
- Valid, invalid, empty, reset, back, forward, offline reload, release API 429 fallback, and reduced-motion paths passed.
- Privacy, Terms, and the designed HTTP 404 had the correct title, one `h1`, one `main`, and a route back. The 404 response itself is expected, not a defect.
- All crawled links returned 200 except the deliberate 404 URL.
- No unexpected console or page errors occurred. Chromium logged its normal failed-resource line only while intentionally loading the 404.

## Accessibility and performance

- `/opt/fleet/lib/verify-url.sh` passed: title, `lang`, one `h1`, `main`, image alt text, labelled buttons, and no load-time console errors.
- Playwright axe reported zero violations, including zero serious or critical violations, on `/`, `/demo`, `/privacy/`, `/terms/`, and the 404 in light and dark schemes at desktop and phone sizes.
- The skip link receives a visible `3px solid rgb(0, 109, 143)` focus outline. Tab-list arrow keys work. Back and forward restore route focus. Reduced motion disables scrolling, entrance animation, and transitions.
- A 195 CSS-pixel viewport, used as a 200% mobile reflow check, had no page-level horizontal overflow on any route.
- Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; FCP 1.117 s, LCP 1.275 s, TBT 0 ms, CLS 0.000845.
- Built initial assets remain under budget: app JS 9.9 KB raw, validator JS 2.0 KB raw, CSS 21.0 KB raw, fonts 39.8 KB total, and mobile hero 38.9 KB.

Automated accessibility scores do not clear V2-01, V2-08, or V2-09; those findings come from direct keyboard and computed-layout checks.

## Clean checkout and release

These gates passed from the clean checkout:

```sh
npm ci
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
# every command in .factory/claims.json
npm test
npm run build
cargo package
```

`npm test` passed 4 library tests, 6 CLI tests, 1 doctest, 5 Node tests, and 26 Playwright checks. The live 26-check suite also passed in both projects.

All eight `v0.1.1` binary/package artifacts matched `SHA256SUMS`. `latest.json` is valid for Linux x86-64, Windows x86-64, and universal macOS. Linux, Windows, and macOS browser identities each selected a real 200-response asset. The public release workflow run `33997133803` completed successfully.

The live POSIX installer downloaded the Linux archive, verified SHA-256 `99fe8483e61ae9da62d55f294d1281c1b37ba2895c737a72040af1b538f9f201`, and installed version `0.1.1` into an empty directory. The installed binary then passed:

- the bundled demo with valid PDF, PNG, SVG, and three-entry JSON output while leaving its consumer folder empty;
- a normal export with deterministic naming, JSON output, `--jobs 64`, and source preservation;
- invalid manifest recovery with exit 2 and a failure report;
- converter exit 7 recovery with process exit 1, retained stderr, and no promoted failed output;
- `--jobs 0` and `--jobs 65` boundaries with exit 2;
- required-sandbox recovery with exit 3 and a failure report.

## Deployment and prior findings

Every public payload from the clean build byte-matched the live response. The documentation commit differs from the implementation only in handoff and test configuration; it does not require another product image.

| Earlier finding | Current disposition |
|---|---|
| Deployment served `_headers` instead of enforcing policy | Fixed. `/_headers` and `/staticwebapp.config.json` return the designed 404. |
| CSP and Permissions-Policy absent | Fixed. Live HTML and assets send both policies; CSP includes `frame-ancestors 'none'`. |
| Wrong referrer policy | Fixed. Live responses send `Referrer-Policy: no-referrer`. |
| Hashed assets cached for only 30 seconds | Fixed. The live hashed app script sends `public, max-age=31536000, immutable`. |
| Release metadata not cached for one hour | Fixed. Fresh contexts made one request, reload made none, and the expiry claim test passed. |
| Earlier demo, metadata, route, copy-audit, CLI, packaging, checksum, offline, and privacy checks | Fixed or still passing, as detailed above. |

## Not applicable and operator actions

This is a static site and local CLI. It has no product backend, tenant storage, SQLite state, account system, paid tier, or product API. Backend tenant isolation, restart persistence, health endpoints, and product-server 429 checks do not apply. The GitHub release lookup’s 429 recovery passed. The brief does not benefit from an AI feature, so no AI runtime check applies.

Existing operator actions remain documented: submit winget manifests, add owner signing certificates, and publish or confirm the Homebrew tap. The Homebrew public command remains an acceptance finding until it has a declared clean-consumer test or is clearly marked unavailable.

## Evidence

- `/work/.evidence/qa-report.md`
- `/work/.evidence/qa-result.json`
- `/work/.evidence/lighthouse.json`
- `/work/.evidence/verify.json`
- `/work/.evidence/screenshot-desktop.png`
- `/work/.evidence/screenshot-mobile.png`
- `/work/.evidence/phone-live.png`
