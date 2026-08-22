export interface Address {
  recipient?: string
  organization?: string
  street: string
  unit?: string
  city: string
  state: string
  zip: string
}

export interface ParseSuccess {
  ok: true
  address: Address
}

export interface ParseFailure {
  ok: false
  errors: string[]
}

export type ParseResult = ParseSuccess | ParseFailure

const STATE_ABBREVIATIONS = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  // DC and the territories the USPS assigns their own abbreviations to
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
])

const ZIP_PATTERN = /^\d{5}(-\d{4})?$/

// matches "city, state zip" — the comma is optional since USPS's own
// examples drop it
const LAST_LINE_PATTERN = /^(.+?),?\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/

// pulls a trailing unit designator ("apt 4b", "suite 900", "# 12") off a
// street line so it can be tracked separately from the house number/street
const UNIT_PATTERN = /\s+(?:(?:apt|apartment|unit|suite|ste|#)\.?\s*[a-z0-9-]+)$/i

export function parseAddress(block: string): ParseResult {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    return {
      ok: false,
      errors: ['an address needs at least a street line and a city/state/zip line'],
    }
  }
  if (lines.length > 4) {
    return {
      ok: false,
      errors: ['too many lines: expected at most recipient, organization, street, city/state/zip'],
    }
  }

  const errors: string[] = []
  const lastLine = lines[lines.length - 1]
  const streetLine = lines[lines.length - 2]
  const leading = lines.slice(0, lines.length - 2)

  let city = ''
  let state = ''
  let zip = ''

  const match = LAST_LINE_PATTERN.exec(lastLine)
  if (!match) {
    errors.push(`last line "${lastLine}" is not in "city, state zip" form`)
  } else {
    city = match[1].trim()
    state = match[2].toUpperCase()
    zip = match[3]
    if (!STATE_ABBREVIATIONS.has(state)) {
      errors.push(`"${state}" is not a recognized state or territory abbreviation`)
    }
    if (!ZIP_PATTERN.test(zip)) {
      errors.push(`"${zip}" is not a valid zip code`)
    }
  }

  if (!/\d/.test(streetLine)) {
    errors.push(`street line "${streetLine}" has no house number`)
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  const { street, unit } = splitUnit(streetLine)
  const [recipient, organization] =
    leading.length === 2 ? [leading[0], leading[1]] : [leading[0], undefined]

  return {
    ok: true,
    address: { recipient, organization, street, unit, city, state, zip },
  }
}

function splitUnit(streetLine: string): { street: string; unit?: string } {
  const match = UNIT_PATTERN.exec(streetLine)
  if (!match) {
    return { street: streetLine }
  }
  return {
    street: streetLine.slice(0, match.index).trim(),
    unit: match[0].trim(),
  }
}

export function printAddress(address: Address): string {
  const lines: string[] = []
  if (address.recipient) lines.push(address.recipient)
  if (address.organization) lines.push(address.organization)
  lines.push(address.unit ? `${address.street} ${address.unit}` : address.street)
  lines.push(`${address.city}, ${address.state} ${address.zip}`)
  return lines.map(uspsCase).join('\n')
}

// the USPS style guide calls for all caps and no punctuation other than the
// hyphen in a zip+4, so the comma joining city and state gets dropped here
function uspsCase(line: string): string {
  return line
    .toUpperCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
