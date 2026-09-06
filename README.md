# render-blueprint

Typed factories that describe Render.com resources and synthesize them to `render.yaml`.
It is a generator only: it never calls the Render API, and the committed file is the state.

## Command line

The package installs a `render-blueprint` binary. Both commands find your blueprint by walking up
from the working directory for `render.ts`, then `render.mts`, `render.js`, `render.mjs`, taking
the first one they meet; `--file` names one directly instead. The file is imported through Node's
native type stripping, so it needs no build step, and it must default-export the value
`blueprint(...)` returns.

```sh
render-blueprint synth    # write the YAML file
render-blueprint check    # compare the committed YAML file against the blueprint
```

| Flag              | What it does                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `--file <path>`   | The blueprint file, instead of the one the walk finds.                                                          |
| `--out <path>`    | The YAML file to write or compare. Defaults to `render.yaml` beside the blueprint file.                         |
| `--strict`        | Treat validation warnings as a failure. It applies to both commands: `synth` still writes the file, then fails. |
| `--help`, `-h`    | Print the help. `render-blueprint --help` lists the commands; `render-blueprint synth --help` describes one.    |
| `--version`, `-v` | Print the installed version.                                                                                    |

| Exit code | Meaning                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0         | The file was written, or the committed file is clean.                                                                                                    |
| 1         | The blueprint is invalid, a file could not be found, loaded, read or written, the command line was wrong, or `--strict` turned a warning into a failure. |
| 2         | The committed file has drifted from the blueprint.                                                                                                       |

Naming no command at all prints the help and exits 1, because a command line that asks for nothing
is a command line that got something wrong.

`check` is the CI command: exit 2 says the committed file is stale, and exit 1 says something is
broken, which is why they are different numbers. Drift is judged after normalizing both sides, so
a reformatted file that says the same thing is still clean, and the diff it prints is of the
normalized text rather than of either file on disk. Changes to fields Render cannot alter in place
are listed separately after the diff.

Because the blueprint is loaded through type stripping and not compiled, it must use erasable
TypeScript syntax: no enums, no namespaces, no parameter properties. Node 22.18.0 or newer is
required, and the binary says so and exits 1 on anything older.

## Develop

```sh
pnpm install
git config core.hooksPath .githooks
pnpm check
pnpm build
```

`pnpm check` runs the format check, lint, `tsc --noEmit`, the runtime tests and the type tests.
It is the definition of done for every change.

The `core.hooksPath` line installs the `commit-msg` hook that rejects any commit message that is
not a Conventional Commits subject. Run it once per clone.

`pnpm build` emits the ESM bundle, its declaration files and the `render-blueprint` bin into `dist/`.
