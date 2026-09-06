# better-result — research notes

Source of truth for this document: the pinned clone at `.reference/better-result` (commit `4a654fa`,
`package.json` version `3.0.1`) plus `npm view better-result`. Everything below is taken from that
source; where the wording matters it is quoted verbatim.

Reference layout worth knowing:

| Path                                              | What it holds                                            |
| ------------------------------------------------- | -------------------------------------------------------- |
| `.reference/better-result/src/core.ts`            | `Ok`, `Err`, `Panic`, `Result` type, `InferOk`/`InferErr` |
| `.reference/better-result/src/result.ts`          | `Result` namespace object, `gen`, `try`, codecs           |
| `.reference/better-result/src/error.ts`           | `TaggedError`, `matchError`, `UnhandledException`         |
| `.reference/better-result/src/dual.ts`            | data-first/data-last dispatch                             |
| `.reference/better-result/src/*.test.ts`          | runtime tests (Vitest + fast-check)                       |
| `.reference/better-result/src/error.test-d.ts`    | type-level tests (`expectTypeOf`)                         |
| `.reference/better-result/website/docs/`          | full prose documentation (MDX)                            |
| `.reference/better-result/skills/adopt-better-result/` | the author's own adoption skill + references         |

---

## 1. Package facts

| Fact                     | Value                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| npm version              | `3.0.1` (`latest`). `next` dist-tag is `3.0.0-rc.5`, i.e. behind `latest`.                              |
| Runtime dependencies     | **None.** `dependencies` and `peerDependencies` are both absent from the manifest.                      |
| `engines`                | **Not declared.** npm reports no `engines` field.                                                       |
| Module format            | **ESM-only.** `"type": "module"`, single `exports["."]` with `types`/`import`/`default` → `dist/index.mjs`. There is no CJS build. |
| Types                    | `dist/index.d.mts` (+ declaration map).                                                                |
| TypeScript requirement   | **5.4 or newer.** README: "better-result requires TypeScript 5.4 or newer, is ESM-only, and has zero runtime dependencies." CI enforces it via `check:typescript-minimum` against `typescript@5.4.5`. |
| Build target             | `target: ES2022`, `lib: ES2022`, bundled by `tsdown` (esm only, minified, sourcemaps).                  |
| Side effects             | `"sideEffects": false` — tree-shakeable. Single entry point; **internal file paths are not part of the supported API** (installation doc). |
| Size                     | Published tarball unpacked 269 KB / 7 files, but that is dominated by types + sourcemaps. Runtime `dist/index.mjs` is **10.4 KB minified, ~3.3 KB gzipped**; `dist/index.d.mts` is 62.6 KB. |
| License                  | MIT.                                                                                                    |
| Repo dev toolchain       | Bun + Vitest 3.2.4 + fast-check 4 + oxlint/oxfmt + tsdown (informational; not required by consumers).   |
| CHANGELOG                | **None in the repo.** Version history lives in the migration guide (`website/docs/migration/from-2.mdx`) and `skills/migrate-better-result-3/references/v3-api-diff.md`. |

Runtime feature requirements (from `website/docs/getting-started/installation.mdx`): "standard
JavaScript classes, generators, async generators, `AbortSignal`, and ESM. Your runtime or build
target must support the specific feature you use. Generator composition requires generator support;
retry cancellation requires `AbortController`/`AbortSignal`."

---

## 2. API surface

Exactly these symbols are exported from `better-result` (verified against `src/index.ts` and the
published `dist/index.d.mts` export statement). **Nothing else exists** — in particular there is no
`fromNullable`, no `pipe`, no `flatMap`, no `orElse`, no `unwrapOrElse`, no `zip`/`sequence`/
`traverse`. `flatMap` is spelled `andThen`; the "recover" operation is `tryRecover`.

### 2.1 Values

| Export                       | Kind  | Signature summary                                                    | Sync/async |
| ---------------------------- | ----- | -------------------------------------------------------------------- | ---------- |
| `Result`                     | const object | Namespace of constructors/combinators (see 2.2). Also the *name of the type* — alias with `import { type Result as ResultType }`. | — |
| `Ok`                         | class | `class Ok<A, E = never> { readonly status = "ok"; readonly value: A }` | sync |
| `Err`                        | class | `class Err<T, E> { readonly status = "error"; readonly error: E }`    | sync |
| `TaggedError`                | fn    | `<Tag extends string>(tag: Tag) => TaggedErrorClass<Tag>` — factory for `Error` subclasses. Also carries `TaggedError.is(value): value is AnyTaggedError`. | sync |
| `UnhandledException`         | class | `TaggedError("UnhandledException")<{ message: string; cause: unknown }>`; ctor takes `{ cause }` and derives the message. Default error of `Result.try`/`Result.tryPromise`. | sync |
| `ResultSerializationError`   | class | `TaggedError("ResultSerializationError")<{ message; value: unknown; issues?: readonly ResultCodecIssue[] }>` | sync |
| `ResultDeserializationError` | class | `TaggedError("ResultDeserializationError")<{ message; value: unknown; issues?: readonly ResultCodecIssue[] }>` | sync |
| `Panic`                      | class | `class Panic extends Error { readonly _tag: "Panic"; cause?: unknown; toJSON(); static is(v): v is Panic }`. Thrown, never returned. | sync (throws) |
| `panic`                      | fn    | `(message: string, cause?: unknown) => never` — throws a `Panic`.     | sync (throws) |
| `isPanic`                    | fn    | `(value: unknown) => value is Panic`                                  | sync |
| `isTaggedError`              | fn    | `(value: unknown) => value is AnyTaggedError` (same function object as `TaggedError.is`) | sync |
| `matchError`                 | fn    | Dual. Data-first `(err, handlers) => R`; data-last `(handlers) => (err) => R`. **Exhaustive** over `_tag`. Throws `Panic` if the selected handler throws. | sync |
| `matchErrorPartial`          | fn    | 10 overloads. `(err, handlers)`, `(err, handlers, onUnhandled)`, `(handlers)`, `(handlers, onUnhandled)`. Unhandled variants pass through unchanged unless `onUnhandled` is supplied. | sync |

