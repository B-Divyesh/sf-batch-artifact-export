//! Core manifest and export engine for Batch Artifact Export.
//!
//! The library is intentionally small: load a [`Manifest`], call [`validate`],
//! then execute it through [`run`]. Converter commands are spawned directly;
//! no shell parses their arguments.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::ffi::OsString;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tempfile::Builder;
use wait_timeout::ChildExt;

pub const DEFAULT_MANIFEST: &str = "batch-export.toml";
pub const REPORT_SCHEMA: u8 = 1;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Manifest {
    pub version: u8,
    #[serde(default = "default_output_dir")]
    pub output_dir: PathBuf,
    #[serde(default = "default_report")]
    pub report: PathBuf,
    #[serde(default)]
    pub converters: Vec<Converter>,
    #[serde(default)]
    pub artifacts: Vec<Artifact>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Converter {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub output_extension: String,
    pub license: String,
    pub homepage: String,
    #[serde(default = "default_timeout")]
    pub timeout_seconds: u64,
    #[serde(default)]
    pub environment: BTreeMap<String, String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Artifact {
    pub source: PathBuf,
    pub converter: String,
    pub output: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SandboxMode {
    Off,
    Auto,
    Required,
}

#[derive(Debug, Clone)]
pub struct RunOptions {
    pub jobs: usize,
    pub sandbox: SandboxMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunReport {
    pub schema_version: u8,
    pub manifest: String,
    pub outcome: String,
    pub succeeded: usize,
    pub failed: usize,
    pub converters: Vec<ConverterDisclosure>,
    pub artifacts: Vec<ArtifactReport>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConverterDisclosure {
    pub name: String,
    pub command: String,
    pub license: String,
    pub homepage: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactReport {
    pub source: String,
    pub output: String,
    pub converter: String,
    pub status: String,
    pub sandboxed: bool,
    pub exit_code: Option<i32>,
    pub duration_ms: u128,
    pub input_sha256: Option<String>,
    pub output_sha256: Option<String>,
    pub error: Option<String>,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug)]
pub struct LoadedManifest {
    pub manifest: Manifest,
    pub path: PathBuf,
    pub directory: PathBuf,
}

#[derive(Debug, Clone)]
struct PreparedArtifact {
    index: usize,
    source_relative: PathBuf,
    source: PathBuf,
    output_relative: PathBuf,
    output: PathBuf,
    converter: Converter,
}

fn default_output_dir() -> PathBuf {
    PathBuf::from("exports")
}
fn default_report() -> PathBuf {
    PathBuf::from("exports/report.json")
}
fn default_timeout() -> u64 {
    120
}

/// Parse a TOML manifest and retain its canonical working directory.
pub fn load_manifest(path: &Path) -> Result<LoadedManifest, String> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|e| format!("cannot read current directory: {e}"))?
            .join(path)
    };
    let text = fs::read_to_string(&absolute)
        .map_err(|e| format!("cannot read manifest {}: {e}", absolute.display()))?;
    let manifest: Manifest = toml::from_str(&text)
        .map_err(|e| format!("invalid TOML in {}: {e}", absolute.display()))?;
    let directory = absolute.parent().unwrap_or(Path::new(".")).to_path_buf();
    Ok(LoadedManifest {
        manifest,
        path: absolute,
        directory,
    })
}

/// Validate structure, dependencies, sources, placeholders, and output collisions.
pub fn validate(loaded: &LoadedManifest) -> Vec<String> {
    let mut errors = Vec::new();
    let m = &loaded.manifest;
    if m.version != 1 {
        errors.push(format!(
            "unsupported manifest version {}; expected 1",
            m.version
        ));
    }
    if m.converters.is_empty() {
        errors.push("no converters declared".into());
    }
    if m.artifacts.is_empty() {
        errors.push("no artifacts declared".into());
    }
    if m.output_dir.is_absolute() || contains_parent(&m.output_dir) {
        errors.push("output_dir must be relative and cannot contain ..".into());
    }
    if m.report.is_absolute() || contains_parent(&m.report) {
        errors.push("report must be relative and cannot contain ..".into());
    }

    let mut names = HashSet::new();
    for converter in &m.converters {
        if converter.name.trim().is_empty() {
            errors.push("converter name cannot be empty".into());
        }
        if !names.insert(converter.name.to_ascii_lowercase()) {
            errors.push(format!("duplicate converter name: {}", converter.name));
        }
        if converter.command.trim().is_empty() {
            errors.push(format!("converter {} has an empty command", converter.name));
        }
        if !converter.args.iter().any(|a| a.contains("{input}")) {
            errors.push(format!(
                "converter {} args must contain {{input}}",
                converter.name
            ));
        }
        if !converter.args.iter().any(|a| a.contains("{output}")) {
            errors.push(format!(
                "converter {} args must contain {{output}}",
                converter.name
            ));
        }
        if converter.output_extension.is_empty()
            || converter.output_extension.contains(['/', '\\', '.'])
        {
            errors.push(format!(
                "converter {} has an invalid output_extension",
                converter.name
            ));
        }
        if converter.license.trim().is_empty() || converter.homepage.trim().is_empty() {
            errors.push(format!(
                "converter {} must declare license and homepage",
                converter.name
            ));
        }
        if converter.timeout_seconds == 0 {
            errors.push(format!(
                "converter {} timeout_seconds must be greater than zero",
                converter.name
            ));
        }
        for arg in &converter.args {
            for token in placeholders(arg) {
                if !matches!(
                    token.as_str(),
                    "input" | "output" | "stem" | "source_name" | "manifest_dir"
                ) {
                    errors.push(format!(
                        "converter {} uses unknown placeholder {{{}}}",
                        converter.name, token
                    ));
                }
            }
        }
    }

    let by_name: HashMap<_, _> = m.converters.iter().map(|c| (c.name.as_str(), c)).collect();
    let mut outputs = HashSet::new();
    for (index, artifact) in m.artifacts.iter().enumerate() {
        let label = format!("artifact {} ({})", index + 1, artifact.source.display());
        if artifact.source.is_absolute() || contains_parent(&artifact.source) {
            errors.push(format!(
                "{label}: source must be relative and cannot contain .."
            ));
        } else {
            let source = loaded.directory.join(&artifact.source);
            match fs::metadata(&source) {
                Ok(meta) if meta.is_file() => {}
                Ok(_) => errors.push(format!("{label}: source is not a regular file")),
                Err(e) => errors.push(format!("{label}: source is not readable: {e}")),
            }
        }
        let Some(converter) = by_name.get(artifact.converter.as_str()) else {
            errors.push(format!("{label}: unknown converter {}", artifact.converter));
            continue;
        };
        let output = output_name(artifact, converter);
        if output.is_absolute() || contains_parent(&output) {
            errors.push(format!(
                "{label}: output must be relative and cannot contain .."
            ));
        }
        let ext = output.extension().and_then(|s| s.to_str()).unwrap_or("");
        if !ext.eq_ignore_ascii_case(&converter.output_extension) {
            errors.push(format!(
                "{label}: output extension must be .{}",
                converter.output_extension
            ));
        }
        let collision_key = output
            .to_string_lossy()
            .replace('\\', "/")
            .to_ascii_lowercase();
        if !outputs.insert(collision_key) {
            errors.push(format!(
                "{label}: output collides with another artifact: {}",
                output.display()
            ));
        }
        let final_output = loaded.directory.join(&m.output_dir).join(&output);
        if final_output == loaded.directory.join(&artifact.source) {
            errors.push(format!("{label}: output would overwrite its source file"));
        }
    }
    errors
}

/// Convert a filename stem to a stable lowercase ASCII artifact name.
pub fn normalize_stem(value: &str) -> String {
    let mut output = String::new();
    let mut separator = false;
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            if separator && !output.is_empty() {
                output.push('-');
            }
            output.push(ch.to_ascii_lowercase());
            separator = false;
        } else {
            separator = true;
        }
    }
    output
        .trim_matches('-')
        .to_string()
        .chars()
        .take(96)
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

pub fn output_name(artifact: &Artifact, converter: &Converter) -> PathBuf {
    if let Some(path) = &artifact.output {
        return path.clone();
    }
    let raw = artifact
        .source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("artifact");
    let stem = normalize_stem(raw);
    PathBuf::from(format!(
        "{}.{}",
        if stem.is_empty() { "artifact" } else { &stem },
        converter.output_extension.to_ascii_lowercase()
    ))
}

/// Execute all artifacts and return a deterministic report in manifest order.
pub fn run(loaded: &LoadedManifest, options: &RunOptions) -> Result<RunReport, String> {
    let errors = validate(loaded);
    if !errors.is_empty() {
        return Ok(validation_report(loaded, errors));
    }
    let output_root = resolve(&loaded.directory, &loaded.manifest.output_dir);
    fs::create_dir_all(&output_root).map_err(|e| {
        format!(
            "cannot create output directory {}: {e}",
            output_root.display()
        )
    })?;
    let sandbox_available = cfg!(target_os = "linux") && which::which("bwrap").is_ok();
    if options.sandbox == SandboxMode::Required && !sandbox_available {
        return Err(
            "sandbox required, but Bubblewrap (bwrap) is unavailable on this platform".into(),
        );
    }

    let by_name: HashMap<_, _> = loaded
        .manifest
        .converters
        .iter()
        .map(|c| (c.name.clone(), c.clone()))
        .collect();
    let prepared: Vec<_> = loaded
        .manifest
        .artifacts
        .iter()
        .enumerate()
        .map(|(index, artifact)| {
            let converter = by_name
                .get(&artifact.converter)
                .expect("validated converter")
                .clone();
            let output_relative = output_name(artifact, &converter);
            PreparedArtifact {
                index,
                source_relative: artifact.source.clone(),
                source: loaded.directory.join(&artifact.source),
                output: output_root.join(&output_relative),
                output_relative,
                converter,
            }
        })
        .collect();

    let count = prepared.len();
    let tasks = Arc::new(prepared);
    let results: Arc<Mutex<Vec<Option<ArtifactReport>>>> = Arc::new(Mutex::new(vec![None; count]));
    let next = Arc::new(AtomicUsize::new(0));
    let workers = options.jobs.max(1).min(count.max(1));
    let use_sandbox = options.sandbox != SandboxMode::Off && sandbox_available;
    thread::scope(|scope| {
        for _ in 0..workers {
            let tasks = Arc::clone(&tasks);
            let results = Arc::clone(&results);
            let next = Arc::clone(&next);
            let manifest_dir = loaded.directory.clone();
            let output_root = output_root.clone();
            scope.spawn(move || loop {
                let index = next.fetch_add(1, Ordering::Relaxed);
                if index >= tasks.len() {
                    break;
                }
                let task = &tasks[index];
                let report = execute_one(task, &manifest_dir, &output_root, use_sandbox);
                results.lock().expect("results lock")[task.index] = Some(report);
            });
        }
    });
    let artifacts: Vec<_> = Arc::try_unwrap(results)
        .expect("workers complete")
        .into_inner()
        .expect("results lock")
        .into_iter()
        .map(|r| r.expect("worker result"))
        .collect();
    let failed = artifacts.iter().filter(|r| r.status != "ok").count();
    let succeeded = artifacts.len() - failed;
    Ok(RunReport {
        schema_version: REPORT_SCHEMA,
        manifest: loaded.path.display().to_string(),
        outcome: if failed == 0 { "ok" } else { "failed" }.into(),
        succeeded,
        failed,
        converters: disclosures(&loaded.manifest),
        artifacts,
        errors: Vec::new(),
    })
}

pub fn validation_report(loaded: &LoadedManifest, errors: Vec<String>) -> RunReport {
    RunReport {
        schema_version: REPORT_SCHEMA,
        manifest: loaded.path.display().to_string(),
        outcome: "invalid".into(),
        succeeded: 0,
        failed: loaded.manifest.artifacts.len(),
        converters: disclosures(&loaded.manifest),
        artifacts: Vec::new(),
        errors,
    }
}

pub fn write_report(loaded: &LoadedManifest, report: &RunReport) -> Result<PathBuf, String> {
    let path = resolve(&loaded.directory, &loaded.manifest.report);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("cannot create report directory {}: {e}", parent.display()))?;
    }
    let bytes =
        serde_json::to_vec_pretty(report).map_err(|e| format!("cannot serialize report: {e}"))?;
    atomic_write(&path, &bytes)
        .map_err(|e| format!("cannot write report {}: {e}", path.display()))?;
    Ok(path)
}

