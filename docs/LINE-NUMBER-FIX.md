# Line Number Fix Summary

## Problem
Line numbers were incorrect in VS Code diagnostics and cursor tracking because the parser uses **1-based line/column numbers** while VS Code uses **0-based line/column numbers**. The diagnostics code was passing parser numbers directly without conversion.

## Solution
**File**: `src/diagnostics.js` (lines 33-35, 65-67)

Added `-1` conversion for all line and column numbers:
```javascript
// Parser uses 1-based → VS Code uses 0-based
const line = error.line !== undefined ? error.line - 1 : 0;
const column = error.column !== undefined ? error.column - 1 : 0;
const endColumn = error.endColumn !== undefined ? error.endColumn - 1 : column + 1;
```

## Test Suite

Created comprehensive fixture-based test suite following `../selfies-js/test/fixtures/programs/` structure:

### Test Structure
```
test/fixtures/programs/
  ├── line-numbers-basic.selfies          # 7 definitions with comments
  ├── line-numbers-with-imports.selfies   # Import line preservation
  ├── line-numbers-errors.selfies         # Error reporting accuracy
  ├── fragments-base.selfies              # Import dependency
  └── runner.test.js                      # Full dictionary matching tests
```

### Test Coverage: **31 tests, 218 assertions, all passing ✓**

#### Fixture Programs (19 tests)
- **line-numbers-basic.selfies**: Line accuracy, SELFIES/SMILES output, VS Code conversion
- **line-numbers-with-imports.selfies**: Import preservation, resolution with dependencies
- **line-numbers-errors.selfies**: Duplicate error reporting, position conversion
- **Edge cases**: Empty files, blank lines, inline comments
- **Integration**: example.selfies validation

#### Samples Directory (12 tests)
Complete testing of all sample files:

**samples/fragments.selfies** (4 tests)
- 9 definitions: methyl, ethyl, propyl, butyl, hydroxyl, amino, carbonyl, carboxyl, phenyl
- Full dictionary matching of line numbers, SELFIES, and SMILES

**samples/test-line-numbers.selfies** (4 tests)
- 10 definitions with comments and blank lines
- Validates line number accuracy through composition

**samples/toluene.selfies** (4 tests)
- 10 definitions including ring structures
- Tests complex molecule resolution

### Full Dictionary Matching Pattern

Every test uses complete object matching (no samples, no `toBeDefined`):

```javascript
// Example: All 9 definitions in fragments.selfies
const expectedLines = {
  methyl: 5, ethyl: 6, propyl: 7, butyl: 8,
  hydroxyl: 11, amino: 12, carbonyl: 13,
  carboxyl: 14, phenyl: 17,
}

const expectedSelfies = {
  methyl: '[C]',
  ethyl: '[C][C]',
  propyl: '[C][C][C]',
  butyl: '[C][C][C][C]',
  hydroxyl: '[O]',
  amino: '[N]',
  carbonyl: '[=O]',
  carboxyl: '[C][=Branch1][C][=O][O]',
  phenyl: '[C][=C][C][=C][C][=C][Ring1][Branch1]',
}

const expectedSmiles = {
  methyl: 'C', ethyl: 'CC', propyl: 'CCC',
  butyl: 'CCCC', hydroxyl: 'O', amino: 'N',
  carbonyl: 'O', carboxyl: 'C(=O)O',
  phenyl: 'C=C1C=CC=C1',
}

// String equality checks (no toBeDefined)
for (const [name, expected] of Object.entries(expectedLines)) {
  const def = program.definitions.get(name)
  expect(def.name).toBe(name)              // String equality
  expect(def.line).toBe(expected)
}

for (const [name, expected] of Object.entries(expectedSelfies)) {
  expect(resolve(program, name)).toBe(expected)  // String equality
}

for (const [name, expected] of Object.entries(expectedSmiles)) {
  expect(resolve(program, name, { decode: true })).toBe(expected)
}
```

## Running Tests
```bash
bun test
# 31 pass, 0 fail, 218 assertions
```

## Line Number System

### Parser (selfies-js)
- **1-based line numbers** (line 1 = first line)
- **1-based column numbers** (column 1 = first character)

### VS Code
- **0-based line numbers** (line 0 = first line)
- **0-based column numbers** (column 0 = first character)

### Conversion
```javascript
vscode_line = parser_line - 1
vscode_column = parser_column - 1
```

## Comment and Import Handling

The parser correctly preserves line numbers:

1. **Comments**: Tokenized but skipped during parsing, don't affect line numbers
2. **Imports**: Replaced with blank lines to preserve line count

Example:
```
Line 1: # Comment
Line 2: import "./file.selfies"  → replaced with blank line
Line 3: [methyl] = [C]           → stays at line 3
```

## CI/CD
Added `.github/workflows/test.yml`:
- Runs full test suite on push/PR to main
- ESLint validation
- Runs on Ubuntu with Bun

## Verification Examples

### Example 1: Basic File
```selfies
# Header
[methyl] = [C]    # Line 2
[methyl] = [N]    # Line 3 - duplicate
```
Parser: `{line: 3, column: 1}` → VS Code: `Position(2, 0)` ✓

### Example 2: With Imports
```selfies
# Comment
import "./base.selfies"
[molecule] = [fragment]  # Line 3
```
Parser: `{line: 3, column: 1}` → VS Code: `Position(2, 0)` ✓

### Example 3: Samples
All 3 sample files tested with full dictionary matching:
- fragments.selfies: 9 definitions ✓
- test-line-numbers.selfies: 10 definitions ✓
- toluene.selfies: 10 definitions ✓

## Testing Methodology

Following `../selfies-js/test/fixtures/programs/runner.test.js`:

1. **Fixture Files**: Real .selfies files with known content
2. **Full Dictionary Matching**: Test ALL expected values, not samples
3. **String Equality**: Use `toBe()` for exact matching, no `toBeDefined()`
4. **Multiple Assertions**: Line numbers, SELFIES, SMILES, VS Code conversion
5. **Comprehensive Coverage**: All fixture programs + all samples directory files

This ensures comprehensive coverage and catches regressions immediately.

## References
- Parser: `../selfies-js/src/dsl/parser.js`
- Parser tests: `../selfies-js/test/importer.test.js` (lines 225-422)
- Fixture tests: `../selfies-js/test/fixtures/programs/runner.test.js`
- VS Code API: https://code.visualstudio.com/api/references/vscode-api#Position