### 2.2 The `Result` namespace object

All entries live in the frozen-ish `as const` object at `src/result.ts:1165`.

**Constructors and guards** (none are dual):

| Member                            | Signature summary                                                | Sync/async |
| --------------------------------- | ---------------------------------------------------------------- | ---------- |
| `Result.ok`                       | `(): Ok<void, never>` / `<A, E = never>(value: A): Ok<A, E>`      | sync |
| `Result.err`                      | `<T = never, E = unknown>(error: E): Err<T, E>`                   | sync |
| `Result.isOk`                     | `<A, E>(r: Result<A, E>) => r is Ok<A, E>`                        | sync |
| `Result.isError`                  | `<T, E>(r: Result<T, E>) => r is Err<T, E>`                       | sync |
| `Result.try`                      | `(thunk: (ctx: TryContext) => Awaited<A>, config?: { retry?: { times: number } }) => Result<A, UnhandledException>` **or** `({ try, catch }, config?) => Result<A, E>` | **sync** — the `Awaited<A>` constraint makes passing a promise-returning fn a compile error |
| `Result.tryPromise`               | `(thunk: (ctx: TryPromiseContext) => Promise<A>, config?: RetryConfig) => Promise<Result<A, UnhandledException>>` **or** `({ try, catch }, config?) => Promise<Result<A, E>>` | **async** |

`RetryConfig` (inferred, not exported as a named type): `{ signal?: AbortSignal; retry?: RetryOptions }`.
`RetryOptions` is a union of a *static* form `{ times, delayMs: number, backoff: "linear" | "constant" | "exponential", shouldRetry?, jitter?: boolean | number }` and a *dynamic* form
`{ times, delayMs: (error, ctx) => number, backoff?: never, jitter?: never, shouldRetry? }`.

**Transformation / composition** (all dual: `f(result, arg)` and `f(arg)(result)`):

| Member                    | Runs on | Returns                                | Sync/async |
| ------------------------- | ------- | -------------------------------------- | ---------- |
| `Result.map`              | `Ok`    | `Result<B, E>`                         | sync |
| `Result.mapError`         | `Err`   | `Result<A, E2>`                        | sync |
| `Result.andThen`          | `Ok`    | `Result<CallbackSuccess<F>, E \| CallbackError<F>>` | sync |
| `Result.andThenAsync`     | `Ok`    | `Promise<Result<B, E \| E2>>`          | **async** |
| `Result.tryRecover`       | `Err`   | `Result<A \| B, E2>` (widens success)  | sync |
| `Result.tryRecoverAsync`  | `Err`   | `Promise<Result<A \| B, E2>>`          | **async** |
| `Result.flatten`          | `Ok` holding a `Result` | `Result<T, E \| E2>`   | sync (not dual, unary) |

**Handling / extraction**:

| Member            | Signature summary                                         | Dual? | Sync/async |
| ----------------- | --------------------------------------------------------- | ----- | ---------- |
| `Result.match`    | `(result, { ok, err }) => T` / `({ ok, err }) => (r) => T` | yes   | sync |
| `Result.unwrap`   | `(result, message?) => A` — throws `Panic` on `Err`        | **no, data-first only** | sync (may throw) |
| `Result.unwrapOr` | `(result, fallback) => A \| B` / `(fallback) => (r) => A \| B` | yes | sync |

**Observation** (all dual, all return the *original* Result):

`Result.tap` (Ok, sync), `Result.tapAsync` (Ok, **async**), `Result.tapError` (Err, sync),
`Result.tapErrorAsync` (Err, **async**), `Result.tapBoth` (`{ ok, err }`, sync),
`Result.tapBothAsync` (`{ ok, err }`, **async**).

**Generators (do-notation)**:

| Member         | Signature summary                                                                                       | Sync/async |
| -------------- | -------------------------------------------------------------------------------------------------------- | ---------- |
| `Result.gen`   | `(body: () => Generator<Yield, R>, thisArg?) => Result<InferOk<R>, InferYieldErr<Yield> \| InferErr<R>>` and `(body: () => AsyncGenerator<...>, thisArg?) => Promise<Result<...>>` | **both** — the async-generator overload returns a Promise |
| `Result.await` | `<T, E>(p: Promise<Result<T, E>>) => AsyncGenerator<Err<never, E>, T, unknown>` — makes a `Promise<Result>` yieldable | **async** |

