import { spawnSync } from 'node:child_process'

const SERVER_NAME = 'playwright'
const run = (args) => {
  if (process.platform === 'win32') {
    const escapedArgs = args.map((arg) => `'${arg.replaceAll("'", "''")}'`)
    const command = `codex ${escapedArgs.join(' ')}`
    return spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
      stdio: 'pipe',
      encoding: 'utf8',
    })
  }

  return spawnSync('codex', args, {
    stdio: 'pipe',
    encoding: 'utf8',
  })
}

const result = run(['mcp', 'get', SERVER_NAME])

if (result.error) {
  process.stderr.write(`Failed to execute codex: ${result.error.message}\n`)
  process.exit(1)
}

if (result.status !== 0) {
  process.stderr.write(`${result.stderr ?? ''}${result.stdout ?? ''}`)
  process.exit(result.status ?? 1)
}

process.stdout.write(`MCP server "${SERVER_NAME}" is configured.\n`)
process.stdout.write(result.stdout ?? '')
