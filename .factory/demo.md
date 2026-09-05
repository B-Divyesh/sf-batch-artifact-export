# Demo sandbox

## Browser demo

- URL: `https://batch-artifact-export.sociobot.in/demo`
- Entry point: select **Try it with sample data** on the first screen.
- Sample: three source files become `release-notes.pdf`, `system-map.svg`, and `app-icon.png`, plus one JSON report.
- State: the browser demo uses in-memory page state and never reads or writes user data. Release metadata uses the separate `batch-artifact-export:release:v1` local-storage key.
- Reset: **Reset demo** restores the sample manifest and output view. **Start for real** discards the sample state and opens installation instructions.

## CLI demo

Run:

```sh
batch-artifact-export demo
```

The command creates a new operating-system temporary folder, copies the bundled files from `examples/demo/`, and runs the normal batch engine. It prints the retained sample folder so each output and `review/report.json` can be inspected. It does not read or write the current project.
