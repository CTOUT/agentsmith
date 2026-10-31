# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-10-31

### Added

- `awesome-copilot` source adapter with git clone/pull, frontmatter parser, structural change check, and mass-removal guard (`src/sources/awesome-copilot.ts`).
- Target adapters for `vscode`, `kiro`, and `antigravity` across `repo` and `user` scopes with frontmatter translation (`src/targets/`).
- Subscription lifecycle commands (`sync`, `install`, `update`, `remove`, `list`), SHA-256 local-edit detection, workspace auto-detection, and interactive picker (`src/lifecycle/`, `src/cli/`).
- Unit and integration test suites (`vitest`) and GitHub Actions CI workflow (`.github/workflows/ci.yml`).
