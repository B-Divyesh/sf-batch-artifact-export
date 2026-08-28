# Batch Artifact Export

One manifest and one command for reproducible local PDF, PNG, and SVG export. Batch Artifact Export is for technical writers, designers, and developers who already trust tools such as Pandoc, draw.io, or Inkscape, but need a consistent batch contract around them.

It never interprets a proprietary format. It validates declared inputs, invokes your converters without a shell, stages read-only source copies, normalizes output names, promotes only successful output files, and always writes one JSON run report.

## Install

macOS or Linux:

```sh
curl -fsSL https://batch-artifact-export.sociobot.in/install.sh | sh
```

Windows PowerShell:

```powershell
irm https://batch-artifact-export.sociobot.in/install.ps1 | iex
```

The installers select the current platform asset and verify its SHA-256 checksum before placing `batch-artifact-export` on `PATH`. Manual downloads and package-manager instructions are at <https://batch-artifact-export.sociobot.in>.

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

Use `batch-artifact-export run --json` for a compact summary on stdout. The full report is written even when validation or conversion fails. A non-zero exit means at least one artifact failed or the manifest was invalid. `--sandbox auto` uses Bubblewrap on Linux when available; `--sandbox required` fails closed if it is unavailable. `--jobs 4` runs independent exports concurrently while keeping report order deterministic.

Run `batch-artifact-export --help` and `batch-artifact-export <command> --help` for all flags and exit codes.

## Exit codes

| Code | Meaning |
|---:|---|
| 0 | every declared artifact succeeded |
| 1 | one or more conversions failed |
| 2 | manifest, input, or CLI usage was invalid |
| 3 | required sandbox support was unavailable |

## Safety and privacy

Sources remain local. The CLI has no telemetry and no network code. Each converter receives a read-only staged input in a per-job temporary directory; output is atomically moved into place after a successful exit. Converter executables are resolved directly and arguments are passed to the operating system without a shell. External converters are independent software: record their SPDX license and homepage in the manifest and review their handling of untrusted files.

## Develop and verify

Requirements: Rust 1.85+, Node 20+ (only for the dependency-free landing-site build).

```sh
npm install
npm test
npm run build       # release binary + site in dist/site
cargo package --allow-dirty
```

`npm run dev` serves the site at `http://127.0.0.1:4173`. Release artifacts are built only in GitHub Actions; see `.github/workflows/release.yml`.

## Deploy

The static deployment root is `dist/site` and is produced exactly by:

```sh
npm run build:site
```

No backend, analytics, cookies, payments, or user accounts are used.

## License

MIT. External converters keep their own licenses and are never bundled.