**Collections**:

| Member                   | Signature summary                                                       | Sync/async |
| ------------------------ | ----------------------------------------------------------------------- | ---------- |
| `Result.all`             | `<const Rs extends readonly AnyResult[]>(rs: Rs) => Result<AllResultValues<Rs>, InferErr<Rs[number]>>` — first `Err` in input order wins | sync |
| `Result.allAsync`        | same over `readonly (AnyResult \| PromiseLike<AnyResult>)[]`             | **async** |
| `Result.partition`       | `(rs) => [Array<okUnion>, Array<errUnion>]`, order-preserving, never short-circuits | sync |
| `Result.partitionAsync`  | async form of the above                                                  | **async** |

**Serialization**:

`Result.codec(config: ResultCodecConfig<...>) => ResultCodec<...>` where the config is four
Standard-Schema-compatible schemas: `{ serialize: { ok, err }, deserialize: { ok, err } }`. The
returned codec has `serialize`, `serializeUnsafe`, `deserialize`, `deserializeUnsafe`. **Each method
preserves the selected schema's sync-or-async behavior** — the return type is `T` for a purely sync
schema, `Promise<T>` for a purely async one, `T | Promise<T>` when the schema can be either.

### 2.3 Instance methods on `Ok` / `Err`

Both classes implement the same surface (defined twice, in `src/core.ts`), so any `Result<T, E>` has:

`isOk()`, `isErr()`, `map`, `mapError`, `andThen`, `andThenAsync`, `tryRecover`, `tryRecoverAsync`,
`match`, `unwrap(message?)`, `unwrapOr(fallback)`, `tap`, `tapAsync`, `tapError`, `tapErrorAsync`,
`tapBoth`, `tapBothAsync`, and `[Symbol.iterator]()` (the `yield*` protocol).

`Ok`'s `[Symbol.iterator]` returns the value without yielding; `Err`'s yields `this as Err<never, E>`
and, if the generator resumes anyway, calls `panic("Unreachable: Err yielded in Result.gen but
generator continued", this.error)`.

### 2.4 Type exports

| Type                                        | Meaning |
| ------------------------------------------- | ------- |
| `Result<T, E>`                              | `Ok<T, E> \| Err<T, E>` |
| `Ok<T, E = never>` / `Err<T, E>`            | the two variant classes (both carry a **phantom** parameter for the other lane) |
| `InferOk<R>`                                | `R extends Ok<infer T, unknown> ? T : never` (distributive) |
| `InferErr<R>`                               | `R extends Err<unknown, infer E> ? E : never` (distributive) |
| `CallbackSuccess<F>`                        | `F extends Result<infer T, unknown> ? T : never` — success lane of a callback's whole return type |
| `CallbackError<F>`                          | `F extends Result<unknown, infer E> ? E : never` |
| `AnyTaggedError`                            | `Error & { readonly _tag: string } & { toJSON(): object }` |
| `TaggedErrorClass<Tag>` / `TaggedErrorInstance<Tag, Props>` | the factory's class / instance types |
| `TryContext`                                | `{ readonly attempt: number }` (one-based) |
| `TryPromiseContext`                         | `TryContext & { readonly signal?: AbortSignal }` |
| `SerializedOk<T>` / `SerializedErr<E>` / `SerializedResult<T, E>` | `{ status: "ok"; value: T }` / `{ status: "error"; error: E }` / union |
| `ResultCodec` / `ResultCodecConfig` / `ResultCodecIssue` | codec contracts |
| `StandardSchemaV1`, `StandardSchemaInput<S>`, `StandardSchemaOutput<S>`, `StandardSchemaIssue`, `StandardSchemaPathSegment`, `StandardSchemaResult<O>` | Standard Schema interop |

Note `AnyResult` (`Ok<unknown, unknown> | Err<unknown, unknown>`) is used throughout the signatures
but is **not** re-exported from the package entry point.

---

## 3. Prescribed idioms

### 3.1 What belongs in `Err` vs `Panic`

> "Use `Err` when the caller can make a meaningful decision about a failure: input is invalid; a
> record is missing; credentials are rejected; an upstream service is unavailable; data crossing a
> transport boundary fails validation." — README, *Mental model*

> "Unexpected callback failures and broken invariants are defects. better-result represents those
> with `Panic` instead of silently widening a typed error union with `unknown`." — README

> "A useful Result boundary has a caller that can act on the error. Parsers, repositories, adapters,
> domain operations, and application workflows are good candidates. **Pure, total helpers usually are
> not.**" — README

The skill reference (`skills/adopt-better-result/references/tagged-errors.md`) formalises four
dispositions: **Recoverable** (custom `TaggedError`), **Defect** (`panic(message, cause)`),
**Unknown external exception** (map documented failures to a boundary error; track temporary
`UnhandledException` use), **Unknown** (record what evidence is still needed).

### 3.2 Declaring error types

