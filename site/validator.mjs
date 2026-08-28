const REQUIRED_CONVERTER = ["name", "command", "args", "output_extension", "license", "homepage"];
const REQUIRED_ARTIFACT = ["source", "converter"];

function blocks(text, marker) {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\[\\[${escaped}\\]\\]\\s*$`, "gm");
  const matches = [...text.matchAll(pattern)];
  return matches.map((match, index) => text.slice(match.index + match[0].length, matches[index + 1]?.index ?? text.length));
}

function hasAssignment(block, key) {
  return new RegExp(`^\\s*${key}\\s*=`, "m").test(block);
}

export function validateManifest(text) {
  if (!text.trim()) return { state: "empty", errors: [], converters: 0, artifacts: 0 };
  const errors = [];
  if (!/^\s*version\s*=\s*1\s*$/m.test(text)) errors.push("Set `version = 1` at the top level.");
  if (!/^\s*output_dir\s*=\s*"[^"]+"\s*$/m.test(text)) errors.push("Declare a quoted `output_dir`.");
  if (!/^\s*report\s*=\s*"[^"]+"\s*$/m.test(text)) errors.push("Declare a quoted JSON `report` path.");
  const converters = blocks(text, "converters");
  const artifacts = blocks(text, "artifacts");
  if (!converters.length) errors.push("Add at least one `[[converters]]` block.");
  if (!artifacts.length) errors.push("Add at least one `[[artifacts]]` block.");
  converters.forEach((block, index) => REQUIRED_CONVERTER.forEach((key) => {
    if (!hasAssignment(block, key)) errors.push(`Converter ${index + 1} is missing \`${key}\`.`);
  }));
  artifacts.forEach((block, index) => REQUIRED_ARTIFACT.forEach((key) => {
    if (!hasAssignment(block, key)) errors.push(`Artifact ${index + 1} is missing \`${key}\`.`);
  }));
  if (converters.some((block) => !block.includes("{input}") || !block.includes("{output}"))) errors.push("Every converter needs `{input}` and `{output}` argument placeholders.");
  return { state: errors.length ? "invalid" : "valid", errors, converters: converters.length, artifacts: artifacts.length };
}
