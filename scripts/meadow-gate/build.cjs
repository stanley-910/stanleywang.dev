// Transpiles the meadow's engine to plain ES modules beside the gate's page, so a browser can run
// the real engine on a fixed sequence without the app. Run: node scripts/meadow-gate/build.cjs
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const root = path.join(__dirname, '..', '..')
const src = path.join(root, 'components', 'garden', 'engine')
const out = path.join(__dirname, '.out')
const eng = path.join(out, 'eng')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(eng, { recursive: true })

for (const f of fs.readdirSync(src)) {
  if (!f.endsWith('.ts')) continue
  const js = ts
    .transpileModule(fs.readFileSync(path.join(src, f), 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        useDefineForClassFields: true,
        verbatimModuleSyntax: false,
      },
    })
    .outputText.replace(/from '(\.\/[\w.-]+)'/g, "from '$1.mjs'")
  if (/from '@\//.test(js))
    throw new Error(`${f} imports app code at run time; the gate can't load it`)
  fs.writeFileSync(path.join(eng, f.replace(/\.ts$/, '.mjs')), js)
}
for (const f of ['gate.html', 'scenario.mjs'])
  fs.copyFileSync(path.join(__dirname, f), path.join(out, f))
console.log(`meadow gate built in ${path.relative(root, out)}`)