> "Create a custom `TaggedError` for every distinct known recoverable failure. The tag and class name
> should describe the failed domain operation or condition, not merely repeat an underlying library's
> error name. Reuse a class only for repeated occurrences of the same failure."

Canonical shape (v3 — **no trailing `()` after the props type**; that was the 2.x spelling):

```ts
import { TaggedError } from "better-result";

class CartNotFound extends TaggedError("CartNotFound")<{
  cartId: string;
  message: string;
}> {}
```

Payload rules taken from the source and docs:

- `message` and `cause`, if declared, are forwarded to `super(message, { cause })`; everything else is
  `Object.assign`ed onto the instance and typed `Readonly<Props>`.
- `name` is set to the tag. `_tag` is a string literal.
- An `Error` cause is appended to the stack as `\nCaused by: <indented cause stack>`.
- **`match` is a reserved payload name.** `TaggedErrorPropsWithoutReservedNames` resolves to `never`
  if `"match" extends keyof Props`, so declaring it is a compile error (there is a
  `@ts-expect-error` test for this in `src/error.test-d.ts`).
- A computed message goes in a subclass constructor that calls `super({ ...args, message })`.
- "Keep context structured instead of embedding everything in the message. Exclude credentials,
  tokens, raw personal data, SQL, and other secrets."

### 3.3 Returning Results

```ts
const findCart = (cartId: string): ResultType<Cart, CartNotFound> => {
  const cart = carts.get(cartId);
  return cart === undefined
    ? Result.err(new CartNotFound({ cartId, message: "Cart not found" }))
    : Result.ok(cart);
};
```

> "The error type is part of the function's contract. A caller must propagate, recover from, or
> handle `CartNotFound`."

### 3.4 Composing — generator do-notation is the prescribed default

```ts
const checkout = (cartId: string) =>
  Result.gen(function* () {
    const cart = yield* findCart(cartId);

    if (cart.items.length === 0) {
      yield* new EmptyCart({ cartId, message: "Cannot check out an empty cart" });
    }

    const reservation = yield* reserveStock(cart.items);
    const receipt = yield* chargePayment(cart, reservation);

    return Result.ok(receipt);
  });
// Result<Receipt, CartNotFound | EmptyCart | OutOfStock | PaymentDeclined>
```

> "Every `Ok` is unwrapped. The first `Err` short-circuits the generator. Errors from all yielded
> Results are collected into the final union."

> "A tagged error can be yielded directly for a guard clause. This is equivalent to
> `yield* Result.err(new EmptyCart(...))`; it returns an `Err` and does not throw."

> "**Always return `Result.ok(...)` or `Result.err(...)` from the generator. Returning a bare value is
> a defect and throws `Panic`.**" — `core/generator-composition.mdx` (enforced by `assertIsResult`)

> "Put effects and validation in named Result-returning functions. The generator should read as a
> workflow, not contain every implementation detail."

Async form — the README states an explicit **order of preference**:

> "1. `Result.gen` with `Result.await` for workflows with several steps or intermediate values;
> 2. `.then(Result.andThenAsync(...))` and other static combinators for short Promise pipelines;
> 3. await a `Promise<Result>` first only when ordinary control-flow narrowing is clearer than
> composition."

> "**Do not write `yield* await fetchUser()`.** `Result.await` supplies the async iterable protocol
> needed by the generator and preserves the error type."

### 3.5 Handling exceptions at boundaries

```ts
const parsed = Result.try({
  try: () => JSON.parse(input),
  catch: (cause) => new InvalidJson({ cause, message: "Input is not valid JSON" }),
});
```

> "If a custom `catch` callback throws or rejects, better-result throws a `Panic`. A catch handler is
> the boundary that promised to convert an unknown exception into a known error."

Without a `catch`, you get `UnhandledException` with the original throw as `.cause` — the skill says
to "track temporary `UnhandledException` use for unresolved exceptions" and "Record every
`UnhandledException` fallback … so its required investigation remains visible."

Non-throwing failures are *not* covered by `tryPromise`:

> "`fetch` rejects for network and cancellation failures, not for HTTP error statuses. Check fulfilled
> responses explicitly."

Catching `Panic` is only allowed at a defect boundary:

> "Catch Panic only at a true defect boundary—process entry point, request crash reporter, worker
> supervisor, or test assertion." … "**Do not turn Panic back into a generic Err.** Broadly catching
> Panic and returning `Err("something went wrong")` hides defects and makes typed error contracts
> misleading."

### 3.6 Translating errors at module boundaries

> "A repository may expose `UserNotFound | UserStoreUnavailable`, while its database adapter knows
> driver-specific exceptions. Translate once … **Do not leak framework, database, or HTTP error types
> through domain APIs.**" — `guides/application-patterns.mdx`

```ts
const findUser = (id: UserId) =>
  queryUserRow(id).mapError((cause) =>
    cause._tag === "NoRows"
      ? new UserNotFound({ id, message: "User not found" })
      : new UserStoreUnavailable({ cause, message: "User store unavailable" }),
  );
```

`Result.gen` unions errors, so a workflow's signature becomes "a compact ledger of all expected
failures"; normalise it with `.mapError` when callers should see one abstraction level.

### 3.7 Matching at the outer boundary