pub fn write_parse_failure(manifest_path: &Path, message: &str) -> Result<PathBuf, String> {
    let directory = manifest_path.parent().unwrap_or(Path::new("."));
    let path = directory.join("exports/report.json");
    let report = RunReport {
        schema_version: REPORT_SCHEMA,
        manifest: manifest_path.display().to_string(),
        outcome: "invalid".into(),
        succeeded: 0,
        failed: 0,
        converters: Vec::new(),
        artifacts: Vec::new(),
        errors: vec![message.into()],
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("cannot create report directory: {e}"))?;
    }
    atomic_write(
        &path,
        &serde_json::to_vec_pretty(&report).map_err(|e| e.to_string())?,
    )
    .map_err(|e| format!("cannot write failure report: {e}"))?;
    Ok(path)
}

fn execute_one(
    task: &PreparedArtifact,
    manifest_dir: &Path,
    output_root: &Path,
    sandboxed: bool,
) -> ArtifactReport {
    let started = Instant::now();
    let input_hash = sha256_file(&task.source).ok();
    let mut report = ArtifactReport {
        source: task.source_relative.display().to_string(),
        output: task.output_relative.display().to_string(),
        converter: task.converter.name.clone(),
        status: "failed".into(),
        sandboxed,
        exit_code: None,
        duration_ms: 0,
        input_sha256: input_hash,
        output_sha256: None,
        error: None,
        stdout: String::new(),
        stderr: String::new(),
    };
    if let Some(parent) = task.output.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            report.error = Some(format!("cannot create output directory: {e}"));
            return finish(report, started);
        }
    }
    let work_root = output_root.join(".batch-artifact-export-work");
    if let Err(e) = fs::create_dir_all(&work_root) {
        report.error = Some(format!("cannot create work directory: {e}"));
        return finish(report, started);
    }
    let temp = match Builder::new().prefix("job-").tempdir_in(&work_root) {
        Ok(v) => v,
        Err(e) => {
            report.error = Some(format!("cannot create job directory: {e}"));
            return finish(report, started);
        }
    };
    let staged = temp
        .path()
        .join(task.source.file_name().unwrap_or_default());
    if let Err(e) = fs::copy(&task.source, &staged) {
        report.error = Some(format!("cannot stage input: {e}"));
        return finish(report, started);
    }
    if let Ok(meta) = fs::metadata(&staged) {
        let mut perms = meta.permissions();
        perms.set_readonly(true);
        let _ = fs::set_permissions(&staged, perms);
    }
    let temp_output = temp
        .path()
        .join(format!("result.{}", task.converter.output_extension));
    let executable = match which::which(&task.converter.command) {
        Ok(v) => v,
        Err(e) => {
            report.error = Some(format!(
                "converter executable '{}' not found: {e}",
                task.converter.command
            ));
            return finish(report, started);
        }
    };
    let args: Vec<OsString> = task
        .converter
        .args
        .iter()
        .map(|arg| {
            substitute(
                arg,
                &staged,
                &temp_output,
                &task.source_relative,
                manifest_dir,
            )
        })
        .collect();
    let stdout_path = temp.path().join("stdout.log");
    let stderr_path = temp.path().join("stderr.log");
    let stdout = match File::create(&stdout_path) {
        Ok(v) => v,
        Err(e) => {
            report.error = Some(format!("cannot create stdout capture: {e}"));
            return finish(report, started);
        }
    };
    let stderr = match File::create(&stderr_path) {
        Ok(v) => v,
        Err(e) => {
            report.error = Some(format!("cannot create stderr capture: {e}"));
            return finish(report, started);
        }
    };

    let mut command = if sandboxed {
        let mut c = Command::new("bwrap");
        c.args([
            "--die-with-parent",
            "--new-session",
            "--unshare-net",
            "--unshare-pid",
            "--unshare-ipc",
            "--unshare-uts",
            "--ro-bind",
            "/",
            "/",
            "--dev",
            "/dev",
            "--proc",
            "/proc",
        ])
        .arg("--bind")
        .arg(temp.path())
        .arg(temp.path())
        .arg("--chdir")
        .arg(temp.path())
        .arg("--")
        .arg(&executable);
        c
    } else {
        Command::new(&executable)
    };
    command
        .args(&args)
        .current_dir(temp.path())
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));
    command.env_clear();
    if let Some(path) = std::env::var_os("PATH") {
        command.env("PATH", path);
    }
    for (key, value) in &task.converter.environment {
        command.env(key, value);
    }
    let mut child = match command.spawn() {
        Ok(v) => v,
        Err(e) => {
            report.error = Some(format!("cannot start converter: {e}"));
            return finish(report, started);
        }
    };
    let timeout = Duration::from_secs(task.converter.timeout_seconds);
    let status = match child.wait_timeout(timeout) {
        Ok(Some(status)) => status,
        Ok(None) => {
            let _ = child.kill();
            let status = child.wait().ok();
            report.exit_code = status.and_then(|s| s.code());
            report.error = Some(format!(
                "converter timed out after {} seconds",
                task.converter.timeout_seconds
            ));
            read_logs(&stdout_path, &stderr_path, &mut report);
            return finish(report, started);
        }
        Err(e) => {
            report.error = Some(format!("cannot wait for converter: {e}"));
            read_logs(&stdout_path, &stderr_path, &mut report);
            return finish(report, started);
        }
    };
    report.exit_code = status.code();
    read_logs(&stdout_path, &stderr_path, &mut report);
    if !status.success() {
        report.error = Some(format!(
            "converter exited with {}",
            status
                .code()
                .map_or_else(|| "a signal".into(), |v| format!("code {v}"))
        ));
        return finish(report, started);
    }
    if !temp_output.is_file() {
        report.error =
            Some("converter reported success but did not create the declared output".into());
        return finish(report, started);
    }
    report.output_sha256 = sha256_file(&temp_output).ok();
    if let Err(e) = replace_output(&temp_output, &task.output) {
        report.error = Some(format!("cannot promote output: {e}"));
        return finish(report, started);
    }
    report.status = "ok".into();
    finish(report, started)
}

