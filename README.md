# Batch Artifact Export

Export many local files to PDF, PNG, and SVG with one manifest and one command.

Batch Artifact Export is for technical writers, designers, and developers who need repeatable review files. It wraps converters such as Pandoc, draw.io, and Inkscape behind one batch contract.

The CLI validates inputs, runs converters without a shell, normalizes output names, and writes one JSON report. It promotes only successful outputs and preserves every source file.

## Try the bundled sample

```sh
batch-artifact-export demo
```

The command runs three bundled source files in a new temporary folder. It creates PDF, SVG, and PNG review files, then prints the folder path.

The browser demo at <https://batch-artifact-export.sociobot.in/demo> shows the same completed run without setup. Demo changes are kept only in the current page.

## Install

macOS or Linux:

```sh
curl -fsSL https://batch-artifact-export.sociobot.in/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://batch-artifact-export.sociobot.in/install.ps1 | iex
```

The installers select the current platform asset and verify its SHA-256 checksum before installation. Manual downloads and package-manager instructions are on the product website.

Homebrew:

```sh
brew install B-Divyesh/batch-artifact-export/batch-artifact-export
```

Scoop:

```powershell
scoop bucket add batch-artifact-export https://github.com/B-Divyesh/sf-batch-artifact-export
scoop install batch-artifact-export
```

GitHub Releases also provides `.deb`, `.rpm`, an unsigned universal macOS `.pkg`, separate macOS architecture archives, and a portable Windows zip. Until signing certificates are configured, macOS users may need Control-click → Open and Windows may show a SmartScreen notice. Verify `SHA256SUMS` before bypassing either warning. The `winget/` directory contains manifests ready for owner submission.

## Usage

Create a starter manifest, inspect it, then export:

```sh
batch-artifact-export init
batch-artifact-export check
batch-artifact-export run
```

`batch-export.toml`:

```toml
version = 1
output_dir = "exports"
report = "exports/report.json"

[[converters]]
name = "markdown-pdf"
command = "pandoc"
args = ["{input}", "--output", "{output}", "--pdf-engine=xelatex"]
output_extension = "pdf"
license = "GPL-2.0-or-later"
homepage = "https://pandoc.org"

[[artifacts]]
source = "docs/launch-notes.md"
converter = "markdown-pdf"
output = "launch-notes.pdf" # optional; normalized when omitted
```

Placeholders are individual process arguments, never interpolated by a shell:

| Placeholder | Value |
|---|---|
| `{input}` | read-only staged copy of the source |
| `{output}` | temporary output promoted only after success |
| `{stem}` | normalized source stem |
| `{source_name}` | original source filename |
| `{manifest_dir}` | directory containing the manifest |

Use `batch-artifact-export run --json` for a compact summary on standard output. The full report is written when validation or conversion fails.

A non-zero exit means an artifact failed or the manifest was invalid. `--sandbox auto` uses Bubblewrap on Linux when available. `--sandbox required` stops when Bubblewrap is unavailable. `--jobs 4` runs exports concurrently while keeping report order stable.

Run `batch-artifact-export --help` and `batch-artifact-export <command> --help` for all flags and exit codes.

## Exit codes

| Code | Meaning |
|---:|---|
| 0 | every declared artifact succeeded |
| 1 | one or more conversions failed |
| 2 | manifest, input, or CLI usage was invalid |
| 3 | required sandbox support was unavailable |

## Safety and privacy

The CLI sends no product telemetry. Each converter receives a read-only staged input in a temporary job directory.

Output moves into place only after a successful exit. Converter arguments pass to the operating system without a shell. External converters may use the network or process untrusted content differently. Record each converter's SPDX license and homepage, then review its security guidance.

## Develop and verify

Requirements: Rust 1.85+ and Node 20+.

```sh
npm ci
npm test
npm run build       # release binary + site in dist/site
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo package
```

`npm run dev` builds and serves the site at `http://127.0.0.1:4173`. Release artifacts are built only in GitHub Actions.

## Deploy

The static deployment root is `dist/site` and is produced exactly by:

```sh
npm run build:site
```

The deployment uses Azure Static Web Apps configuration from the build output. There is no backend, analytics, payment, or user account.

## License

MIT. External converters keep their own licenses and are never bundled.
