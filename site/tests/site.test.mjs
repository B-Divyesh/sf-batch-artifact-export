import test from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../validator.mjs";
import { readFile } from "node:fs/promises";

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

test("built Azure routes are unique after trailing-slash normalization", async () => {
  const config = JSON.parse(await readFile(new URL("../../dist/site/staticwebapp.config.json", import.meta.url), "utf8"));
  const normalized = config.routes.map(({ route }) => route.length > 1 ? route.replace(/\/$/, "") : route);
  assert.equal(new Set(normalized).size, normalized.length);
});