fn disclosures(manifest: &Manifest) -> Vec<ConverterDisclosure> {
    manifest
        .converters
        .iter()
        .map(|c| ConverterDisclosure {
            name: c.name.clone(),
            command: c.command.clone(),
            license: c.license.clone(),
            homepage: c.homepage.clone(),
        })
        .collect()
}
fn finish(mut report: ArtifactReport, started: Instant) -> ArtifactReport {
    report.duration_ms = started.elapsed().as_millis();
    report
}
fn resolve(base: &Path, path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else {
        base.join(path)
    }
}
fn contains_parent(path: &Path) -> bool {
    path.components().any(|c| matches!(c, Component::ParentDir))
}
fn placeholders(value: &str) -> Vec<String> {
    let mut found = Vec::new();
    let mut rest = value;
    while let Some(start) = rest.find('{') {
        let after = &rest[start + 1..];
        if let Some(end) = after.find('}') {
            found.push(after[..end].to_string());
            rest = &after[end + 1..];
        } else {
            break;
        }
    }
    found
}
fn substitute(
    template: &str,
    input: &Path,
    output: &Path,
    source: &Path,
    manifest_dir: &Path,
) -> OsString {
    let stem = normalize_stem(
        source
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("artifact"),
    );
    OsString::from(
        template
            .replace("{input}", &input.to_string_lossy())
            .replace("{output}", &output.to_string_lossy())
            .replace("{stem}", &stem)
            .replace(
                "{source_name}",
                &source.file_name().unwrap_or_default().to_string_lossy(),
            )
            .replace("{manifest_dir}", &manifest_dir.to_string_lossy()),
    )
}
fn sha256_file(path: &Path) -> io::Result<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    io::copy(&mut file, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}
fn read_logs(stdout: &Path, stderr: &Path, report: &mut ArtifactReport) {
    report.stdout = read_limited(stdout);
    report.stderr = read_limited(stderr);
}
fn read_limited(path: &Path) -> String {
    let mut data = Vec::new();
    if let Ok(file) = File::open(path) {
        let _ = file.take(65_536).read_to_end(&mut data);
    }
    String::from_utf8_lossy(&data).into_owned()
}
fn atomic_write(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = path.parent().unwrap_or(Path::new("."));
    let mut temp = Builder::new().prefix(".report-").tempfile_in(parent)?;
    use std::io::Write;
    temp.write_all(bytes)?;
    temp.as_file_mut().sync_all()?;
    temp.persist(path).map_err(|e| e.error)?;
    Ok(())
}

