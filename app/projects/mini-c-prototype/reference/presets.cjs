// Writes presets.json, what the page needs of each example before its trace
// loads (the picker's name and source, its register cap, whether it stops
// at an error): node app/projects/mini-c-prototype/reference/presets.cjs
// Rerun it after recording a trace; check-trace.cjs fails if it's stale.
/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script */
const fs = require('node:fs')
const path = require('node:path')

// Programs first, simplest to showiest; then the errors, one per phase
// they stop in, and classes, which the code generator can't compile. The
// page opens on the first (Stanley, 2026-10-02). Lineup:
// docs/handoffs/2026-09-28-example-candidates.md and GPT-6 Astra's
// 2026-09-28-example-lineup-astra-answer.md. Traces are recorded with the
// page's compiler bundle, as trace.sh would with the JVM.
const LINEUP = [
  ['Hello world', 'hello-world'],
  ['Precedence', 'precedence'],
  ['Function call', 'function-call'],
  ['Loop', 'loop'],
  ['Shadowing', 'shadowing'],
  ['Fibonacci', 'fibonacci'],
  ['Break and continue', 'break-continue'],
  ['Pointer', 'pointer'],
  ['Struct fields', 'struct-fields'],
  // Compiled with four registers, so a five-term sum runs out (Stanley,
  // 2026-10-06); recorded with compiler.js, trace(source, 4).
  ['Spilling', 'spilling', 4],
  ['Missing semicolon', 'missing-semicolon'],
  ['Unresolved name', 'unresolved-name'],
  ['Wrong type', 'wrong-type'],
  ['Classes', 'classes'],
]

const presets = (dir = __dirname) =>
  LINEUP.map(([name, file, registers]) => {
    const trace = JSON.parse(
      fs.readFileSync(path.join(dir, `${file}.trace.json`), 'utf8'),
    )
    return {
      name,
      file,
      source: (trace.text ?? '').replace(/\s+$/, ''),
      ...(registers ? { registers } : {}),
      error: !!trace.error,
    }
  })

module.exports = { presets }
if (require.main === module)
  fs.writeFileSync(
    path.join(__dirname, 'presets.json'),
    JSON.stringify(presets(), null, 2) + '\n',
  )
