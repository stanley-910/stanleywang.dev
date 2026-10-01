// Compare render inputs with a saved showcase directory:
// node app/projects/mini-c-prototype/review/check-render-perf.cjs /path/to/baseline
// Hooks retain memo/ref state, but no DOM is mounted. This checks geometry,
// copy and Motion props; its timings exclude reconciliation, layout and paint.
/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node check */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const { createRequire } = require('node:module')
const req = createRequire(path.join(process.cwd(), 'package.json'))
const ts = req('typescript')
const cwd = path.join(process.cwd(), 'app/projects/mini-c-prototype')
if (!process.argv[2])
  throw new Error('Pass the baseline mini-c-prototype directory')
const baseline = path.resolve(process.argv[2])
const source = `struct Node {
  int value;
  char tag;
  struct Node* next;
};

int main() {
  struct Node* a;
  struct Node* b;
  int* pv;
  char name[4];
  char* s;
  a = (struct Node*)mcmalloc(sizeof(struct Node));
  b = (struct Node*)mcmalloc(sizeof(struct Node));
  (*a).value = 7;
  (*a).tag = 'a';
  (*a).next = b;
  (*b).value = (int)(*a).tag;
  pv = &(*b).value;
  *pv = *pv + (*(*a).next).value;
  name[0] = (*a).tag;
  s = (char*)name;
  return (*b).value;
}`
function harness(root, controls) {
  const slots = []
  let cursor = 0
  let stats = { routes: 0, routers: 0 }
  const effects = []
  const slot = (make) => {
    const i = cursor++
    return (slots[i] ??= make())
  }
  const memo = (fn, deps) => {
    const s = slot(() => ({}))
    if (!s.deps || !deps || deps.some((d, i) => !Object.is(d, s.deps[i]))) {
      s.value = fn()
      s.deps = deps
    }
    return s.value
  }
  const react = {
    useState: (init) => [
      slot(() => ({ value: typeof init === 'function' ? init() : init })).value,
      () => {},
    ],
    useRef: (value) => slot(() => ({ current: value })),
    useMemo: memo,
    useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect: () => {
      cursor++
    },
    useLayoutEffect: (fn) => {
      cursor++
      effects.push(fn)
    },
    memo: (fn) => fn,
    Fragment: 'Fragment',
  }
  const test = {
    state(name, init) {
      const state = react.useState(init)
      return [
        Object.hasOwn(controls, name) ? controls[name] : state[0],
        state[1],
      ]
    },
    route: () => {
      stats.routes++
    },
    router: () => {
      stats.routers++
    },
  }
  const jsx = (type, props, key) => ({ type, props, key })
  const motion = new Proxy({}, { get: (_, k) => `motion.${k}` })
  const mods = new Map()
  function load(file) {
    if (mods.has(file)) return mods.get(file)
    if (file.endsWith('.json')) return JSON.parse(fs.readFileSync(file, 'utf8'))
    let src = fs.readFileSync(file, 'utf8')
    if (file.endsWith('link-route.ts')) {
      src = src.replace(
        'const route = (from: Box, to: Box): Route => {',
        'const route = (from: Box, to: Box): Route => { test.route();',
      )
    }
    let js = ts.transpileModule(src, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText
    if (file.endsWith('animated.tsx'))
      js = js.replace(
        /const \[(\w+), (\w+)\] = \(0, react_\d+\.useState\)\(/g,
        'const [$1, $2] = test.state("$1", ',
      )
    const loaded = { exports: {} }
    mods.set(file, loaded.exports)
    function local(m) {
      if (m.endsWith('.css')) return {}
      if (m === 'react') return react
      if (m === 'react/jsx-runtime')
        return { jsx, jsxs: jsx, Fragment: 'Fragment' }
      if (m === 'motion/react')
        return {
          motion,
          AnimatePresence: 'AnimatePresence',
          useMotionValue: (x) => x,
          useReducedMotion: () => controls.reduced ?? false,
          useDragControls: () => null,
        }
      if (m === 'next-themes')
        return { useTheme: () => ({ resolvedTheme: 'light' }) }
      if (m === 'next/link') return { __esModule: true, default: 'Link' }
      if (m === 'lucide-react') return new Proxy({}, { get: (_, k) => k })
      if (!m.startsWith('.')) throw new Error(m)
      let target = path.resolve(path.dirname(file), m)
      if (!path.extname(target))
        target = ['.ts', '.tsx', '.json']
          .map((ext) => target + ext)
          .find((x) => fs.existsSync(x))
      return load(target)
    }
    vm.runInThisContext(`(function(require,module,exports,test){${js}\n})`, {
      filename: file,
    })(local, loaded, loaded.exports, test)
    if (file.endsWith('link-route.ts')) {
      const impl = loaded.exports.linkRouter
      loaded.exports.linkRouter = (...args) => {
        stats.routers++
        return impl(...args)
      }
    }
    return loaded.exports
  }
  const component = load(path.join(root, 'animated.tsx')).default
  // Compare the render's DOM/Motion props, expanding only the extracted edge
  // and the two children whose data intentionally became lazy/memoized.
  function normalize(x) {
    if (x == null || typeof x === 'boolean') return x
    if (typeof x === 'function') return '[handler]'
    if (typeof x !== 'object') return x
    if (Array.isArray(x)) return x.map(normalize)
    if (x instanceof Map) return [...x].map(normalize)
    if (x instanceof Set) return [...x].map(normalize)
    if (x.type) {
      const name = typeof x.type === 'function' ? x.type.name : x.type
      if (['TreeEdge', 'NameLinks', 'ProofTree'].includes(name))
        return normalize(x.type(x.props))
      if (name === 'GlidingPath') {
        const { d, glide, ...rest } = x.props
        return { type: name, props: normalize({ d, glide, ...rest }) }
      }
      return { type: name, key: x.key, props: normalize(x.props) }
    }
    const out = {}
    for (const [k, v] of Object.entries(x))
      if (k !== 'ref') out[k] = normalize(v)
    return out
  }
  return {
    load,
    stats: () => stats,
    resetStats: () => {
      stats = { routes: 0, routers: 0 }
    },
    render(compare = true) {
      cursor = 0
      effects.length = 0
      const start = performance.now()
      const tree = component()
      const ms = performance.now() - start
      const out = compare ? normalize(tree) : undefined
      for (const fn of effects) fn()
      return { out, ms }
    },
  }
}
async function main() {
  const compiler = await import(
    path.join(process.cwd(), 'public/mini-c/compiler.js')
  )
  const large = JSON.parse(compiler.trace(source)).trace
  assert(!large.error, JSON.stringify(large.error))
  console.log(
    'Large raw trace:',
    large.nodes.length,
    'nodes,',
    large.frames.length,
    'frames',
  )
  const widerSource = source.replace(
    '  return (*b).value;',
    '  (*b).value = (*b).value + 1;\n'.repeat(12) + '  return (*b).value;',
  )
  const wider = JSON.parse(compiler.trace(widerSource)).trace
  assert(!wider.error, JSON.stringify(wider.error))
  console.log(
    'Wider raw trace:',
    wider.nodes.length,
    'nodes,',
    wider.frames.length,
    'frames',
  )
  const cases = [
    ['large', large],
    ['wider', wider],
    ...[
      'fibonacci',
      'struct-fields',
      'break-continue',
      'wrong-type',
      'unresolved-name',
      'missing-semicolon',
      'classes',
      'precedence',
      'loop',
      'function-call',
      'pointer',
      'shadowing',
    ].map((n) => [
      n,
      JSON.parse(
        fs.readFileSync(path.join(cwd, 'reference', n + '.trace.json')),
      ),
    ]),
  ]
  let checked = 0
  for (const [name, trace] of cases) {
    const controls = {
      source: trace.text,
      real: { source: trace.text, trace },
      step: 0,
      slide: 0,
      hover: null,
    }
    const a = harness(baseline, controls),
      b = harness(cwd, controls)
    const withType = a.load(path.join(baseline, 'type-view.ts')).withTypeSteps
    const withEmit = a.load(path.join(baseline, 'emit-view.ts')).withEmitLines
    const without = a.load(path.join(baseline, 'regs-view.ts')).withoutLiveness
    const frames = withType(without(withEmit(trace))).frames
    console.log('Checking', name, frames.length, 'frames')
    const steps = frames.map((_, i) => i)
    // All frames forward, then reverse seeks, different hover targets and sizes.
    const noNudge = new Map()
    const samples = steps
      .map((step) => ({ step }))
      .concat(
        steps
          .filter((i) => i % 11 === 0)
          .reverse()
          .map((step) => ({ step, hover: frames[step].focus })),
        steps
          .filter((i) => i % 19 === 0)
          .map((step) => ({
            step,
            sceneWidth: 360,
            sceneHeight: 600,
            narrow: true,
            hover: frames[step].focus,
          })),
      )
    a.render(false)
    b.render(false)
    a.resetStats()
    b.resetStats()
    const deck = steps.filter(
      (i) =>
        i === 0 ||
        frames[i + 1]?.phase !== frames[i].phase ||
        frames[i].why.kind === 'check.namesDone',
    )
    samples.push(
      ...deck.flatMap((step) =>
        [1, 2, 3].map((slide) => ({ step, slide, hover: frames[step].focus })),
      ),
    )
    samples.push(
      ...steps
        .filter((i) => i % 23 === 0)
        .map((step) => ({
          step,
          hover: frames[step].focus,
          speed: 2,
          reduced: true,
          dragging: frames[step].focus,
          nudged: new Map([[frames[step].focus, { x: 13, y: 8 }]]),
        })),
    )
    samples.push(
      ...steps
        .filter((i) => i % 29 === 0)
        .map((step) => ({
          step,
          emitBlocks: true,
          detailed: true,
          speed: 0.5,
        })),
    )
    const timesA = [],
      timesB = []
    for (const sample of samples) {
      Object.assign(
        controls,
        {
          hover: null,
          sceneWidth: 680,
          sceneHeight: 480,
          narrow: false,
          slide: 0,
          speed: 1,
          reduced: false,
          dragging: null,
          nudged: noNudge,
          emitBlocks: false,
          detailed: false,
        },
        sample,
      )
      const one = a.render(),
        two = b.render()
      try {
        assert.deepEqual(two.out, one.out)
      } catch (e) {
        fs.writeFileSync(
          '/tmp/mini-c-render-before.json',
          JSON.stringify(one.out, null, 2),
        )
        fs.writeFileSync(
          '/tmp/mini-c-render-after.json',
          JSON.stringify(two.out, null, 2),
        )
        console.log('FAILED', name, sample, frames[sample.step]?.why)
        throw e
      }
      timesA.push(one.ms)
      timesB.push(two.ms)
      checked++
    }
    const sum = (xs) => xs.reduce((a, b) => a + b, 0)
    console.log(
      JSON.stringify({
        name,
        frames: frames.length,
        renders: samples.length,
        before: { ...a.stats(), renderMs: sum(timesA) },
        after: { ...b.stats(), renderMs: sum(timesB) },
      }),
    )
  }
  console.log(
    'PASS identical render props:',
    checked,
    'cases, including reverse seeks, hover, slides, drag, speeds and view modes',
  )
}
main().catch((e) => {
  console.error(e.message.slice(0, 3000))
  process.exitCode = 1
})
