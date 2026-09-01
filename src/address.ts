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

// ZIP code prefixes (the first three digits) as USPS assigns them to states
// and territories. Ranges that are unassigned or reserved for military
// "state" codes (AA/AE/AP) are left out on purpose, so those zips just skip
// the cross-check instead of failing it.
const ZIP_PREFIX_RANGES: ReadonlyArray<{ low: number; high: number; state: string }> = [
  { low: 6, high: 7, state: 'PR' },
  { low: 8, high: 8, state: 'VI' },
  { low: 9, high: 9, state: 'PR' },
  { low: 10, high: 27, state: 'MA' },
  { low: 28, high: 29, state: 'RI' },
  { low: 30, high: 38, state: 'NH' },
  { low: 39, high: 49, state: 'ME' },
  { low: 50, high: 59, state: 'VT' },
  { low: 60, high: 69, state: 'CT' },
  { low: 70, high: 89, state: 'NJ' },
  { low: 100, high: 149, state: 'NY' },
  { low: 150, high: 196, state: 'PA' },
  { low: 197, high: 199, state: 'DE' },
  { low: 200, high: 205, state: 'DC' },
  { low: 206, high: 219, state: 'MD' },
  { low: 220, high: 246, state: 'VA' },
  { low: 247, high: 268, state: 'WV' },
  { low: 270, high: 289, state: 'NC' },
  { low: 290, high: 299, state: 'SC' },
  { low: 300, high: 319, state: 'GA' },
  { low: 320, high: 349, state: 'FL' },
  { low: 350, high: 369, state: 'AL' },
  { low: 370, high: 385, state: 'TN' },
  { low: 386, high: 397, state: 'MS' },
  { low: 398, high: 399, state: 'GA' },
  { low: 400, high: 427, state: 'KY' },
  { low: 430, high: 459, state: 'OH' },
  { low: 460, high: 479, state: 'IN' },
  { low: 480, high: 499, state: 'MI' },
  { low: 500, high: 528, state: 'IA' },
  { low: 530, high: 549, state: 'WI' },
  { low: 550, high: 567, state: 'MN' },
  { low: 570, high: 577, state: 'SD' },
  { low: 580, high: 588, state: 'ND' },
  { low: 590, high: 599, state: 'MT' },
  { low: 600, high: 629, state: 'IL' },
  { low: 630, high: 658, state: 'MO' },
  { low: 660, high: 679, state: 'KS' },
  { low: 680, high: 693, state: 'NE' },
  { low: 700, high: 714, state: 'LA' },
  { low: 716, high: 729, state: 'AR' },
  { low: 730, high: 749, state: 'OK' },
  { low: 750, high: 799, state: 'TX' },
  { low: 800, high: 816, state: 'CO' },
  { low: 820, high: 831, state: 'WY' },
  { low: 832, high: 838, state: 'ID' },
  { low: 840, high: 847, state: 'UT' },
  { low: 850, high: 865, state: 'AZ' },
  { low: 870, high: 884, state: 'NM' },
  { low: 889, high: 898, state: 'NV' },
  { low: 900, high: 961, state: 'CA' },
  { low: 967, high: 968, state: 'HI' },
  { low: 970, high: 979, state: 'OR' },
  { low: 980, high: 994, state: 'WA' },
  { low: 995, high: 999, state: 'AK' },
]

function expectedStateForZip(zip: string): string | undefined {
  const prefix = Number(zip.slice(0, 3))
  return ZIP_PREFIX_RANGES.find((range) => prefix >= range.low && prefix <= range.high)?.state
}

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
    } else if (STATE_ABBREVIATIONS.has(state)) {
      const expected = expectedStateForZip(zip)
      if (expected && expected !== state) {
        errors.push(`zip "${zip}" belongs to ${expected}, not "${state}"`)
      }
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
