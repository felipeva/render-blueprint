# Changelog

## 0.1.0

The first release. The package is ESM only: a consumer project sets `"type": "module"` or names
the blueprint `render.mts`.

### Added

- Typed factories for Render Blueprint resources: `web`, `privateService`, `worker`, `cron`,
  `staticSite`, `postgres` with its `readReplica`, `keyValue` and `envGroup`. `blueprint`,
  `project` and `environment` put them together.
- Environment values with `literal`, `secret` and `generated`, typed references between resources,
  `external` references to resources that the blueprint does not declare, and `withDefaults` for
  settings that many resources share.
- `synthesize` validates the blueprint and returns the `render.yaml` text with its warnings. An
  invalid blueprint fails with `BlueprintInvalid`, which carries every issue, not only the first.
  `writeBlueprint` writes the file, and `checkBlueprint` reports how the committed file drifted.
- The `render-blueprint` binary. `synth` writes `render.yaml`, and `check` exits 2 when the
  committed file has drifted. Both take `--file`, `--out` and `--strict`.
- `render-blueprint/testing` exports `memoryFilePort`, an in-memory file port for tests.
- `better-result` is a runtime dependency (`^3.0.1`) whose types are part of the public API:
  `synthesize`, `writeBlueprint` and `checkBlueprint` return its `Result`, and the exported error
  classes are built on its `TaggedErrorClass`. A new major version of `better-result` is a breaking
  change for this package too.
