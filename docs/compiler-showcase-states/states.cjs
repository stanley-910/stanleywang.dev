// Every distinct UI state of the compiler prototype, as [label, setup].
// Usage: node states.cjs --dry            -> PNGs in ./states/, one status line each
//        node states.cjs ids.json         -> also sends each state to Figma, ids.json = { label: captureId }
const fs = require('fs')
const { chromium } = require('playwright-core')
const exe = `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
const URL = 'http://127.0.0.1:3107/projects/mini-compiler'
const OUT = `${__dirname}/states`
const CUSTOM = 'int main() {\n  int a;\n  int b;\n  int c;\n  int d;\n  a = 10;\n  b = 5;\n  c = 3;\n  d = 8;\n  return a + b * c - d;\n}'
const CUSTOM_ERR = 'int main() {\n  int a;\n  a = 20;\n  return a / 4 * 2;\n}'

const hover = (sel) => async (p) => { await p.locator(sel).first().hover(); await p.waitForTimeout(700) }
const click = (sel) => async (p) => { await p.locator(sel).first().click(); await p.waitForTimeout(400) }
const key = (...ks) => async (p) => { for (const k of ks) await p.keyboard.press(k) }

// [label, preset | {custom}, frame | 'end', extra actions, viewport]
const STATES = [
  ['01 tokens · idle', 'loop', 0, []],
  ['02 tokens · streaming', 'loop', 20],
  ['03 tokens · done', 'loop', 45],
  ['04 tokens · hover token', 'loop', 45, [hover('[aria-label^="Token while"]')]],
  ['05 parse · first node', 'loop', 46],
  ['06 parse · close', 'loop', 51],
  ['07 parse · waiting', 'loop', 57],
  ['08 parse · precedence', 'loop', 65],
  ['09 parse · group', 'parentheses', 18],
  ['10 parse · tree done', 'loop', 83],
  ['12 parse · hover node', 'loop', 83, [hover('[aria-label="AST while: while"]')]],
  ['13 check · resolve', 'loop', 84],
  ['14 check · names done', 'loop', 89],
  ['15 check · types', 'loop', 90],
  ['16 check · unresolved name', 'unresolved name', 21],
  ['17 check · error end', 'unresolved name', 'end'],
  ['18 emit · prologue', 'loop', 93],
  ['19 emit · instructions', 'loop', 104],
  ['20 emit · epilogue', 'loop', 119],
  ['21 emit · hover instruction', 'loop', 119, [hover('.ac-ins >> nth=14')]],
  ['22 regs · cfg', 'loop', 120],
  ['23 regs · liveness sweep 1', 'loop', 121],
  ['24 regs · liveness last sweep', 'loop', 123],
  ['25 regs · interference', 'loop', 124],
  ['26 regs · simplify start', 'loop', 125],
  ['27 regs · simplify mid', 'loop', 138],
  ['28 regs · select start', 'loop', 148],
  ['29 regs · select mid', 'loop', 160],
  ['30 regs · done', 'loop', 171],
  ['31 regs · hover register', 'loop', 171, [hover('[aria-label^="Virtual register v16"]')]],
  ['32 regs · two functions', 'function call', 70],
  ['33 ui · playing 2x', 'loop', 60, [key('=', ' '), async (p) => p.waitForTimeout(900)]],
  ['34 ui · about open', 'loop', 83, [click('.ac-about summary')]],
  ['36 custom · tree done', { custom: CUSTOM }, 'Parse-end'],
  ['37 custom · emit', { custom: CUSTOM }, 'Emit-end'],
  ['38 custom · registers', { custom: CUSTOM }, 'end'],
  ['39 custom · error', { custom: CUSTOM_ERR }, 'end'],
  ['40 mobile · parse done', 'loop', 83, [], { width: 390, height: 844 }],
  ['41 mobile · regs done', 'loop', 171, [], { width: 390, height: 844 }],
]

async function counter(p) {
  const t = await p.locator('.ac-counter').innerText()
  const [i, last] = t.split('/').map(Number)
  return { i, last }
}

async function goTo(p, frame) {
  await p.keyboard.press('r')
  const { last } = await counter(p)
  let target = frame
  if (frame === 'end') target = last
  else if (typeof frame === 'string') {
    // '<Phase>-end': last frame before the next phase starts
    const next = { Tokens: '2', Parse: '3', Check: '4', Emit: '5' }[frame.split('-')[0]]
    await p.keyboard.press(next)
    await p.keyboard.press('j')
    return
  }
  // one seek via the scrubber, so the status line animates once instead of 171 times
  await p.evaluate((v) => {
    const el = document.querySelector('.ac-keys input[type=range], input[type=range]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, target)
  await p.waitForTimeout(300)
}

;(async () => {
  const ids = process.argv[2] && process.argv[2] !== '--dry' ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null
  const only = process.argv[3]
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: exe })
  for (const [label, preset, frame, actions = [], viewport = { width: 1280, height: 850 }] of STATES) {
    if (only && label.slice(0, 2) > only) continue
    if (ids && !ids[label]) continue
    const page = await browser.newPage({ viewport, colorScheme: 'dark' })
    page.on('pageerror', (e) => console.log(`[${label} pageerror]`, e.message.slice(0, 200)))
    await page.goto(URL, { waitUntil: 'networkidle' })
    await page.evaluate(() => { const s = document.querySelector('section.ac'); s.style.background = getComputedStyle(document.body).backgroundColor; s.style.padding = '24px' })
    if (typeof preset === 'string') {
      await page.selectOption('select[aria-label="Example program"]', { label: preset })
    } else {
      await page.locator('.ac-source textarea, textarea.ac-source, .ac-editor textarea').first().fill(preset.custom)
      await page.keyboard.press('Escape')
    }
    await page.locator('.ac-top').click({ position: { x: 2, y: 2 } })
    await goTo(page, frame)
    for (const a of actions) await a(page)
    await page.waitForTimeout(900)
    const status = await page.locator('.ac-note-title').innerText().catch(() => '?')
    const { i, last } = await counter(page)
    const extras = ['.ac-hover', '.ac-about[open]', '.ac-diag']
    const present = []
    for (const s of extras) if (await page.locator(s).count()) present.push(s)
    const file = `${OUT}/${label.replace(/[^a-z0-9]+/gi, '-')}.png`
    await page.locator('section.ac').screenshot({ path: file })
    let sent = ''
    if (ids) {
      await page.waitForFunction(() => window.figma && window.figma.captureForDesign, null, { timeout: 15000 })
      const cid = ids[label]
      // captureForDesign never resolves after uploading, so wait on the submit request instead
      const submitted = page.waitForResponse((res) => res.url().includes(`/capture/${cid}/submit`), { timeout: 60000 })
      await page.evaluate((c) => { window.figma.captureForDesign({ captureId: c, endpoint: `https://mcp.figma.com/mcp/capture/${c}/submit?bindVariables=true`, selector: 'section.ac' }) }, cid)
      const res = await submitted
      sent = ` -> submit ${res.status()}`
    }
    console.log(`${label.padEnd(30)} ${String(i).padStart(3)}/${last}  [${present.join(' ')}]  ${status.slice(0, 60)}${sent}`)
    await page.close()
  }
  await browser.close()
})()
