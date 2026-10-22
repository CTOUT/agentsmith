#!/usr/bin/env node

import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Read version from package.json
const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as {
  version: string
}

const program = new Command()

program
  .name('agentsmith')
  .description(
    'Cross-environment agent asset manager — install, sync, and update agent skills, instructions, and agents across VS Code, Kiro, Antigravity, and more.',
  )
  .version(pkg.version, '-v, --version', 'Output the current version')

program
  .command('sync')
  .description('Sync the awesome-copilot catalogue to the local cache (~/.agentsmith/cache/)')
  .option('--dry-run', 'Preview what would be synced without writing any files')
  .option('--force', 'Skip safety checks (structural change and mass-removal detection)')
  .action((_options) => {
    console.log('sync — not yet implemented')
  })

program
  .command('install [asset]')
  .description('Install an agent asset into the current environment')
  .option('--target <target>', 'Target environment: vscode | kiro | antigravity')
  .option('--scope <scope>', 'Installation scope: repo | user', 'repo')
  .option('--dry-run', 'Preview what would be installed without writing any files')
  .action((_asset, _options) => {
    console.log('install — not yet implemented')
  })

program
  .command('update')
  .description('Apply upstream updates to all subscribed assets')
  .option('--target <target>', 'Limit to a specific target environment')
  .option('--scope <scope>', 'Limit to a specific scope: repo | user')
  .option('--dry-run', 'Preview updates without writing any files')
  .option('--force', 'Apply all updates without prompting')
  .action((_options) => {
    console.log('update — not yet implemented')
  })

program
  .command('remove [asset]')
  .description('Remove a subscribed asset from the current environment')
  .option('--target <target>', 'Target environment: vscode | kiro | antigravity')
  .option('--scope <scope>', 'Installation scope: repo | user', 'repo')
  .action((_asset, _options) => {
    console.log('remove — not yet implemented')
  })

program
  .command('list')
  .description('List installed assets and their status')
  .option('--target <target>', 'Filter by target environment')
  .option('--scope <scope>', 'Filter by scope: repo | user')
  .action((_options) => {
    console.log('list — not yet implemented')
  })

program.parse()