Two-step: Result branch first, tagged-error variant second.

```ts
const response = checkout(cartId).match({
  ok: (receipt) => Response.json(receipt, { status: 201 }),
  err: (error) =>
    error.match({
      CartNotFound: () => Response.json({ message: "Cart not found" }, { status: 404 }),
      EmptyCart: () => Response.json({ message: "Cart is empty" }, { status: 400 }),
      OutOfStock: (error) => Response.json({ message: `Out of stock: ${error.sku}` }, { status: 409 }),
      PaymentDeclined: () => Response.json({ message: "Payment declined" }, { status: 402 }),
    }),
});
```

> "Adding another tagged error to `checkout` makes this exhaustive handler fail to type-check until
> the new policy is defined."

> "Prefer the `error.match({ ... })` instance method when every variant is created by `TaggedError`
> … Use the standalone `matchError(error, handlers)` function for structurally tagged errors or its
> data-last form."

> "Keep the detailed internal message on the tagged error. Create the user-safe message at the
> presentation boundary with exhaustive error matching."

### 3.8 Exposing Results from a library's public API

- Return `Result<T, E>` where `E` is the caller-facing union. "One error vocabulary per boundary."
- Plain in-process calls need **no** serialization. `Result.codec` is required only when a `Result`
  crosses a serialized boundary or comes from untrusted data — "HTTP and RPC, server actions, queues
  and event payloads, workers and cross-process messages, persistence or caches that store Result
  envelopes."
- "Create one named codec for each boundary contract. Pass four named directional schemas to
  `Result.codec`; define their validation and mapping outside the codec declaration."
- "Expose only stable public codes and safe fields in public wire errors."
- Safe vs unsafe codec methods: "Prefer the safe methods for public, independently versioned,
  persisted, or otherwise untrusted boundaries where contract mismatch is an expected condition." Use
  `serializeUnsafe`/`deserializeUnsafe` only "when you own both producer and consumer and version
  their schemas together."

### 3.9 Explicitly discouraged patterns

From `guides/application-patterns.mdx` ("Avoid common traps"):

| Trap                        | Verdict |
| --------------------------- | ------- |
| String errors everywhere    | "Strings are hard to narrow, enrich, serialize deliberately, and match exhaustively. Prefer tagged classes at module boundaries." |
| Wrapping every function     | "Pure, total helpers do not need Result. Introduce Result where failure is part of the caller's decision." |
| Catching every Panic        | "Panic is a defect signal. Catch it at reporting/supervision boundaries, not in ordinary domain control flow." |
| Unwrapping in the middle    | "`unwrap()` converts `Err` into a thrown defect. Compose or handle instead unless the Err truly violates an invariant." |

Plus: "`unwrap` is not a substitute for error handling. Its meaning is: 'an Err here is a defect.'"
And: "Returning a Result from `map` nests it; use `andThen` to flatten a Result-returning callback."
And, on throwing from a match handler: "A throwing `match` handler becomes `Panic`; return a value or
a Result from a different combinator instead of throwing expected failures."

---

## 4. Testing patterns used in the repo's own tests

Runner: **Vitest 3.2.4**, tests colocated as `src/*.test.ts`; type tests as `src/*.test-d.ts` run by
Vitest's `typecheck` with `checker: "tsc"` (`vitest.config.ts`). `fast-check` is used for property
tests. There are **no custom assertion helpers** — no `expectOk`/`expectErr` matcher, no
`toBeOk()` extension. The idioms are:

1. **Narrow with the static guard, then assert the payload.** By far the dominant pattern
   (`Result.isOk` / `Result.isError` appear ~154 times in `src/result.test.ts`):

   ```ts
   expect(Result.isError(result)).toBe(true);
   if (Result.isError(result)) {
     expect(result.error).toBe("a failed");
   }
   ```

2. **Discriminant assertions** where the docs teach the contract (`guides/testing.mdx`):

   ```ts
   expect(result.status).toBe("ok");
   if (result.status === "ok") {
     expect(result.value).toBe(3000);
   }
   ```

   > "Narrow before accessing payloads so tests follow the same contract as production callers."

3. **`.unwrap()` as a terse success assertion** in happy-path tests (~79 uses):
   `expect(result.unwrap()).toBe(3);`

4. **`toBeInstanceOf(Ok)` / `toBeInstanceOf(Err)`** occasionally, and
   `expect(result.error).toBeInstanceOf(ErrorB)` for variant identity.

5. **Class-level guards for error variants** — the docs' recommended shape:
   `expect(InvalidPort.is(result.error)).toBe(true);` and `expect(error._tag).toBe("NotFoundError")`.

6. **Short-circuit proof via a spy**, asserting the downstream step never ran:

   ```ts
   const save = vi.fn(() => Result.ok(undefined));
   const result = Result.gen(function* () {
     yield* Result.err(new InvalidInput({ message: "invalid" }));
     yield* save();
     return Result.ok(undefined);
   });
   expect(Result.isError(result)).toBe(true);
   expect(save).not.toHaveBeenCalled();
   ```

