import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = join(__dirname, '..')

describe('agentsmith CLI', () => {
  it('exits 0 on --version', () => {
    const result = execSync('node dist/cli.js --version', {
      cwd: root,
      encoding: 'utf-8',
    })
    expect(result.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('exits 0 on --help', () => {
    const result = execSync('node dist/cli.js --help', {
      cwd: root,
      encoding: 'utf-8',
    })
    expect(result).toContain('agentsmith')
    expect(result).toContain('sync')
    expect(result).toContain('install')
    expect(result).toContain('update')
    expect(result).toContain('remove')
    expect(result).toContain('list')
  })
})
