# Contributing

Contributions welcome. Here's how to get started.

## Prerequisites

- **Node 24+** — [nodejs.org](https://nodejs.org)
- **git**

## Setup

```bash
git clone https://github.com/CTOUT/agentsmith.git
cd agentsmith
npm install
npm run build
npm test
```

## Development

```bash
npm run build        # Compile TypeScript via tsup
npm test             # Run Vitest test suite
npm run lint         # ESLint
npm run format       # Prettier
npm run spellcheck   # cspell (en-GB)
```

Tests live alongside source files as `*.test.ts`. The test suite covers utilities, lifecycle operations, target adapters, the source adapter, the picker, and CLI integration end-to-end.

## Standards

- **Language:** TypeScript, strict mode
- **Spelling:** en-GB (`cspell.json`)
- **Formatting:** Prettier (`.prettierrc`)
- **Commit messages:** plain imperative present tense, e.g. `fix: reject asset IDs with path separators`

## Pull Requests

- Keep PRs focused on a single logical change
- Ensure all CI checks pass (build, test, lint, format, spellcheck, gitleaks)
- Add or update tests for any changed behaviour
- Update `CHANGELOG.md` under `[Unreleased]`
