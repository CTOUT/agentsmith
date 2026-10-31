# Manual Test Plan

This document provides a self-contained PowerShell walkthrough to manually test `agentsmith` in an isolated temporary directory without modifying your real user profile (`~/.agentsmith`) or project repository.

## 1. Setup an Isolated Test Sandbox

Run the following commands in PowerShell from the repository root (`d:\Repos\GitHub\agentsmith`):

```powershell
# Ensure the latest build is ready
npm run build

# Point CLI path and isolate cache + test workspace in $env:TEMP
$cli = "d:\Repos\GitHub\agentsmith\dist\cli.js"
$testRoot = Join-Path $env:TEMP "agentsmith-human-test"
Remove-Item -Recurse -Force $testRoot -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path "$testRoot\workspace" | Out-Null
$env:AGENTSMITH_HOME = "$testRoot\cache"

Set-Location "$testRoot\workspace"
```

## 2. Test Live GitHub Sync (`sync`)

Verify live shallow cloning from `github/awesome-copilot`, catalogue generation, and idempotent re-syncing:

```powershell
# 1. Dry-run sync (clones source repository and previews counts without writing catalogue.json)
node $cli sync --dry-run

# 2. Live sync (writes catalogue.json and manifest.json)
node $cli sync

# 3. Re-run sync (should report 0 added, 0 updated, and all unchanged)
node $cli sync
```

## 3. Test Interactive Picker & Recommended Assets (`install`)

Exercise `@inquirer/prompts` keyboard navigation, category pre-filtering (eliminating buffer lag), and recommended asset detection:

```powershell
# No target markers exist yet in $testRoot\workspace, so this will:
# 1) Prompt you to choose a target (vscode, kiro, or antigravity)
# 2) Present a high-level category pre-filter:
#    - ★ Recommended (auto pre-selected, one-click install)
#    - 🔍 Search by keyword / fuzzy match (or press Enter with empty query to return)
#    - All instructions / steering / rules (scoped to target terminology)
#    - All agents
#    - All skills
#    - Browse everything (paged at 15 items per page to prevent terminal lag)
#    - ✖ Cancel (gracefully exits)
# 3) Display a locked header with centred columns:
#    - ICONS (centred)  TYPE (centred)  ASSET NAME (left-aligned)
#    - Active cursor item displays target destination path and description in the bottom pane
# 4) Navigation and escaping:
#    - Pressing Enter with 0 items selected prompts: "← Back to category / search menu" or "✖ Cancel"
#    - Pressing Ctrl+C cleanly exits with "Operation cancelled." (exit code 0, no error trace)
# (--dry-run lets you test confirmation while keeping the workspace clean for Steps 4-6)
node $cli install --dry-run

# You can also install all recommendations in one shot non-interactively:
node $cli install --recommended --dry-run
```

## 3b. Test Target Terminology & Fuzzy Search Filtering

Test searching and filtering both interactively and via CLI flags, observing target-specific terminology (`steering` for Kiro, `rule` for Antigravity, `instruction` for VS Code):

```powershell
# 1. Fuzzy search by keyword (e.g. "react", "python", "git") with dry-run
node $cli install --search react --dry-run

# 2. Type filter using target-native terminology:
# Kiro uses "steering":
node $cli install --target kiro --type steering --dry-run

# Antigravity uses "rule":
node $cli install --target antigravity --type rule --dry-run

# Filter by agents or skills:
node $cli install --type agent --dry-run
node $cli install --type skill --dry-run

# Combine search and type filtering:
node $cli install --search review --type agent --dry-run
```

## 4. Test Cross-Target Installation & Frontmatter Adaptation

Select the first instruction asset from the synced catalogue and install it across `kiro` and `antigravity`:

```powershell
# Grab the first instruction asset ID from the synced catalogue
$catalogue = Get-Content "$env:AGENTSMITH_HOME\catalogue.json" | ConvertFrom-Json
$assetId = ($catalogue | Where-Object { $_.type -eq "instruction" } | Select-Object -First 1).id
Write-Host "Testing with instruction asset: $assetId"

# Install into Kiro (repo scope -> .kiro/steering/<id>.md)
node $cli install $assetId --target kiro --scope repo

# Inspect adapted frontmatter (applyTo -> inclusion / fileMatchPattern)
Get-Content ".kiro\steering\$assetId.md" -TotalCount 15

# Install into Antigravity (repo scope -> .agents/rules/<id>.md)
node $cli install $assetId --target antigravity --scope repo

# Inspect adapted frontmatter (applyTo -> trigger / globs)
Get-Content ".agents\rules\$assetId.md" -TotalCount 15
```

## 5. Test `list`, Local-Edit Protection, and `update --force`

Verify that `agentsmith` detects local modifications (`[modified locally]`) and skips overwriting them unless `--force` is supplied:

```powershell
# 1. Check status (both should show [up to date])
node $cli list

# 2. Simulate a local edit to the Kiro file
Add-Content ".kiro\steering\$assetId.md" "`n<!-- local human edit -->"

# 3. Check status again (Kiro should now show [modified locally])
node $cli list

# 4. Run update without --force (should skip the locally modified Kiro file)
node $cli update

# 5. Run update with --force (overwrites local edit and restores clean state)
node $cli update --force
node $cli list
```

## 6. Test Removal & Directory Pruning (`remove`)

Verify both explicit and interactive asset removal:

```powershell
# 1. Remove the Antigravity asset explicitly
node $cli remove $assetId --target antigravity --scope repo

# 2. Run interactive remove for Kiro (use <space> and <enter> to select and remove)
node $cli remove --target kiro --scope repo

# 3. Confirm no subscriptions remain
node $cli list
```

## 7. Cleanup

When finished, return to the repository root and remove the temporary test environment:

```powershell
Set-Location d:\Repos\GitHub\agentsmith
Remove-Item Env:\AGENTSMITH_HOME -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $testRoot
```