7. **Defects asserted separately from errors**, and never conflated:

   ```ts
   expect(() => Result.ok(1).map(() => { throw new Error("bug"); })).toThrow(Panic);
   await expect(Result.ok(1).andThenAsync(async () => { throw new Error("x"); }))
     .rejects.toBeInstanceOf(Panic);
   ```

   Where the cause matters they use a try/catch with `expect.unreachable("should have thrown")` and
   then assert `e.message` and `e.cause`.
   > "Do not make expected-error tests catch Panic; that blurs the contract you are trying to prove."

8. **Deterministic retry tests**: record `attempt` numbers into an array, use `delayMs: 0`, assert
   `expect(attempts).toEqual([1, 2, 3])`. Jitter is tested with `vi.spyOn(Math, "random")` plus
   `fc.asyncProperty`.

9. **Type-level tests are first-class.** `expectTypeOf` appears ~130 times in `src/result.test.ts` and
   ~45 in `src/error.test-d.ts`; `// @ts-expect-error` asserts intentional compile failures (e.g. that
   `Result.try(() => Promise.resolve(69))` is rejected, and that a `match` payload property is
   rejected). `describe("Monad Laws")` / `describe("Functor Laws")` verify left identity, right
   identity, associativity, identity, and composition explicitly.
   > "Inference is part of the API. Use your repository's type-test convention to verify important unions."

10. **Round-trip property tests for codecs** with `fc.assert(fc.property(...))` over
    `JSON.parse(JSON.stringify(serialized))`.

---

## 5. Adoption doctrine for our codebase

Numbered, enforceable, derived from the library and its own adoption skill.

1. **Every fallible function returns `Result<T, E>`; `E` is a union of `TaggedError` subclasses
   declared in the same module as the function that produces them.** Never `Result<T, string>`,
   never `Result<T, Error>`, never `Result<T, unknown>`.

2. **One `TaggedError` class per distinct failure the caller can act on.** The tag names the failed
   domain operation, not the underlying library's error. Reuse a class only for repeated occurrences
   of the *same* failure.

3. **Every tagged error declares `message: string` plus the structured fields a handler needs**
   (identifiers, operation, upstream status/code, retryability), and `cause: unknown` when it wraps
   something. No secrets, tokens, PII, or raw SQL in the payload. Handlers must never parse
   `message` to make a decision.

4. **Never `throw` across a module boundary for an expected failure.** Third-party throwing APIs are
   wrapped at the adapter with `Result.try` / `Result.tryPromise` **in the `{ try, catch }` object
   form**, so the boundary produces a named error rather than `UnhandledException`. Any use of the
   bare-thunk form (which yields `UnhandledException`) is a temporary TODO that must be recorded.

5. **`Result.gen` is the default for any flow with two or more fallible steps.** The generator body
   reads as a workflow of named Result-returning calls; the last statement is always
   `return Result.ok(...)` or `return Result.err(...)`. Guard clauses use `yield* new SomeError({...})`.

6. **Async flows use `Result.gen(async function* ...)` with `yield* Result.await(promise)`.**
   `yield* await p` is banned. Short two-step Promise pipelines may use
   `.then(Result.andThenAsync(...)).then(Result.map(...))` instead. Awaiting a `Promise<Result>` and
   branching manually is a last resort.

7. **Errors are translated exactly once, at the boundary that owns the vocabulary**, with
   `.mapError(...)`. Driver, HTTP, filesystem and SDK error types never appear in a domain or public
   signature.

8. **Exhaustive matching only at handling boundaries**, and always two-step: `result.match({ ok, err })`
   first, then `error.match({ <Tag>: ... })` inside the `err` handler. Use `matchError` only for
   structurally tagged errors we did not create, and `matchErrorPartial` only when unhandled variants
   are deliberately meant to pass through.

9. **`unwrap()` is an invariant assertion, not error handling.** It is permitted only where an `Err`
   proves a bug (startup configuration, test setup) and must carry an explanatory message:
   `loadStartupConfiguration().unwrap("Startup configuration must be valid")`. Anywhere else, use
   `match` or `unwrapOr`.

10. **`Panic` is never caught in domain code.** Exactly one catch site per process — the entry point
    or request supervisor — uses `isPanic(error)` to report and then rethrows. Converting a `Panic`
    into an `Err` is forbidden.

11. **Callbacks passed to `map` / `mapError` / `andThen` / `tryRecover` / `match` / `tap*` must not
    throw.** A throwing callback is a defect and becomes `Panic`, not a typed error. If a step can
    fail, it returns a `Result` and is chained with `andThen`, not `map`.

12. **Do not wrap pure, total helpers in `Result`.** A `Result` boundary must have a caller that can
    act on the error: parsers, repositories, adapters, domain operations, application workflows.

13. **Validate untrusted input once, at the edge**, converting `unknown` into a domain value with a
    typed error (`InvalidX` carrying the schema issues). Interior code receives domain values.

14. **Any `Result` that crosses a serialization boundary goes through a named `Result.codec`** built
    from four schemas defined outside the codec call. Public / independently versioned / persisted
    boundaries use `serialize` + `deserialize` and handle `ResultSerializationError` /
    `ResultDeserializationError`; only boundaries where we own producer *and* consumer and version
    them together may use `serializeUnsafe` / `deserializeUnsafe`.

