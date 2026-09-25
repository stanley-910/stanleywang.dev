// Standalone regressions for the compiler page's name pass, scope tree and
// link routes: npm run check:mini-c
// The custom case needs the local public/mini-c/compiler.js bundle.
/* eslint-disable @typescript-eslint/no-require-imports -- a plain Node script */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

// The page's modules, loaded from their own folder.
const PAGE = path.join(__dirname, '../app/projects/mini-c-prototype')
const modules = new Map()
function load(file) {
  const absolute = path.join(PAGE, file)
  if (modules.has(absolute)) return modules.get(absolute)
  const box = {
    exports: {},
    require: (name) => {
      if (!name.startsWith('.')) return require(name)
      if (name.endsWith('.json')) return require(path.resolve(PAGE, name))
      const local = fs.existsSync(path.join(PAGE, `${name}.tsx`))
        ? `${name}.tsx`
        : `${name}.ts`
      return load(local)
    },
  }
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      fileName: absolute,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText,
    box,
    { filename: absolute },
  )
  modules.set(absolute, box.exports)
  return box.exports
}
const { REFERENCES } = load('reference.ts')
const { withNameSteps, scopesOf } = load('scopes.ts')
const { treePositions } = load('trace.ts')
const { packTray, treeRows } = load('stage-layout.ts')
const { linkRouter } = load('link-route.ts')
const { ScopeTree } = load('scope-tree.tsx')
const { NameLinks } = load('name-links.tsx')
function samples(d) {
  const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number)
  const out = []
  let [x, y] = n
  for (let i = 2; i < n.length; i += 6) {
    const [ax, ay, bx, by, cx, cy] = n.slice(i, i + 6)
    for (let j = 1; j <= 20; j++) {
      const t = j / 20,
        u = 1 - t
      out.push({
        x:
          u * u * u * x +
          3 * u * u * t * ax +
          3 * u * t * t * bx +
          t * t * t * cx,
        y:
          u * u * u * y +
          3 * u * u * t * ay +
          3 * u * t * t * by +
          t * t * t * cy,
      })
    }
    x = cx
    y = cy
  }
  return out
}
function geometry(trace, width, height, narrow) {
  const tree = treePositions(trace, (n) => n.label.length * 7.2 + 2),
    fit = Math.min(1, (width - 48) / tree.width),
    spread = Math.min((width - 48) / tree.width, 3)
  const left = 24 + (width - 48 - tree.width * spread) / 2,
    half = (narrow ? 10 : 11) * fit
  const tray = packTray(trace.tokens, width),
    rows = treeRows(tray, height, tree, half, narrow)
  const boxes = trace.nodes.map((n) => {
    const p = tree.at[n.id],
      w = (n.label.length * 7.2 + 6) * fit
    return {
      x: left + p.x * spread - w / 2,
      y: rows.top + (p.y / Math.max(1, tree.depth)) * rows.band - half,
      w,
      h: half * 2,
    }
  })
  const lastTray =
    (Math.max(
      ...Object.values(tray)
        .filter((p) => p.y <= 150)
        .map((p) => p.y),
    ) *
      height) /
      480 +
    (narrow ? 10 : 11)
  assert(
    boxes[trace.root].y >= lastTray + 15.99,
    'Root clears all visible tray rows',
  )
  assert(
    boxes.every((b) => b.y + b.h <= height - 15.99),
    'Tree fits stage vertically',
  )
  const edges = trace.nodes.flatMap((n) =>
    n.children.map((c) => ({
      from: {
        x: boxes[n.id].x + boxes[n.id].w / 2,
        y: boxes[n.id].y + boxes[n.id].h,
      },
      to: { x: boxes[c].x + boxes[c].w / 2, y: boxes[c].y },
    })),
  )
  return {
    boxes,
    router: linkRouter(boxes, {
      edges,
      walls: [],
      bounds: { x: 4, y: 4, w: width - 8, h: height - 8 },
    }),
  }
}
let routes = 0,
  fallback = 0
