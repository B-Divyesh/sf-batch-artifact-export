import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("@claim:verified-installer accepts a matching checksum and rejects a changed archive", async () => {
  const root = await mkdtemp(join(tmpdir(), "bae-installer-test-"));
  try {
    const payload = join(root, "payload");
    const release = join(root, "release");
    const fakeBin = join(root, "bin");
    await Promise.all([mkdir(payload), mkdir(release), mkdir(fakeBin)]);
    const executable = join(payload, "batch-artifact-export");
    await writeFile(executable, '#!/bin/sh\nprintf "%s\\n" "batch-artifact-export 0.1.1"\n');
    await chmod(executable, 0o755);
    const archive = join(release, "batch-artifact-export-linux-x86_64.tar.gz");
    execFileSync("tar", ["-czf", archive, "-C", payload, "batch-artifact-export"]);
    const checksum = createHash("sha256").update(await readFile(archive)).digest("hex");
    await writeFile(join(release, "SHA256SUMS"), `${checksum}  batch-artifact-export-linux-x86_64.tar.gz\n`);
    const curl = join(fakeBin, "curl");
    await writeFile(curl, '#!/bin/sh\nout=""\nurl=""\nwhile [ "$#" -gt 0 ]; do\n  case "$1" in\n    -o) out=$2; shift 2 ;;\n    -*) shift ;;\n    *) url=$1; shift ;;\n  esac\ndone\ncp "$FIXTURE_RELEASE/${url##*/}" "$out"\n');
    await chmod(curl, 0o755);

    const installDir = join(root, "installed");
    const env = {
      ...process.env,
      PATH: `${fakeBin}:/usr/bin:/bin`,
      FIXTURE_RELEASE: release,
      BAE_RELEASE_BASE: "https://fixture.invalid",
      BAE_INSTALL_DIR: installDir,
    };
    const success = spawnSync("sh", ["install.sh"], { cwd: new URL("../../", import.meta.url), env, encoding: "utf8" });
    assert.equal(success.status, 0, success.stderr);
    assert.match(success.stdout, /Verified SHA-256/);
    assert.match(execFileSync(join(installDir, "batch-artifact-export"), ["--version"], { encoding: "utf8" }), /0\.1\.1/);

    await writeFile(join(release, "SHA256SUMS"), `${"0".repeat(64)}  batch-artifact-export-linux-x86_64.tar.gz\n`);
    const rejected = spawnSync("sh", ["install.sh"], {
      cwd: new URL("../../", import.meta.url),
      env: { ...env, BAE_INSTALL_DIR: join(root, "rejected") },
      encoding: "utf8",
    });
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /SHA-256 verification failed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
