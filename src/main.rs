use batch_artifact_export::{
    load_manifest, run, validate, validation_report, write_parse_failure, write_report, RunOptions,
    SandboxMode, DEFAULT_MANIFEST,
};
use clap::{Parser, Subcommand, ValueEnum};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

const STARTER: &str = r#"version = 1
output_dir = "exports"
report = "exports/report.json"

[[converters]]
name = "markdown-pdf"
command = "pandoc"
args = ["{input}", "--output", "{output}"]
output_extension = "pdf"
license = "GPL-2.0-or-later"
homepage = "https://pandoc.org"
timeout_seconds = 120

[[artifacts]]
source = "docs/example.md"
converter = "markdown-pdf"
# output = "example.pdf" # optional; defaults to a normalized source name
"#;

#[derive(Parser)]
#[command(
    name = "batch-artifact-export",
    version,
    about = "Reproducible batch exports through the converters you already trust",
    long_about = "Validate local source artifacts, run format-specific converters without shell interpolation, normalize output names, and emit one complete JSON report. No network and no telemetry.",
    after_help = "Exit codes: 0 all exports succeeded; 1 conversion failure; 2 invalid manifest or usage; 3 required sandbox unavailable."
)]
struct Cli {
    /// Manifest path, resolved relative to the current directory.
    #[arg(short, long, global = true, default_value = DEFAULT_MANIFEST)]
    manifest: PathBuf,
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Write a documented starter manifest without overwriting an existing file.
    Init,
    /// Validate manifest syntax, inputs, converters, output names, and dependencies.
    Check {
        /// Print a machine-readable JSON result.
        #[arg(long)]
        json: bool,
    },
    /// Run all declared exports and write the JSON report.
    Run {
        /// Number of converters to run concurrently.
        #[arg(long, default_value_t = 1, value_parser = parse_jobs)]
        jobs: usize,
        /// Linux isolation policy. Auto uses Bubblewrap when installed.
        #[arg(long, value_enum, default_value_t = SandboxArg::Auto)]
        sandbox: SandboxArg,
        /// Print the summary as JSON for CI scripting.
        #[arg(long)]
        json: bool,
    },
}

#[derive(Clone, Copy, ValueEnum)]
enum SandboxArg {
    Off,
    Auto,
    Required,
}

fn parse_jobs(value: &str) -> Result<usize, String> {
    let jobs: usize = value
        .parse()
        .map_err(|_| "jobs must be an integer from 1 to 64".to_string())?;
    if (1..=64).contains(&jobs) {
        Ok(jobs)
    } else {
        Err("jobs must be from 1 to 64".into())
    }
}
impl From<SandboxArg> for SandboxMode {
    fn from(value: SandboxArg) -> Self {
        match value {
            SandboxArg::Off => Self::Off,
            SandboxArg::Auto => Self::Auto,
            SandboxArg::Required => Self::Required,
        }
    }
}

#[derive(Serialize)]
struct Summary<'a> {
    outcome: &'a str,
    succeeded: usize,
    failed: usize,
    report: &'a str,
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match cli.command {
        Commands::Init => init(&cli.manifest),
        Commands::Check { json } => check(&cli.manifest, json),
        Commands::Run {
            jobs,
            sandbox,
            json,
        } => execute(&cli.manifest, jobs, sandbox.into(), json),
    }
}

fn init(path: &Path) -> ExitCode {
    if path.exists() {
        eprintln!("error: {} already exists; nothing changed", path.display());
        return ExitCode::from(2);
    }
    if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
        if let Err(e) = fs::create_dir_all(parent) {
            eprintln!("error: cannot create {}: {e}", parent.display());
            return ExitCode::from(2);
        }
    }
    match fs::write(path, STARTER) {
        Ok(()) => {
            println!("Created {}\nNext: edit the converter and artifact entries, then run `batch-artifact-export check`.", path.display());
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("error: cannot write {}: {e}", path.display());
            ExitCode::from(2)
        }
    }
}

fn check(path: &Path, json: bool) -> ExitCode {
    let loaded = match load_manifest(path) {
        Ok(v) => v,
        Err(e) => {
            print_check(false, &[e], json);
            return ExitCode::from(2);
        }
    };
    let mut errors = validate(&loaded);
    if errors.is_empty() {
        for converter in &loaded.manifest.converters {
            if which::which(&converter.command).is_err() {
                errors.push(format!(
                    "converter executable not found on PATH: {}",
                    converter.command
                ));
            }
        }
    }
    let valid = errors.is_empty();
    print_check(valid, &errors, json);
    if valid {
        ExitCode::SUCCESS
    } else {
        ExitCode::from(2)
    }
}

fn print_check(valid: bool, errors: &[String], json: bool) {
    if json {
        println!("{}", serde_json::json!({"valid": valid, "errors": errors}));
    } else if valid {
        println!("✓ Manifest is valid; inputs and converter executables are available.");
    } else {
        eprintln!("Manifest check failed with {} error(s):", errors.len());
        for error in errors {
            eprintln!("  - {error}");
        }
    }
}

fn execute(path: &Path, jobs: usize, sandbox: SandboxMode, json: bool) -> ExitCode {
    let loaded = match load_manifest(path) {
        Ok(v) => v,
        Err(e) => {
            let report = write_parse_failure(path, &e);
            eprintln!("error: {e}");
            if let Ok(path) = report {
                eprintln!("Failure report: {}", path.display());
            }
            return ExitCode::from(2);
        }
    };
    let report = match run(&loaded, &RunOptions { jobs, sandbox }) {
        Ok(v) => v,
        Err(e) if e.contains("sandbox required") => {
            let failure = validation_report(&loaded, vec![e.clone()]);
            match write_report(&loaded, &failure) {
                Ok(path) => eprintln!("error: {e}\nFailure report: {}", path.display()),
                Err(report_error) => eprintln!("error: {e}\nerror: {report_error}"),
            }
            return ExitCode::from(3);
        }
        Err(e) => {
            let failure = validation_report(&loaded, vec![e.clone()]);
            match write_report(&loaded, &failure) {
                Ok(path) => eprintln!("error: {e}\nFailure report: {}", path.display()),
                Err(report_error) => eprintln!("error: {e}\nerror: {report_error}"),
            }
            return ExitCode::from(2);
        }
    };
    let report_path = match write_report(&loaded, &report) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: {e}");
            return ExitCode::from(2);
        }
    };
    if json {
        println!(
            "{}",
            serde_json::to_string(&Summary {
                outcome: &report.outcome,
                succeeded: report.succeeded,
                failed: report.failed,
                report: &report_path.display().to_string()
            })
            .expect("summary JSON")
        );
    } else {
        println!(
            "{} {} succeeded · {} failed",
            if report.failed == 0 { "✓" } else { "✗" },
            report.succeeded,
            report.failed
        );
        println!("Report: {}", report_path.display());
        for error in &report.errors {
            eprintln!("  - {error}");
        }
        for artifact in report.artifacts.iter().filter(|a| a.status != "ok") {
            eprintln!(
                "  - {}: {}",
                artifact.source,
                artifact.error.as_deref().unwrap_or("conversion failed")
            );
        }
    }
    if report.outcome == "invalid" {
        ExitCode::from(2)
    } else if report.failed > 0 {
        ExitCode::from(1)
    } else {
        ExitCode::SUCCESS
    }
}
