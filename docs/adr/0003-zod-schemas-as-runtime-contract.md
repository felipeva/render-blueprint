# ADR-0003: Zod schemas are the runtime contract for resource configs

Status: accepted
Date: 2026-09-06

## Context

ADR-0002 has the CLI load the user's blueprint through Node type stripping, which strips
types without checking them. A user who never runs `tsc`, or who writes the blueprint in
JavaScript, gets none of the compile-time guarantees the factories provide. The toolchain
research declined a schema library because the library had "no untrusted boundary"; the CLI is
that boundary. Value rules the type system cannot express (scaling bounds, ranges, disk size
multiples, name formats) also need a home that reports every problem at once.

A spike against TypeScript 7.0.2 with `isolatedDeclarations`, `exactOptionalPropertyTypes`,
and `noUncheckedIndexedAccess` established:

- Schema-first types (`z.infer` of an exported or module-private schema reachable from an
  exported type) do not compile under `isolatedDeclarations` (TS9010, TS9013), in `tsc` and in
  tsdown alike.
- Typing a schema as `z.ZodType<HandWrittenInterface>` fails under `exactOptionalPropertyTypes`.
- Annotating an exported schema with its concrete `z.ZodObject<...>` type compiles but is
  unsound: the schema body can gain a field the annotation does not name.
- A hand-written interface plus a module-private schema built with `.readonly()` and
  `.exactOptional()` infers exactly `readonly x?: T`, nested included, and a compile-time
  identity guard proves the two equal under every repo flag.

## Decision

- Every resource config has a hand-written public interface and a module-private Zod schema in
  the same file as its factory. The schema uses `.readonly()` and `.exactOptional()` so its
  inferred type is identical to the interface. A compile-time identity guard, exported as a
  `true` constant, fails the build when they diverge. The schema is never reachable from an
  exported declaration's type.
- `validate` parses every resource's config with its schema before the rule functions run.
  Each Zod issue maps to a `ValidationIssue` with the resource and the joined field path;
  unrecognized keys are special-cased to recover the field name. All issues surface at once.
- Value rules are refinements on the schema. Cross-resource rules stay as rule functions.
- The full `zod` entry is used. `zod/mini` and `compile()` are not: readability outweighs size
  for a Node library, and the ahead-of-time path buys nothing at tens of resources.
- A test diffs each enum against Render's published schema through `z.toJSONSchema`.

## Consequences

- Zod 4.5 becomes a runtime dependency, never bundled.
- Factories stay total; parsing happens at validation, so construction never fails.
- The interface remains the readable contract in declarations; the schema is the executable one.
- Adding a config field means editing both the interface and the schema; the guard enforces it.
- Parse functions take the config's static type, not `unknown`, because anti-slop forbids
  `unknown` parameters. The runtime parse is the guarantee regardless of the static type. The
  one place untyped data enters, the CLI's dynamic import of the user's blueprint, annotates the
  loaded value under a `SAFETY:` comment and relies on `validate` to parse every config.
- The health check path rule is carried by `z.templateLiteral`, which infers the same type as
  the interface. A refinement would infer `string` and break the identity guard, so refinements
  are reserved for value rules the type system cannot express.
- Issue reporting is tiered, not flat. Schema issues come first. Rules that read only names run
  over every resource whose name parsed; rules that read configs run only over resources whose
  name and config both parsed, because a rule reading an unparsed config can throw. A resource
  with a schema issue therefore has its config-rule issues deferred until the schema issue is
  fixed. "Every issue at once" holds within each tier.
- A refinement carries its own `ValidationCode` through a `validationCode` param on the custom
  issue, read by the issue translation; the shared helper is the only sanctioned way to raise
  one.
- Accepted limitation: a config object with a throwing getter throws inside Zod and reaches the
  CLI's single `Panic` boundary. Nothing short of copying every input can prevent it.
- The `env` callback form is resolved on every pass that reads an environment map — each rule, the
  parse of the resolved map, and synth — so a callback must be pure; one with side effects runs
  several times per synthesis, and one that throws reaches the same `Panic` boundary a throwing
  getter does. The resolved map is parsed as a second tier, after the config schema accepted the
  field as written, because a union of the map and the callback reports one issue on `env` and
  loses the key at fault.
