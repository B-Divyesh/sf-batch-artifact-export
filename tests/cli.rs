use assert_cmd::Command;
use predicates::prelude::*;
use std::fs;

#[test]
fn help_is_actionable() {
    Command::cargo_bin("batch-artifact-export")
        .unwrap()
        .arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("Validate local source artifacts"))
        .stdout(predicate::str::contains("Exit codes"));
}

#[test]
fn init_refuses_to_overwrite() {
    let dir = tempfile::tempdir().unwrap();
    let manifest = dir.path().join("batch-export.toml");
    Command::cargo_bin("batch-artifact-export")
        .unwrap()
        .current_dir(dir.path())
        .arg("init")
        .assert()
        .success();
    let original = fs::read_to_string(&manifest).unwrap();
    Command::cargo_bin("batch-artifact-export")
        .unwrap()
        .current_dir(dir.path())
        .arg("init")
        .assert()
        .code(2)
        .stderr(predicate::str::contains("already exists"));
    assert_eq!(fs::read_to_string(manifest).unwrap(), original);
}

#[test]
fn invalid_run_always_writes_a_report() {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("batch-export.toml"), "not = [valid").unwrap();
    Command::cargo_bin("batch-artifact-export")
        .unwrap()
        .current_dir(dir.path())
        .arg("run")
        .assert()
        .code(2);
    let report: serde_json::Value =
        serde_json::from_slice(&fs::read(dir.path().join("exports/report.json")).unwrap()).unwrap();
    assert_eq!(report["outcome"], "invalid");
    assert_eq!(report["errors"].as_array().unwrap().len(), 1);
}

#[cfg(unix)]
#[test]
fn exports_with_direct_arguments_and_reports_failures() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("one source.md"), "alpha").unwrap();
    fs::write(dir.path().join("bad.md"), "bad").unwrap();
    let converter = dir.path().join("copy converter.sh");
    fs::write(&converter, "#!/bin/sh\ncase \"$1\" in *bad.md) echo 'declared failure' >&2; exit 7;; esac\ncp \"$1\" \"$2\"\n").unwrap();
    let mut perms = fs::metadata(&converter).unwrap().permissions();
    perms.set_mode(0o755);
    fs::set_permissions(&converter, perms).unwrap();
    let manifest = format!(
        r#"version = 1
output_dir = "exports"
report = "exports/report.json"
[[converters]]
name = "copy"
command = "{}"
args = ["{{input}}", "{{output}}"]
output_extension = "pdf"
license = "MIT"
homepage = "https://example.test"
[[artifacts]]
source = "one source.md"
converter = "copy"
[[artifacts]]
source = "bad.md"
converter = "copy"
"#,
        converter.display()
    );
    fs::write(dir.path().join("batch-export.toml"), manifest).unwrap();
    Command::cargo_bin("batch-artifact-export")
        .unwrap()
        .current_dir(dir.path())
        .args(["run", "--sandbox", "off", "--jobs", "2", "--json"])
        .assert()
        .code(1)
        .stdout(predicate::str::contains("\"failed\":1"));
    assert_eq!(
        fs::read_to_string(dir.path().join("exports/one-source.pdf")).unwrap(),
        "alpha"
    );
    let report: serde_json::Value =
        serde_json::from_slice(&fs::read(dir.path().join("exports/report.json")).unwrap()).unwrap();
    assert_eq!(report["artifacts"][0]["status"], "ok");
    assert_eq!(report["artifacts"][1]["exit_code"], 7);
    assert!(report["artifacts"][1]["stderr"]
        .as_str()
        .unwrap()
        .contains("declared failure"));
}
