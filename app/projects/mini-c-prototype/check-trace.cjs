// Standalone mechanism check: node app/projects/mini-c-prototype/check-trace.cjs
/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script */
const fs = require('fs')
const ts = require('typescript')
const assert = require('node:assert/strict')
const vm = require('node:vm')
const path = require('node:path')
// A page module, transpiled, with its own imports of the page's modules
// (`./asm`) loaded the same way.
const load = (file) => {
  const compiled = ts.transpileModule(
    fs.readFileSync(path.join(__dirname, file), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText
  const sandbox = {
    exports: {},
    require: (m) =>
      m.startsWith('./') ? load(`${m.slice(2)}.ts`) : require(m),
  }
  vm.runInNewContext(compiled, sandbox)
  return sandbox.exports
}
const { buildTrace, toSExpression } = load('trace.ts')
const plain = (value) => JSON.parse(JSON.stringify(value))
function run(source) {
  const t = buildTrace(source)
  assert(!t.error, t.error?.message)
  return t
}
assert.deepEqual(
  plain(run('int main(){return 4+2*3;}').instructions.map((i) => i.op)),
  ['li', 'li', 'li', 'mul', 'add', 'return'],
)
assert.deepEqual(
  plain(run('int main(){return (4+2)*3;}').instructions.map((i) => i.op)),
  ['li', 'li', 'add', 'li', 'mul', 'return'],
)
for (const [source, pattern] of [
  ['int main(){return x;}', /no declaration/],
  ['int main(){int x;return x;}', /before it has/],
  ['int main(){return 1\/2;}', /outside/],
  ['int main(){return ;}', /Expected/],
  ['int main(){int x; int x;return 0;}', /already/],
  ['int main(){return 1;return 2;}', /exactly one/],
  ['int main(){int x = 2;return x;}', /no initializer/],
])
  assert.match(buildTrace(source).error.message, pattern)
// Interpret only our bounded instruction objects, never arbitrary source/eval.
function interpret(t, allocated) {
  const regs = {}
  for (const i of t.instructions) {
    const map = (v) => (allocated ? t.registers[v] || v : v)
    const args = i.args.map((x) => (/^v/.test(x) ? regs[map(x)] : Number(x)))
    if (i.op === 'return') return args[0]
    regs[map(i.dest)] =
      i.op === 'li'
        ? args[0]
        : i.op === 'add'
          ? args[0] + args[1]
          : i.op === 'sub'
            ? args[0] - args[1]
            : args[0] * args[1]
  }
}
for (const [source, expected] of [
  ['int main(){return 4+2*3;}', 10],
  ['int main(){return (4+2)*3;}', 18],
  ['int main(){int x;x=4+2;return x*x+3;}', 39],
  ['int main(){int x;int y;x=2;y=x+3;x=y*2;return x-y;}', 5],
]) {
  const t = run(source)
  assert.equal(interpret(t, false), expected)
  assert.equal(interpret(t, true), expected)
  assert.deepEqual(plain(t), plain(run(source)))
  for (const token of t.tokens)
    assert.equal(source.slice(token.start, token.end), token.text)
  for (const frame of t.frames) {
    assert(frame.nodes.every((id) => t.nodes[id]))
    assert(frame.span.start >= 0 && frame.span.end <= source.length)
  }
  const snapshots = t.frames.map((f) => JSON.stringify(f))
  for (let i = t.frames.length - 1; i >= 0; i--)
    assert.equal(JSON.stringify(t.frames[i]), snapshots[i])
}
console.log(
  'PASS: precedence, parentheses, locals, diagnostics, source spans, deterministic seeking, virtual/physical equivalence.',
)

// The sketch's tree must match the real compiler's ASTPrinter output for the presets.
const refSource = fs.readFileSync(path.join(__dirname, 'reference.ts'), 'utf8')
const refCompiled = ts.transpileModule(refSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText
// reference.ts imports the compiler-emitted trace JSON; resolve those here.
const refBox = {
  exports: {},
  require: (m) => ({
    default: JSON.parse(fs.readFileSync(path.join(__dirname, m), 'utf8')),
  }),
}
vm.runInNewContext(refCompiled, refBox)
for (const r of refBox.exports.REFERENCES) {
  // every preset's frames are self-consistent with its own token list
  for (const token of r.trace.tokens)
    assert.equal(r.trace.text.slice(token.start, token.end), token.text, r.name)
  // every frame explains itself: a why with a kind the page knows
  for (const f of r.trace.frames)
    assert.ok(
      f.why && typeof f.why.kind === 'string',
      r.name + ': frame without why',
    )
  const toy = buildTrace(r.source)
  for (const f of toy.frames)
    assert.ok(
      f.why && typeof f.why.kind === 'string',
      r.name + ': toy frame without why',
    )
  // presets that pass semantic analysis carry the real back end
  if (!r.trace.error) {
    const b = r.trace.backend
    assert.ok(b && b.functions.length > 0, r.name + ': no backend')
    const blocks = b.functions.flatMap((f) => f.blocks.map((x) => x.text))
    // (less what can never run, which the allocator leaves out: a jump
    // after `continue` or `break`)
    assert.deepEqual(
      r.trace.instructions.filter((i) => !i.dead).map((i) => i.text),
      blocks,
      r.name + ': instructions differ from CFG blocks',
    )
    const result = Object.assign(
      {},
      ...b.functions.map((f) => f.colouring.result),
    )
    assert.deepEqual(
      r.trace.registers,
      result,
      r.name + ': registers differ from colouring',
    )
    for (const phase of ['Emit', 'Registers'])
      assert.ok(
        r.trace.frames.some((f) => f.phase === phase),
        r.name + ': no ' + phase + ' frames',
      )
    for (const f of r.trace.frames) {
      const w = f.why
      if (w.kind.startsWith('emit.')) {
        assert.ok(
          w.from >= 0 && w.to < r.trace.instructions.length && w.from <= w.to,
          r.name + ': emit range',
        )
        assert.equal(
          f.instructionCount,
          w.to + 1,
          r.name + ': instructionCount',
        )
      }
      if ('step' in w)
        assert.ok(
          (w.abandoned
            ? b.functions[w.fn].abandoned
            : b.functions[w.fn].colouring
          )?.steps[w.step],
          r.name + ': step index',
        )
    }
    // the last frame shows every instruction on a physical register
    const lastFrame = r.trace.frames[r.trace.frames.length - 1]
    assert.equal(lastFrame.why.kind, 'reg.done', r.name)
    for (const v of Object.keys(result))
      assert.ok(
        r.trace.instructions.some((i) => i.dest === v),
        r.name + ': ' + v + ' never defined',
      )
  } else {
    assert.ok(
      !r.trace.frames.some((f) => f.phase === 'Emit'),
      r.name + ': emit frames after an error',
    )
  }
  if (toy.error) continue // loops and calls are outside the toy's subset; the compiler's trace is authoritative
  assert.equal(toSExpression(toy), r.ast, r.name)
}
console.log('trace checks passed')
