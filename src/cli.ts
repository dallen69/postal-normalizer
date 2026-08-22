#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseAddress, printAddress } from './address.js'

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

// files are read whole and joined with a blank line so a batch of files
// behaves the same as a batch of addresses piped in on stdin
async function readInput(paths: string[]): Promise<string> {
  if (paths.length === 0) {
    return readStdin()
  }
  return paths.map((path) => readFileSync(path, 'utf8')).join('\n\n')
}

function splitBlocks(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
}

async function main(): Promise<void> {
  const paths = process.argv.slice(2)
  const text = await readInput(paths)
  const blocks = splitBlocks(text)

  if (blocks.length === 0) {
    process.stderr.write('no address found in input\n')
    process.exitCode = 1
    return
  }

  let hadError = false
  blocks.forEach((block, index) => {
    if (index > 0) process.stdout.write('\n')
    const result = parseAddress(block)
    if (result.ok) {
      process.stdout.write(printAddress(result.address) + '\n')
    } else {
      hadError = true
      process.stderr.write(`address ${index + 1}:\n`)
      result.errors.forEach((error) => process.stderr.write(`  ${error}\n`))
    }
  })

  if (hadError) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