function check(trace) {
  const scopes = scopesOf(trace)
  const done = trace.frames.find((f) => f.why.kind === 'check.namesDone')
  for (const f of trace.frames.filter((f) => f.why.kind === 'check.resolve')) {
    assert(
      f.links.some(([u, d]) => u === f.why.use && d === f.why.decl),
      'Current resolve always has its route pair',
    )
    const html = renderToStaticMarkup(
      React.createElement(ScopeTree, {
        trace,
        scopes,
        frame: f,
        duration: 0,
      }),
    )
    assert.equal(
      (html.match(/class="[^"]*\bhere\b[^"]*"/g) || []).length,
      1,
      'One current scope',
    )
    assert(html.includes('found ok'), 'Scope declaration lights with lookup')
  }
  if (done) {
    const html = renderToStaticMarkup(
      React.createElement(ScopeTree, {
        trace,
        scopes,
        frame: done,
        duration: 0,
      }),
    )
    assert(!html.includes('ac-scope-empty'), 'Inactive empty scopes omitted')
    for (const [width, height, narrow] of [
      [960, 690, false],
      [680, 480, false],
      [360, 380, false],
      [342, 300, true],
      [260, 300, true],
    ]) {
      const { boxes, router } = geometry(trace, width, height, narrow)
      for (const [use, decl] of done.links ?? []) {
        const r = router.route(boxes[use], boxes[decl])
        routes++
        assert(
          r.d && !/NaN|Infinity/.test(r.d),
          'Every binding has a finite route',
        )
        if (!r.clean) {
          fallback++
          continue
        }
        for (const p of samples(r.d))
          for (const b of boxes.filter((_, i) => i !== use && i !== decl))
            assert(
              !(
                p.x > b.x + 0.1 &&
                p.x < b.x + b.w - 0.1 &&
                p.y > b.y + 0.1 &&
                p.y < b.y + b.h - 0.1
              ),
              `Clean route crosses a piece at ${width}: ${use}-${decl}`,
            )
      }
    }
  }
}
async function main() {
  for (const ref of REFERENCES) check(withNameSteps(ref.trace))
  // The resolve step carries the binding even if the recorder drops its list.
  const ref = REFERENCES.find((r) => r.name.toLowerCase() === 'loop')
  const stripped = {
    ...ref.trace,
    frames: ref.trace.frames.map((f) => ({ ...f, links: undefined })),
  }
  check(withNameSteps(stripped))
  const custom = ref.source.replace('int main() {', 'int main() {\n  int n;')
  const compiler = await import(
    `data:text/javascript;base64,${fs.readFileSync(path.join(__dirname, '../public/mini-c/compiler.js')).toString('base64')}`
  )
  const trace = withNameSteps(JSON.parse(compiler.trace(custom)).trace)
  check(trace)
  const scopes = scopesOf(trace)
  const target = trace.frames.find(
    (f) =>
      f.why.kind === 'check.resolve' &&
      trace.nodes[f.why.use].kind === 'assign' &&
      trace.tokens[trace.nodes[f.why.use].token].text === 'sum' &&
      scopes.scopeOf(f.why.use) > 1,
  )
  const html = renderToStaticMarkup(
    React.createElement(ScopeTree, {
      trace,
      scopes,
      frame: target,
      duration: 0,
    }),
  )
  assert(
    /class="ac-scope-name here">block<\/span>/.test(html),
    'Empty block is current at inner target',
  )
  assert(
    /ac-scope-empty"[^>]*>empty/.test(html),
    'Current empty scope is explicit',
  )
  // A blocked grid still returns a drawable arc.
  const a = { x: 10, y: 30, w: 20, h: 20 },
    b = { x: 100, y: 30, w: 20, h: 20 }
  const blocked = linkRouter([a, b], {
    walls: [{ x: 0, y: 0, w: 140, h: 100 }],
    bounds: { x: 0, y: 0, w: 140, h: 100 },
  }).route(a, b)
  const rendered = renderToStaticMarkup(
    React.createElement(
      'svg',
      null,
      React.createElement(NameLinks, {
        links: [[1, 2]],
        routes: new Map([['1-2', blocked]]),
        frame: { why: { kind: 'check.resolve', use: 1, decl: 2 }, focus: 0 },
        hover: null,
        reduced: true,
        duration: 0,
      }),
    ),
  )
  assert(rendered.includes('data-clean="false"'), 'Fallback stays in the SVG')
  assert(
    rendered.includes('class="ac-link ok"'),
    'The active binding draws green even when focus differs',
  )
  assert.equal(blocked.clean, false)
  assert(blocked.d && !/NaN|Infinity/.test(blocked.d))
  console.log(
    `PASS: tray clearance, current/empty scopes, missing link lists, ${routes} routes (${fallback} visible fallbacks), custom loop.`,
  )
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
