// Compares a gate run with the golden one, stage by stage.
// Run: node scripts/meadow-gate/compare.cjs [run.json] [golden.json]
const fs = require('node:fs')
const path = require('node:path')

const read = (p) => {
  const text = fs.readFileSync(p, 'utf8')
  // The browser tool wraps the JSON it saves in a fenced block.
  const from = text.indexOf('{')
  return JSON.parse(text.slice(from, text.lastIndexOf('}') + 1))
}
const run = read(process.argv[2] ?? path.join(__dirname, '.out', 'run.json'))
const gold = read(process.argv[3] ?? path.join(__dirname, 'golden.json'))
const stages = ['record', 'cells', 'raw', 'type', 'page', 'pixels']
// A change to what is recorded that leaves the picture alone lists the stages it may move.
const allow = new Set((process.env.ALLOW ?? '').split(',').filter(Boolean))

let bad = 0
const firsts = {}
if (run.frames.length !== gold.frames.length) {
  console.log(`frame count ${run.frames.length}, golden ${gold.frames.length}`)
  bad++
}
const n = Math.min(run.frames.length, gold.frames.length)
for (let i = 0; i < n; i++) {
  const a = run.frames[i]
  const b = gold.frames[i]
  for (const s of stages) {
    if (a[s] === b[s] || allow.has(s)) continue
    bad++
    firsts[s] ??= `${a.name} #${a.i}`
  }
}
const segments = new Set(gold.frames.map((f) => f.name)).size
if (bad) {
  console.log(`MISMATCH: ${bad} hashes differ. First by stage:`)
  for (const s of stages) if (firsts[s]) console.log(`  ${s}: ${firsts[s]}`)
  process.exit(1)
}
console.log(
  `same: ${n} frames in ${segments} segments, stages ${stages.filter((s) => !allow.has(s)).join(', ')} (${run.ms} ms, golden ${gold.ms} ms)`,
)