15. **Concurrency helpers are chosen by intent:** `Result.all` / `allAsync` when every step must
    succeed (first error short-circuits), `Result.partition` / `partitionAsync` when every item must
    be processed and the failures reported. Inputs to the async forms must already be
    `Promise<Result>` — a raw rejecting promise is a `Panic`.

16. **Retries are configured on `Result.tryPromise` only, with an explicit `shouldRetry` predicate
    and an idempotency justification in a comment.** `signal` must be threaded into the operation
    (`({ signal }) => fetch(url, { signal })`) — `tryPromise` cannot cancel anything by itself.
    `shouldRetry` and dynamic `delayMs` callbacks must not throw.

17. **Import only from `"better-result"`.** Deep imports into `dist/` are unsupported. Alias the type
    when a file uses both: `import { Result, type Result as ResultType } from "better-result";`

18. **Tests assert the discriminated shape, never the exception.** Narrow with `Result.isOk` /
    `Result.isError` (or `status`) before touching `.value` / `.error`; assert error variants with
    `SomeError.is(result.error)` and `_tag`; prove short-circuiting with a spy that was not called;
    assert defects separately with `toThrow(Panic)` / `rejects.toBeInstanceOf(Panic)`. Every tagged
    variant a public signature promises gets its own test. Important inferred unions get a type test.

19. **The project pins TypeScript ≥ 5.4 and emits ESM.** `strict` must be on; the library's own
    config additionally uses `noUncheckedIndexedAccess`, which we should match so inference behaves
    the same way.

### Canonical snippets

**A tagged error declaration** (with a computed message and a preserved cause):

```ts
import { TaggedError } from "better-result";

export class RenderTemplateFailed extends TaggedError("RenderTemplateFailed")<{
  templateId: string;
  message: string;
  cause: unknown;
}> {
  constructor(args: { templateId: string; cause: unknown }) {
    super({
      ...args,
      message: `Could not render template ${args.templateId}; inspect the attached cause.`,
    });
  }
}
```

**A function returning a Result:**

```ts
import { Result, type Result as ResultType } from "better-result";

export const findTemplate = (id: string): ResultType<Template, TemplateNotFound> => {
  const template = templates.get(id);
  return template === undefined
    ? Result.err(new TemplateNotFound({ templateId: id, message: `Template ${id} not found` }))
    : Result.ok(template);
};
```

**Composing several Results** (sync and async forms):

```ts
export const render = (id: string, input: unknown) =>
  Result.gen(function* () {
    const template = yield* findTemplate(id);
    const params = yield* parseParams(input);

    if (template.deprecated) {
      yield* new TemplateDeprecated({ templateId: id, message: "Template is deprecated" });
    }

    return Result.ok(yield* applyTemplate(template, params));
  });
// Result<Rendered, TemplateNotFound | InvalidParams | TemplateDeprecated | RenderTemplateFailed>

export const renderRemote = (id: string) =>
  Result.gen(async function* () {
    const template = yield* Result.await(fetchTemplate(id));
    const assets = yield* Result.await(fetchAssets(template.assetIds));
    return Result.ok({ template, assets });
  });
// Promise<Result<..., FetchTemplateFailed | FetchAssetsFailed>>
```

**Matching at a boundary:**

```ts
const toHttpResponse = (result: ResultType<Rendered, RenderError>) =>
  result.match({
    ok: (rendered) => Response.json(rendered, { status: 200 }),
    err: (error) =>
      error.match({
        TemplateNotFound: (e) => Response.json({ code: e._tag }, { status: 404 }),
        InvalidParams: (e) => Response.json({ code: e._tag, issues: e.issues }, { status: 400 }),
        TemplateDeprecated: (e) => Response.json({ code: e._tag }, { status: 410 }),
        RenderTemplateFailed: () => Response.json({ code: "RenderFailed" }, { status: 500 }),
      }),
  });
```

---

## 6. Gotchas and limitations

**Packaging / build**

- **ESM-only, no CJS.** Any consumer using `require()` will fail. There is one entry point and deep
  imports are unsupported. `sideEffects: false` means the bundler can tree-shake, but because the
  `Result` namespace is a single `as const` object, importing `Result` pulls in essentially all of
  the combinators (~3.3 KB gzipped — not a practical concern).
- **No `engines` field**, so npm/pnpm will not warn about an unsupported Node. Node ≥ 18 is implied
  by the ES2022 target and `AbortSignal` usage, but the package does not state it.
- **TypeScript 5.4 is a hard floor**, verified in CI. Older compilers will fail on the declaration file.

**Type inference**

- **`Ok<A, E>` and `Err<T, E>` both carry a phantom parameter for the other lane.** `Result.ok(42)`
  is `Ok<number, never>` and `Result.err(x)` is `Err<never, E>`. If you build a Result across several
  `return` statements without an explicit annotation, TypeScript may pin the union to one branch.
  **Annotate the return type** (`(): ResultType<T, E> => ...`); the repo's own type tests exist
  precisely because of this class of bug (`describe("multiple return Result.err inference (bug fix)")`).
