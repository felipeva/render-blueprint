# render-blueprint

Typed factories that describe Render.com resources and synthesize them to `render.yaml`.
It is a generator only: it never calls the Render API, and the committed file is the state.

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
