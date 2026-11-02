# agentsmith

A cross-environment agent asset manager. Install, sync, and update agent skills, instructions, and agents from the [awesome-copilot](https://github.com/github/awesome-copilot) catalogue into VS Code, Kiro, and Antigravity — with subscription tracking, hash-based change detection, dry-run, and local-edit protection.

> **Successor to [vscode-copilot-sync](https://github.com/CTOUT/vscode-copilot-sync)** — same lifecycle safety, now cross-environment and runtime-agnostic.

## Quick Start

```bash
npx @ctout/agentsmith sync
npx @ctout/agentsmith install
```

No install required. Requires Node 24+.

## What it does

- **Syncs** the awesome-copilot catalogue into a local cache (`~/.agentsmith/`)
- **Installs** assets into your environment's correct locations with frontmatter translated for each target
- **Tracks** every installation in `~/.agentsmith/subscriptions.json` with SHA-256 hashes
- **Detects** local edits (`[~]`) and upstream updates (`[↑]`) before touching anything
- **Removes** only what it installed — user-created files are never touched

## Supported environments

| Environment | Repo scope | User scope |
| --- | --- | --- |
| **VS Code** (Copilot harness) | `.github/agents/`, `.github/instructions/`, `.github/skills/` | `~/.copilot/agents/`, `~/.copilot/instructions/`, `~/.copilot/skills/` |
| **Kiro** | `.kiro/agents/`, `.kiro/steering/`, `.kiro/skills/` | `~/.kiro/agents/`, `~/.kiro/steering/`, `~/.kiro/skills/` |
| **Antigravity** | `.agents/plugins/<name>/` | `~/.gemini/config/plugins/<name>/` |

## Commands

```bash
agentsmith sync                          # Pull latest from awesome-copilot into ~/.agentsmith/
agentsmith sync --dry-run                # Preview sync without writing

agentsmith install                       # Interactive picker for the detected environment
agentsmith install se-security-reviewer  # Install a specific asset
agentsmith install --target kiro         # Target a specific environment
agentsmith install --scope user          # Install at user level (available everywhere)
agentsmith install --recommended         # Install all recommended assets non-interactively
agentsmith install --type instruction    # Filter picker by asset type
agentsmith install --search "security"   # Filter picker by search term
agentsmith install --dry-run             # Preview without writing

agentsmith update                        # Apply upstream updates to all subscriptions
agentsmith update --target vscode        # Limit to a specific environment
agentsmith update --dry-run              # Preview updates
agentsmith update --force                # Overwrite locally modified files

agentsmith remove                        # Interactive picker of installed assets to remove
agentsmith remove se-security-reviewer   # Remove a specific asset
agentsmith remove --dry-run              # Preview removals

agentsmith list                          # Show all installed assets and their status
agentsmith list --target kiro            # Filter by environment
agentsmith list --scope user             # Filter by scope
```

## Status badges

| Badge | Meaning |
| --- | --- |
| `★` | Recommended for this environment |
| `[*]` | Already installed |
| `[↑]` | Update available from upstream |
| `[~]` | Locally modified since install |
| `[!]` | Requires additional setup (MCP server, API key, etc.) |

## Portability

Assets are translated for each target environment transparently. The adapter reports what changed:

```
installed 'security-and-owasp' -> kiro:repo [adapted: applyTo -> inclusion: fileMatch, fileMatchPattern: **/*.ts]
```

Three outcomes are possible:

- **Native** — asset installed as-is, no changes
- **Adapted** — frontmatter translated for the target; changes reported
- **Unsupported** — asset cannot be safely installed; reason explained

### Frontmatter translation reference

| VS Code (`applyTo`) | Kiro (`inclusion`) | Antigravity (`trigger`) |
| --- | --- | --- |
| `applyTo: "**/*.ts"` | `inclusion: fileMatch` + `fileMatchPattern: "**/*.ts"` | `trigger: glob` + `globs: "**/*.ts"` |
| `applyTo: "**"` | `inclusion: always` | `trigger: always_on` |
| *(none)* | `inclusion: always` | `trigger: always_on` |

## Cache and subscriptions

```
~/.agentsmith/
├── sources/
│   └── awesome-copilot/    # Local git checkout (sparse)
├── catalogue.json           # Metadata index for the picker
├── manifest.json            # Sync state (hashes, timestamps)
└── subscriptions.json       # Installation records per target and scope
```

> **Migration notice:** If you have an existing `~/.awesome-copilot/` directory from [vscode-copilot-sync](https://github.com/CTOUT/vscode-copilot-sync), agentsmith uses a separate `~/.agentsmith/` cache. Run `agentsmith sync` to populate it fresh.

## Security

- Path traversal protection via `assertPathWithin` on every file write and removal operation
- Only files recorded in `subscriptions.json` are removed — user-created files are never touched
- Locally modified files are flagged `[~]` and skipped without `--force`
- `--dry-run` is available on all write commands

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## Prerequisites

- **Node 24+** — [nodejs.org](https://nodejs.org)
- **git** — for the initial awesome-copilot clone

## Related

- [awesome-copilot](https://github.com/github/awesome-copilot) — the community catalogue agentsmith syncs from
- [vscode-copilot-sync](https://github.com/CTOUT/vscode-copilot-sync) — the archived PowerShell predecessor
- [Agent Plugins specification](https://agent-plugins.org/specification) — portable plugin packaging standard

## License

MIT — see [LICENSE](LICENSE)