- The combinators use elaborate conditional return types (`MapReturn`, `AndThenReturn`,
  `TryRecoverReturn`, keyed on an `IsUnion<R>` check) so that a concrete `Ok`/`Err` receiver keeps its
  concrete variant while a `Result` union prints as `Result<...>`. Expect hover types to look
  different depending on whether the receiver is a narrowed variant or a union.
- **`map` does not flatten.** Returning a `Result` from `map` yields `Result<Result<...>>`; use
  `andThen`, or `Result.flatten` if a nested Result already exists.
- **`tryRecover` widens the success type** to `A | B` when the recovery returns a different value. It
  is not a drop-in `orElse`.
- **`err` is declared `<T = never, E = unknown>(error: E): Err<T, E>`** — the phantom success lane
  defaults to `never` and the error lane's *default* is `unknown`. Inference from the argument
  normally fills `E`, but explicit partial instantiation or a widened argument will land you at
  `unknown`. Annotate the function's return type rather than relying on it.
- **`unwrapOr` widens**: the result is `A | B`, the union of success and fallback types.
- `InferOk`/`InferErr` are Ok-only / Err-only respectively; for a *callback's whole* return type use
  `CallbackSuccess`/`CallbackError`, which read the phantom lane too.

**Sync vs async**

- **`Result.try` is sync-only by construction.** Its parameter is typed `(ctx) => Awaited<A>`, so
  passing a promise-returning function is a compile error (asserted with `@ts-expect-error` in the
  tests). Use `Result.tryPromise`.
- **`Result.gen`'s async overload returns `Promise<Result<...>>`** — it must be `await`ed. Forgetting
  the `await` yields a Promise that silently satisfies almost nothing.
- **`yield* await promise` is wrong**; only `yield* Result.await(promise)` supplies the async iterable
  protocol.
- **`Result.andThenAsync` / `tryRecoverAsync` / `tap*Async` return Promises**, so they compose through
  `.then(...)`, not by chaining another instance method.
- **A codec's sync/async behavior follows the schema**, and the return type may be `T | Promise<T>`
  when a schema can be either — you may need `await` on a value that is sometimes not a Promise.

**Interop with plain exceptions**

- **Any user callback that throws produces `Panic`, not `Err`.** This applies to `map`, `mapError`,
  `andThen`, recovery, `match`, `matchError`, all `tap*`, the `Result.gen` body *and* its cleanup,
  a custom `catch` handler, `shouldRetry`, a dynamic `delayMs`, and codec schemas that throw instead
  of returning issues.
- **`Result.gen` panics if the generator returns a bare value** instead of a Result
  (`assertIsResult`), and if a `finally` / `Symbol.dispose` / `Symbol.asyncDispose` block throws
  during short-circuit cleanup.
- **`allAsync` / `partitionAsync` panic on a rejected input Promise.** Convert with `Result.tryPromise`
  before collecting.
- **`unwrap()` on `Err` throws `Panic`**, preserving the error as `.cause`. It is not a typed failure.
- **`Panic` is a plain `Error` subclass, not a `TaggedError`** (it does not go through the factory,
  though it does carry `_tag: "Panic"`, `toJSON()`, and the `yield*` iterator). `isTaggedError(panic)`
  returns `true` structurally since it is an `Error` with `_tag` and `toJSON`; prefer `isPanic` /
  `Panic.is` for defect detection.
- **`fetch`-style APIs that resolve with an error status do not reject**, so `tryPromise` will report
  `Ok(Response)`. HTTP status must be converted to an `Err` explicitly with `andThen`.
- **Retries cannot cancel.** "`Result.tryPromise` cannot cancel an operation by itself. Forward its
  signal to cancellation-aware operations." Aborting only stops pending retry *delays* and further
  attempts.
- **Invalid jitter panics before the first attempt** (non-finite or outside 0–1).

**Dual (data-first / data-last) dispatch**

- `dual` dispatches purely on **argument count at runtime** (`src/dual.ts`): for arity 2,
  `args.length >= 2` takes the data-first path, otherwise it returns `(self) => body(self, args[0])`.
  Type safety here rests entirely on the hand-written overload lists, not on the implementation — so
  any `as any` / spread at a call site can silently pick the wrong path.
- Data-last calls frequently need **explicit parameter annotations** because there is no receiver to
  infer from — the README's own examples write `Result.map((posts: ReadonlyArray<Post>) => posts.length)`.
- `Result.unwrap` is **not** dual; it is data-first only.
- `matchErrorPartial` is not built with `dual`; it dispatches on whether the second argument is a
  function, which is why it carries ten overloads. Annotate handler parameters in its data-last form.

**Migration / version notes**

- v3 changed `TaggedError("Tag")<Props>() {}` (2.x) to `TaggedError("Tag")<Props> {}` — **no trailing
  call**. Copying 2.x examples off the web will not compile.
- v3 removed `Result.serialize`, `Result.deserialize` and `Result.hydrate` in favour of
  `Result.codec`.
- v3 reserved `match` on `TaggedError` instances, so a 2.x error with a `match` payload property is
  now a compile error.
- There is no CHANGELOG in the repo; consult `website/docs/migration/from-2.mdx` and
  `skills/migrate-better-result-3/references/v3-api-diff.md` in the clone.
