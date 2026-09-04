#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parseAddress, printAddress, type Address } from './address.js'

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

// what --json emits per address block: the parsed/printed address on
// success, or the error list on failure, so a caller never has to guess
// which shape it got from a boolean elsewhere in the payload
type JsonResult = { ok: true; address: Address; formatted: string } | { ok: false; errors: string[] }

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const json = args.includes('--json')
  const paths = args.filter((arg) => arg !== '--json')

  const text = await readInput(paths)
  const blocks = splitBlocks(text)

  if (blocks.length === 0) {
    if (json) {
      process.stdout.write('[]\n')
    } else {
      process.stderr.write('no address found in input\n')
    }
    process.exitCode = 1
    return
  }

  let hadError = false

  if (json) {
    const results: JsonResult[] = blocks.map((block) => {
      const result = parseAddress(block)
      if (result.ok) {
        return { ok: true, address: result.address, formatted: printAddress(result.address) }
      }
      hadError = true
      return { ok: false, errors: result.errors }
    })
    process.stdout.write(JSON.stringify(results, null, 2) + '\n')
  } else {
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
  }

  if (hadError) {
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
