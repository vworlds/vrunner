# Testing Rules

Run the verification suite before committing behavior changes:

```bash
npm run test
npm run typecheck
```

When fixing a bug, add a regression test that fails before the fix and passes after it. Put tests in `tests/`, mirroring the source hierarchy when useful.

When adding a feature, add tests for the public behavior, not implementation trivia. Cover the happy path and the important failure or edge path. For vrunner, that usually means state transitions, config validation, port allocation, command construction, and API behavior.

Tests use Vitest. Prefer small unit tests with explicit in-memory fixtures over real Docker or network calls. Mock command runners when testing git or Docker behavior.

Write assertions that prove what users or callers observe:

- Returned values and thrown errors.
- API response shapes.
- Persisted state changes.
- Generated command arguments and environment files.

Avoid weak assertions such as `toBeDefined()` when a concrete value, state, or behavior can be checked.

Place future test policy, examples, and package-specific testing conventions in this file. If a task needs a step-by-step testing workflow, create or update a file in `.agents/workflows/` and link to this rule file.
