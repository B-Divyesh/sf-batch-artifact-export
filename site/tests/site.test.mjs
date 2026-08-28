import test from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../validator.mjs";

const valid = `version = 1
output_dir = "exports"
report = "exports/report.json"
[[converters]]
name = "copy"
command = "copy"
args = ["{input}", "{output}"]
output_extension = "pdf"
license = "MIT"
homepage = "https://example.test"
[[artifacts]]
source = "one.md"
converter = "copy"`;

test("validates the documented contract", () => {
  assert.deepEqual(validateManifest(valid), { state: "valid", errors: [], converters: 1, artifacts: 1 });
});

test("treats a blank sheet as a first-class state", () => {
  assert.equal(validateManifest(" \n" ).state, "empty");
});

test("reports missing fields and placeholders", () => {
  const result = validateManifest(valid.replace('license = "MIT"', "").replace("{output}", "out.pdf"));
  assert.equal(result.state, "invalid");
  assert.ok(result.errors.some((error) => error.includes("license")));
  assert.ok(result.errors.some((error) => error.includes("{output}")));
});
