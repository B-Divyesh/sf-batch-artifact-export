# Batch Artifact Export verification 2 handoff

## Status: FAIL

Independent QA reviewed live implementation `bb263d50f056de8c1bc1592bdc2b6c09fd32f1d7`, documentation `2a02dcd9995535c0d6109b06b9b94511fc872fb8`, and release `v0.1.1`. Product code was not changed.

The full result is in `.factory/verification-2.md`: 9 findings and 6 untested public claims. The blocking user-facing defect is a keyboard trap in the manifest textarea. Mobile footer targets and several mobile text sizes also miss the attached baselines. Six material public promises need declared, complete claim tests or narrower copy.

## What passed

- All eight declared claim commands.
- `cargo fmt --all -- --check` and `cargo clippy --all-targets -- -D warnings`.
- `npm test`: 4 library tests, 6 CLI tests, 1 doctest, 5 Node tests, and 26 browser checks.
- `npm run build` and `cargo package`.
- The same 26 browser checks against the live URL.
- Fresh desktop and 390 × 844 phone sample flows, reset, leave, back/forward, invalid/empty recovery, offline reload, reduced motion, legal routes, links, and designed 404.
- Axe in light and dark schemes on every route: zero violations.
- Live CSP, Permissions-Policy, `no-referrer`, hidden deployment configuration, and one-year immutable hashed-asset caching.
- One-hour release metadata cache and calm GitHub API 429 fallback.
- All eight release artifact checksums and the three platform-specific download selections.
- Live POSIX install plus demo, normal export, invalid manifest, converter failure, job bounds, and required-sandbox recovery.
- Lighthouse: 100 in Performance, Accessibility, Best Practices, and SEO.

## Findings to repair

1. Let Tab and Shift+Tab leave the manifest textarea while retaining an optional, documented way to insert indentation.
2. Add at least 44 px touch targets to footer links.
3. Raise primary mobile editor and support text to the stated legibility baseline.
4. Add claim entries and isolated tests, or narrow/remove copy, for the PowerShell installer, Homebrew command, CLI no-network/no-telemetry behavior, successful Bubblewrap isolation, reproducible builds, and no-shell-interpolation behavior.

## How to verify

```sh
npm ci
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
npm test
npm run build
cargo package
PLAYWRIGHT_BASE_URL=https://batch-artifact-export.sociobot.in npx playwright test
```

Run each command in `.factory/claims.json` separately from a clean checkout. Then repeat the direct keyboard, touch-target, text-size, public-claim, release, and installed-consumer checks recorded in `.factory/verification-2.md`.

## Deployment and operator actions

- Live URL: <https://batch-artifact-export.sociobot.in/>
- The live payload byte-matches the reviewed implementation build.
- CLI release tag `v0.1.1` targets `7c7620ccf276d0a3ae5b6cb478eeb65bc2d91cc3`.
- Submit the checked-in winget manifests.
- macOS and Windows packages remain unsigned until owner certificates are available.
- Publish or confirm the Homebrew tap before advertising its install command as available.
- Linux `--sandbox auto` requires Bubblewrap; `--sandbox required` fails closed when it is unavailable.
- No billing or AI action is needed.
