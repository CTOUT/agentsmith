# Repository Template

Canonical "Template as Code" repository serving as the single source of truth for repository structure, configuration files, linting standards, and GitHub Actions workflows across all project repositories.

## Overview

This repository establishes the standardized baseline for:

- Repository documentation and legal/compliance metadata.
- Code formatting, editor settings, and spell checking (`en-GB`).
- GitHub Actions workflows for security scanning, Dependabot, and artifact retention cleanup.
- Automated synchronization via `sync-template.ps1`.

## Structure

```
├── .editorconfig
├── .gitattributes
├── .prettierrc
├── .prettierignore
├── .markdownlint.json
├── .markdownlintignore
├── cspell.json
├── LICENSE
├── SECURITY.md
├── CONTRIBUTING.md
├── CITATION.cff
├── llms.txt
├── .github/
│   ├── dependabot.yml
│   └── workflows/
│       ├── cleanup.yml
│       ├── format.yml
│       ├── gitleaks.yml
│       ├── ps-analyzer.yml
│       └── spellcheck.yml
└── sync-template.ps1
```

## Usage

Run the synchronization script to audit and apply template standards to target repositories:

```powershell
./sync-template.ps1 -DryRun
./sync-template.ps1
```
