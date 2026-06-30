# Documentation Rules

When adding or changing a feature, setup path, public API, or behavior, update the relevant docs in the same change.

For vrunner this usually means updating:

- `README.md` for setup, commands, configuration, and operator-facing behavior.
- `config.example.json` when config shape changes.
- Inline comments only when the code path is not self-explanatory.

Ground documentation in code, not comments. Read the source before writing; verify every name, config field, command, and behavior claim against the implementation.

Write examples as real code or real config. Every example must use the actual public API or config shape.

Keep a single source of truth. Each fact lives in one doc; other docs cross-link to it with relative links instead of restating it.

Follow the established doc style:

- One topic per section and descriptive headings.
- Concise, direct, second-person, imperative voice. Explain the why, not just the what.
- Every relative link must resolve.

Run `npm run format` and `npm run format:check` after editing Markdown; Prettier formats docs.

Place future documentation policy and conventions in this file.
