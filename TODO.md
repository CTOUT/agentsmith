# TODO / Roadmap

## Completed (v0.1.0)

- [x] Core TypeScript types, path traversal security guard (`assertPathWithin`), and SHA-256 hashing utilities.
- [x] `awesome-copilot` source adapter with frontmatter parsing, structural change detection, and mass-removal safety checks.
- [x] Target adapters for `vscode`, `kiro`, and `antigravity` (`repo` and `user` scopes) with frontmatter translation.
- [x] Subscription lifecycle manager (`install`, `update`, `remove`, `list`) and interactive `@inquirer/prompts` picker.
- [x] Unit and CLI integration test suites with Vitest and CI workflow.

## Planned (v1.1+)

- [ ] Generic Git source adapter and team `llms.txt` catalogue endpoints.
- [ ] Additional target adapters (Claude Code, Cursor, Warp, Codex).
- [ ] `agentsmith migrate` command to import legacy `~/.awesome-copilot/` subscriptions.
- [ ] Agent Plugins v1 packaging and automated npm release workflow.
