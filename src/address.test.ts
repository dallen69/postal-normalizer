import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAddress, printAddress } from './address.js'

test('parses a bare street + city/state/zip block', () => {
  const result = parseAddress('742 Evergreen Ter\nSpringfield, IL 62704')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.address.street, '742 Evergreen Ter')
  assert.equal(result.address.city, 'Springfield')
  assert.equal(result.address.state, 'IL')
  assert.equal(result.address.zip, '62704')
  assert.equal(result.address.recipient, undefined)
  assert.equal(result.address.organization, undefined)
})

test('parses recipient and organization lines', () => {
  const result = parseAddress(
    'Jane Doe\nAcme Corp\n742 Evergreen Ter\nSpringfield, IL 62704',
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.address.recipient, 'Jane Doe')
  assert.equal(result.address.organization, 'Acme Corp')
})

test('treats a single leading line as the recipient, not the organization', () => {
  const result = parseAddress('Jane Doe\n742 Evergreen Ter\nSpringfield, IL 62704')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.address.recipient, 'Jane Doe')
  assert.equal(result.address.organization, undefined)
})

test('city/state/zip line works without the comma', () => {
  const result = parseAddress('1600 Pennsylvania Ave NW\nWashington DC 20500')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.address.city, 'Washington')
  assert.equal(result.address.state, 'DC')
})

test('accepts a zip+4', () => {
  const result = parseAddress('742 Evergreen Ter\nSpringfield, IL 62704-1234')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.address.zip, '62704-1234')
})

test('upcases a lowercase state abbreviation', () => {
  const result = parseAddress('742 Evergreen Ter\nSpringfield, il 62704')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.address.state, 'IL')
})

for (const unit of ['Apt 4B', 'apt. 4b', 'Apartment 12', 'Unit 3', 'Suite 900', 'Ste 12', '# 12']) {
  test(`splits a trailing unit designator: ${unit}`, () => {
    const result = parseAddress(`742 Evergreen Ter ${unit}\nSpringfield, IL 62704`)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.address.street, '742 Evergreen Ter')
    assert.equal(result.address.unit?.toLowerCase(), unit.toLowerCase())
  })
}

test('rejects a single-line block', () => {
  const result = parseAddress('742 Evergreen Ter')
  assert.equal(result.ok, false)
})

test('rejects a block with more than four lines', () => {
  const result = parseAddress('A\nB\nC\nD\nE')
  assert.equal(result.ok, false)
})

test('rejects an unrecognized state abbreviation', () => {
  const result = parseAddress('742 Evergreen Ter\nSpringfield, ZZ 62704')
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.ok(result.errors.some((error) => error.includes('ZZ')))
})

test('rejects a zip that does not belong to the given state', () => {
  const result = parseAddress('742 Evergreen Ter\nSpringfield, NY 62704')
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.ok(result.errors.some((error) => error.includes('belongs to IL')))
})

test('accepts a zip prefix that has no state assigned to it in the range table', () => {
  // 819 falls in the unassigned gap between the CO and WY prefix ranges
  const result = parseAddress('742 Evergreen Ter\nSomewhere, CO 81900')
  assert.equal(result.ok, true)
})

test('rejects a malformed zip', () => {
  const result = parseAddress('742 Evergreen Ter\nSpringfield, IL 1234')
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.ok(result.errors.some((error) => error.includes('1234')))
})

test('rejects a street line with no house number', () => {
  const result = parseAddress('Evergreen Ter\nSpringfield, IL 62704')
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.ok(result.errors.some((error) => error.includes('house number')))
})

test('rejects a last line that is not city/state/zip', () => {
  const result = parseAddress('742 Evergreen Ter\nSpringfield Illinois')
  assert.equal(result.ok, false)
})

test('collects multiple errors on one block', () => {
  const result = parseAddress('Evergreen Ter\nSpringfield, ZZ 1234')
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.errors.length, 3)
})

test('prints in USPS all-caps style with no punctuation', () => {
  const result = parseAddress('Jane Doe\n742 Evergreen Ter Apt 4B\nSpringfield, IL 62704')
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(
    printAddress(result.address),
    'JANE DOE\n742 EVERGREEN TER APT 4B\nSPRINGFIELD IL 62704',
  )
})