#[cfg(not(windows))]
fn replace_output(source: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(source, destination)
}

#[cfg(windows)]
fn replace_output(source: &Path, destination: &Path) -> io::Result<()> {
    let backup = destination.with_extension(format!(
        "{}.previous",
        destination
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or("out")
    ));
    if destination.exists() {
        fs::rename(destination, &backup)?;
    }
    match fs::rename(source, destination) {
        Ok(()) => {
            let _ = fs::remove_file(backup);
            Ok(())
        }
        Err(e) => {
            if backup.exists() {
                let _ = fs::rename(backup, destination);
            }
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(dir: &Path) -> LoadedManifest {
        fs::write(dir.join("Draft Notes!!.md"), "hello").unwrap();
        LoadedManifest {
            path: dir.join(DEFAULT_MANIFEST),
            directory: dir.to_path_buf(),
            manifest: Manifest {
                version: 1,
                output_dir: "out".into(),
                report: "out/report.json".into(),
                converters: vec![Converter {
                    name: "copy".into(),
                    command: "copy".into(),
                    args: vec!["{input}".into(), "{output}".into()],
                    output_extension: "pdf".into(),
                    license: "MIT".into(),
                    homepage: "https://example.com".into(),
                    timeout_seconds: 30,
                    environment: BTreeMap::new(),
                }],
                artifacts: vec![Artifact {
                    source: "Draft Notes!!.md".into(),
                    converter: "copy".into(),
                    output: None,
                }],
            },
        }
    }
    #[test]
    fn names_are_portable_and_stable() {
        assert_eq!(normalize_stem("  Release Notes_v2!! "), "release-notes-v2");
        assert_eq!(normalize_stem("日本語"), "");
    }
    #[test]
    fn derives_output_from_source() {
        let dir = tempfile::tempdir().unwrap();
        let loaded = fixture(dir.path());
        assert_eq!(
            output_name(
                &loaded.manifest.artifacts[0],
                &loaded.manifest.converters[0]
            ),
            PathBuf::from("draft-notes.pdf")
        );
        assert!(validate(&loaded).is_empty());
    }
    #[test]
    fn detects_collisions_and_unknown_placeholders() {
        let dir = tempfile::tempdir().unwrap();
        let mut loaded = fixture(dir.path());
        loaded
            .manifest
            .artifacts
            .push(loaded.manifest.artifacts[0].clone());
        loaded.manifest.converters[0].args.push("{mystery}".into());
        let errors = validate(&loaded).join("\n");
        assert!(errors.contains("collides"));
        assert!(errors.contains("unknown placeholder"));
    }
    #[test]
    fn rejects_parent_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let mut loaded = fixture(dir.path());
        loaded.manifest.artifacts[0].source = "../secret.md".into();
        assert!(validate(&loaded)
            .iter()
            .any(|e| e.contains("cannot contain ..")));
    }
}
