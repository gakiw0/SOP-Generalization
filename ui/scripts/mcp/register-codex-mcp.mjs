import { spawnSync } from 'node:child_process'

const SERVER_NAME = 'playwright'
const ADD_ARGS = ['mcp', 'add', SERVER_NAME, '--', 'npx', '-y', '@playwright/mcp@latest']

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

const getResult = run(['mcp', 'get', SERVER_NAME])
if (getResult.error) {
  process.stderr.write(`Failed to execute codex: ${getResult.error.message}\n`)
  process.exit(1)
}

if (getResult.status === 0) {
  process.stdout.write(`MCP server "${SERVER_NAME}" is already configured.\n`)
  process.exit(0)
}

const message = `${getResult.stderr ?? ''}${getResult.stdout ?? ''}`
if (!message.includes(`No MCP server named '${SERVER_NAME}' found`)) {
  process.stderr.write(message || 'Failed to inspect existing MCP server.\n')
  process.exit(getResult.status ?? 1)
}

const addResult = run(ADD_ARGS)
if (addResult.error) {
  process.stderr.write(`Failed to execute codex: ${addResult.error.message}\n`)
  process.exit(1)
}

if (addResult.status !== 0) {
  process.stderr.write(`${addResult.stderr ?? ''}${addResult.stdout ?? ''}`)
  process.exit(addResult.status ?? 1)
}

process.stdout.write(`MCP server "${SERVER_NAME}" has been registered.\n`)
