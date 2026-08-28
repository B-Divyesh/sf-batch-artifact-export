# Batch Artifact Export v0.1.0 — handoff

## Shipped

- A Rust 2021 single-binary CLI with `init`, `check`, and `run` commands; useful command help; stable exit codes; concise `--json` output; and no telemetry or network code.
- Strict TOML manifests for local converter adapters and declared artifacts. Validation catches unknown fields/placeholders, missing or unreadable inputs, unsafe `..` paths, wrong extensions, duplicate converters, output collisions, missing license metadata, and source-overwrite attempts.
- Direct process spawning without a shell, read-only staged input copies, cleared child environments with explicit opt-ins, timeouts, bounded stdout/stderr capture, temporary outputs, success-only promotion, SHA-256 input/output hashes, deterministic report ordering, and optional network-disabled Bubblewrap isolation on Linux.
- A 100-artifact integration pilot, explicit mixed success/failure coverage, parse-failure reporting, normalization and collision tests, and compiled Rust documentation example.
- The distinct “calm drafting table” visual system recorded in `.factory/design.md`, with a generated factory-image blueprint illustration, locally hosted fonts, responsive dark/light treatments, and no stock/CDN assets.
- A static documentation site with detected-platform download, keyboard-operable install tabs, clipboard feedback, a local-only manifest preflight, loading/error/empty/success states, responsive 390 px layout, `/privacy/`, `/terms/`, CSP headers, hashed assets, and an offline service worker.
- SHA-verifying POSIX and PowerShell installers, Homebrew tap, Scoop bucket, winget submission manifests, static-musl tarball, `.deb`, `.rpm`, Windows portable zip, dual-architecture and universal macOS tarballs, and unsigned macOS `.pkg`.
- Public v0.1.0 release: <https://github.com/B-Divyesh/sf-batch-artifact-export/releases/tag/v0.1.0>
- Public Homebrew tap: <https://github.com/B-Divyesh/homebrew-batch-artifact-export>

## Run and verify

```sh
npm ci
npm test
npm run build
cargo clippy --all-targets -- -D warnings
cargo package
```

The deploy command is `npm run build:site`; its exact static root is `dist/site` with `index.html` at that root.

Local verification completed on 2026-08-28:

- Rust: 4 unit tests, 5 CLI integration tests (including a 100-artifact run), and 1 compiled doctest passed.
- Site: 3 manifest-validator tests and 8 Playwright checks across desktop Chrome and a 390 × 844 mobile viewport passed.
- Axe: zero serious or critical violations in both viewports.
- Clippy with warnings denied, `cargo fmt --check`, `cargo package`, `npm audit`, and the full production build passed.
- Lighthouse mobile: Performance 100, Accessibility 100, Best Practices 100, SEO 100; LCP 1.5 s, total blocking time 0 ms, CLS 0.001.
- Static budgets: initial app JS 4.9 KB plus validator 2.0 KB, CSS under 20 KB, fonts 39 KB total, hero 99 KB desktop / 39 KB mobile.
- Release workflow passed on Ubuntu, Windows, macOS arm64, and macOS x86_64. All eight binary/package assets were downloaded and matched `SHA256SUMS`; `latest.json` contains platform URLs and hashes. The released Linux binary executed as `batch-artifact-export 0.1.0`.
- The hosted `install.sh` path was exercised end to end against the GitHub Release in an isolated install directory; checksum verification and `--help` succeeded.

## Release/package commands

- GitHub tag: `v0.1.0`; future `v*` tags rebuild and publish every artifact through `.github/workflows/release.yml`.
- Cargo readiness: `cargo package` (registry publishing is intentionally not performed by the worker).
- Homebrew: `brew install B-Divyesh/batch-artifact-export/batch-artifact-export`.
- Scoop: `scoop bucket add batch-artifact-export https://github.com/B-Divyesh/sf-batch-artifact-export && scoop install batch-artifact-export`.
- Direct installers: `curl -fsSL https://batch-artifact-export.sociobot.in/install.sh | sh` or `irm https://batch-artifact-export.sociobot.in/install.ps1 | iex`.

## Needs operator action / known gaps

- Deploy `dist/site` through the factory. DNS and infrastructure were intentionally untouched.
- Submit the checked-in `winget/` manifests to `microsoft/winget-pkgs`; the owner must perform that external registry step.
- macOS `.pkg` and Windows executable are intentionally unsigned. Add Apple notarization and Windows Authenticode credentials in a future release if the owner obtains certificates. No signing secrets are currently expected or present.
- Linux sandboxing is best-effort in `auto` mode and requires `bwrap`; `--sandbox required` fails closed when it is unavailable. macOS and Windows still receive read-only staged copies and direct, non-shell invocation but no OS sandbox in v0.1.
