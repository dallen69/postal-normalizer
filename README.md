# postal-normalizer

Address lines that came off a web form, a CSV export, or someone's typed-up
notes rarely match what USPS actually expects: mixed case, stray commas,
"Street" instead of "St", a state name instead of an abbreviation. This is a
small parser that checks a US postal address for the things that actually
break mail delivery (bad zip, unrecognized state, no house number) and a
printer that reformats a valid one into USPS's plain, all-caps style.

It only handles US addresses for now. Other countries have wildly different
line orders and I don't want to pretend to support them until I do.

## Address shape

An address block is one to four non-empty lines:

```
Jane Doe            <- recipient (optional)
Acme Corp           <- organization (optional)
742 Evergreen Ter Apt 4B
Springfield, IL 62704
```

The last line must be `city, state zip` (the comma is optional). The line
above it is the street line and must contain a house number. Anything above
that is treated as recipient, then organization.

## Command line usage

Build once with the TypeScript compiler you already have installed:

```
npx tsc
```

Then run it against a file:

```
node dist/cli.js address.txt
```

against several files, each treated as one address:

```
node dist/cli.js addresses/*.txt
```

or piped in on stdin, with multiple addresses separated by a blank line:

```
printf '742 Evergreen Ter\nSpringfield, IL 62704\n\n1600 pennsylvania ave nw\nwashington, dc 20500\n' | node dist/cli.js
```

which prints:

```
742 EVERGREEN TER
SPRINGFIELD IL 62704

1600 PENNSYLVANIA AVE NW
WASHINGTON DC 20500
```

Any block that fails validation gets its errors written to stderr with the
address's position in the batch, and the process exits with a nonzero
status. Valid blocks in the same batch still print to stdout.

## Library usage

```ts
import { parseAddress, printAddress } from './src/address.js'

const result = parseAddress('742 Evergreen Ter\nSpringfield, IL 62704')
if (result.ok) {
  console.log(printAddress(result.address))
} else {
  console.error(result.errors)
}
```

## License

MIT, see LICENSE.
