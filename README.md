# agentsmith

Cross-environment agent asset manager — install, sync, and update agent skills, instructions, and agents across VS Code (GitHub Copilot), Kiro, and Antigravity.

## Overview

`agentsmith` is a TypeScript/Node CLI (`npx agentsmith`) that synchronises canonical agent assets from the `awesome-copilot` catalogue and installs them into your active workspace or user profile with automatic frontmatter adaptation, SHA-256 modification tracking, and path traversal protection.

## Features

- **Cross-Environment Target Adapters**: Supports `vscode`, `kiro`, and `antigravity` across both `repo` and `user` scopes.
- **Explicit Frontmatter Portability**: Translates activation schemas (such as VS Code `applyTo` globs into Kiro `inclusion` steering rules or Antigravity `trigger` rules) and reports adaptations transparently.
- **Lifecycle & Local-Edit Protection**: Tracks `installedHash` and `sourceHash` in `~/.agentsmith/subscriptions.json` to flag upstream updates (`[↑]`) while protecting local edits (`[~]`) from accidental overwrites.
- **Sync Safety Guards**: Detects upstream structural changes and mass removals before modifying the local cache.

## Quick Start

```bash
# Sync the awesome-copilot catalogue into ~/.agentsmith/
npx agentsmith sync

# Install an asset interactively or by ID
npx agentsmith install
npx agentsmith install typescript --target kiro --scope repo

# Quickly install all recommended assets for the active project
npx agentsmith install --recommended

# List installed assets and their status badges
npx agentsmith list

# Apply upstream updates to subscribed assets
npx agentsmith update

# Remove a subscribed asset
npx agentsmith remove typescript --target kiro --scope repo
```

## Target Locations

| Asset Type    | Target        | Repo Scope                               | User Scope                                       |
| ------------- | ------------- | ---------------------------------------- | ------------------------------------------------ |
| `instruction` | `vscode`      | `.github/instructions/*.instructions.md` | `~/.copilot/instructions/*.instructions.md`      |
| `instruction` | `kiro`        | `.kiro/steering/*.md`                    | `~/.kiro/steering/*.md`                          |
| `instruction` | `antigravity` | `.agents/rules/*.md`                     | `~/.gemini/config/rules/*.md`                    |
| `agent`       | `vscode`      | `.github/agents/*.agent.md`              | `~/.copilot/agents/*.agent.md`                   |
| `agent`       | `kiro`        | `.kiro/agents/*.md`                      | `~/.kiro/agents/*.md`                            |
| `agent`       | `antigravity` | `.agents/plugins/<name>/agents/*.md`     | `~/.gemini/config/plugins/<name>/agents/*.md`    |
| `skill`       | `vscode`      | `.github/skills/<name>/`                 | `~/.copilot/skills/<name>/`                      |
| `skill`       | `kiro`        | `.kiro/skills/<name>/`                   | `~/.kiro/skills/<name>/`                         |
| `skill`       | `antigravity` | `.agents/plugins/<name>/skills/<name>/`  | `~/.gemini/config/plugins/<name>/skills/<name>/` |

## Development

```bash
npm install
npm run build
npm run lint
npm test
```
