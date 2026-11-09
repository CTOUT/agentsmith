# Security Policy

## Supported Versions

| Version         | Supported |
| --------------- | --------- |
| `main` (latest) | Yes       |
| Older releases  | No        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Open a [GitHub Security Advisory](https://github.com/CTOUT/agentsmith/security/advisories/new) to report privately.

Include in your report:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations if you have them

You can expect acknowledgement within 48 hours and a status update within 7 days.

## Scope

This repository contains a Node.js CLI (`agentsmith`) that clones assets from [github/awesome-copilot](https://github.com/github/awesome-copilot) and writes them into repository and user-level directories. Areas of particular interest:

- **Path traversal** — asset IDs sourced from an upstream repository are used to construct destination paths. A crafted ID (e.g. `../../evil.md`) could attempt to write outside the intended directory. All write and remove operations are guarded by `assertPathWithin` in `src/utils/paths.ts`, which rejects paths that escape the authorised base directory, equal it without explicit permission, or traverse a symbolic link or reparse point.
- **Remote content execution** — the CLI fetches file content from a third-party repository and writes it to the local filesystem. A compromised upstream repository could introduce malicious instruction or agent files. The CLI does **not** execute any downloaded content — it copies files only.
- **Subscription integrity** — only files recorded in `~/.agentsmith/subscriptions.json` are offered for removal. User-created files are never touched.
- **Mass removal protection** — the sync command refuses to apply a pull that removes ≥ 25% of previously tracked assets without `--force`.
- **`AGENTSMITH_HOME` environment variable**: When set, this overrides the cache directory (`~/.agentsmith/`). Only set this to a directory you control and trust. A crafted `catalogue.json` or `manifest.json` in a malicious `AGENTSMITH_HOME` directory could cause agentsmith to present attacker-controlled asset metadata. The tool only reads its own JSON files from this directory — it never executes them.

## Verifying upstream content

Review newly synced files in `~/.agentsmith/sources/awesome-copilot/` before installing them. Use `--dry-run` on all write commands to inspect planned operations:

```bash
agentsmith sync --dry-run
agentsmith install --dry-run
agentsmith update --dry-run
```
