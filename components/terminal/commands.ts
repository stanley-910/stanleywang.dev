import {
  BLOG_POSTS,
  EMAIL,
  EXPERIENCE_POSTS,
  PROJECTS,
  WORK_EXPERIENCE,
} from '@/app/data'
import { PHOTOS } from '@/app/photos/photos'

// The terminal's commands (design/circadian-meadow/components/Terminal). Each
// returns its output as lines of light markup: {g|text} a command, {u|text}
// you, {h|text} a place, {m|text} muted, {y|text} a value, {e|text} an error.
// Help's descriptions are the old terminal site's words; the meadow's lines
// are drafts.

export type Ctx = {
  /** Where the shell is: `~` for home, `~/projects` and so on. */
  path: string
  hour: number
  /** Following the clock, not a set hour. */
  follow: boolean
  wind: number
  history: string[]
  go: (path: string) => void
  /** A page on the site, by its URL. */
  visit: (url: string) => void
  /** Prints a text file from the site once it arrives. */
  cat: (url: string) => void
  setHour: (hour: number | null) => void
  setWind: (wind: number) => void
  gust: () => void
  /** The old site's wave field, over the screen until a key. */
  waves: () => void
  regrow: (seed: number) => void
  meadowHere: () => boolean
  open: (url: string) => void
  copy: (text: string) => void
  clear: () => void
  close: () => void
}

const PAGES = ['meadow', 'projects', 'photos', 'writing', 'music']
const ROUTES: Record<string, string> = {
  '~': '/',
  '~/projects': '/projects',
  '~/photos': '/photos',
  '~/writing': '/writing',
  '~/music': '/music',
}
export const pathFor = (route: string) =>
  Object.keys(ROUTES).find((p) => p !== '~' && route.startsWith(ROUTES[p])) ??
  '~'
export const routeFor = (path: string) => ROUTES[path] ?? '/'

const GITHUB = 'https://github.com/stanley-910'
const LINKEDIN = 'https://www.linkedin.com/in/notstanleywang/'

// Kept from the old site's docs, word for word. The poems live only here, not
// on the writing page.
const FILES: Record<string, string[]> = {
  'II-truth.txt': [
    'II. [tɹuθ] Truth',
    'that beckons the lungs into disfunction. he tastes a half-breath, ever quick on the draw,',
    'the swallow stuck in the squeeze of his throat, like',
    'reluctance falling back in on itself.',
    '   she laughs in poems,',
    '     cries in fluttered kisses,',
    '       dances too.',
    'no one but them and the night sky could feel his knees bruise and pop',
    'under the weight of wooden ground she believed existed only to hold him down.',
    '   like a flame consumed.',
  ],
  'rain-steam-and-speed-JMW-Turner.txt': [
    'softly,',
    'the breath under your lips begins to feel mine',
    'your heart,',
    'defiant,',
    'tries to break the silence.',
    'it is fast & barely noticeable,',
    'yet it is mine still.',
    '',
    'Nowhere to go.',
    '',
    'hints of red steam towards it',
    'Forever:',
  ],
  'no-hands.txt': [
    'no hands dirtied,',
    'slathered with the sounds,',
    'all to elicit now -',
    'what felt like you back then',
  ],
  'real-testimonials.txt': [
    '"Definitely a coder" - some',
    '"Dastardly handsome" - others {m|(mostly my girlfriend)}',
    '"This is a guy you want behind the keyboard" - anyone who\'s heard me play the piano',
    '"He\'s alright" - my mom',
  ],
  'enjoy-your-stay.txt': [
    ...Array.from({ length: 11 }, () => 'enjoy your stay'),
    'enjoy',
  ],
}
const EXES = ['waves.exe', 'datamines.exe']

const WORK = WORK_EXPERIENCE.map((w) => ({
  key: w.company.split(' ')[0].toLowerCase().replace('electronic', 'ea'),
  ...w,
}))

/** The README's keyframes, named. */
export function phase(h: number) {
  if (h < 4.5 || h >= 21.4) return 'night'
  if (h < 7.75) return 'dawn'
  if (h < 16.9) return 'day'
  if (h < 18.4) return 'golden hour'
  if (h < 19.6) return 'sunset'
  return 'twilight'
}

export function hhmm(h: number) {
  const m = Math.round(h * 60) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

const pad = (s: string, n: number) => s + ' '.repeat(Math.max(1, n - s.length))

const HELP = [
  'Available commands:',
  '  {g|projects}  List my most recent projects',
  '  {g|work}      List a timeline of my work experience',
  '  {g|github}  {g|linkedin}  {g|resume}  {g|email}',
  '  {g|cd}  {g|ls}  {g|cat}  {g|open}  {g|tree}',
  '',
  '  {g|time}      Set the hour: time 19:00, or time now',
  '  {g|wind}      Set the breeze: wind 0.6',
  '  {g|regrow}    Grow a new meadow',
  '',
  '{y|[tab]} complete  {y|[ctrl+l]} clear  {y|[`]} open or close',
]

const NAMES = [
  'help',
  'projects',
  'work',
  'github',
  'linkedin',
  'resume',
  'email',
  'cd',
  'ls',
  'cat',
  'tree',
  'pwd',
  'echo',
  'whoami',
  'date',
  'history',
  'clear',
  'exit',
  'sudo',
  'rm',
  'mkdir',
  'touch',
  'vim',
  'open',
  'time',
  'wind',
  'regrow',
  ...EXES.map((e) => `./${e}`),
]

/** Off home, the meadow commands say where the meadow is. */
const elsewhere = ["{m|The meadow's at home. 'cd ~' to see it.}"]

/** Something in a folder: how ls shows it, what open does, and what cat prints. */
type Item = {
  name: string
  shown: string
  open: (ctx: Ctx) => string[]
  cat?: (ctx: Ctx) => string[]
}

const POSTS = [...BLOG_POSTS, ...EXPERIENCE_POSTS].sort((a, b) =>
  b.date.localeCompare(a.date),
)
const tail = (url: string) => url.split('/').pop() ?? url

/** What's in a folder, from the site's own lists: the writing page's posts,
 * the photos page's prints, the projects page's cards. */
function folder(path: string): Item[] {
  switch (path) {
    case '~':
      return [
        ...PAGES.slice(1).map((p) => ({
          name: `${p}/`,
          shown: `{h|${p}/}`,
          open: (ctx: Ctx) => (ctx.go(`~/${p}`), []),
        })),
        ...Object.keys(FILES).map((f) => ({
          name: f,
          shown: f,
          open: () => [...FILES[f]],
          cat: () => [...FILES[f]],
        })),
        ...EXES.map((e) => ({
          name: e,
          shown: `{g|${e}}`,
          open: (ctx: Ctx) => runExe(e, ctx),
        })),
        {
          name: 'resume.pdf',
          shown: 'resume.pdf',
          open: (ctx: Ctx) => (ctx.open('/resume'), ['Opening resume...']),
        },
      ]
    case '~/projects':
      return PROJECTS.map((p) => ({
        name: `${p.slug}/`,
        shown: `{h|${p.slug}/}`,
        open: (ctx: Ctx) => (
          ctx.visit(`/projects#${p.slug}`), [`Opening ${p.name}...`]
        ),
      }))
    case '~/writing':
      return POSTS.map((p) => {
        const name = `${tail(p.link)}.md`
        return {
          name,
          shown: name,
          open: (ctx: Ctx) => (ctx.visit(p.link), [`Opening ${p.title}...`]),
          cat: (ctx: Ctx) => (ctx.cat(`/api/md${p.link}`), []),
        }
      })
    case '~/photos':
      return PHOTOS.flatMap((p) => (p.src ? [p.src] : [])).map((src) => {
        const name = tail(src)
        return {
          name,
          shown: name,
          open: (ctx: Ctx) => (ctx.go('~/photos'), [`Opening ${name}...`]),
          cat: () => [`cat: ${name}: a photo, not text. Try 'open ${name}'`],
        }
      })
  }
  return []
}

/** A folder named from where the shell is: `writing`, `..`, `~/photos`. */
function dirOf(arg: string, path: string): string | null {
  const d = arg
    .replace(/\/+$/, '')
    .replace(/^~\/?/, '')
    .replace(/^\.\/?/, '')
  if (!d || d === '..' || d === 'meadow')
    return d || arg.startsWith('~') ? '~' : path
  if (PAGES.includes(d)) return `~/${d}`
  return null
}

/** An item named from where the shell is: `no-hands.txt`, `writing/dijkstras-algorithm.md`. */
function itemOf(arg: string, path: string): Item | undefined {
  const a = arg.replace(/^\.\//, '')
  const at = a.lastIndexOf('/', a.length - 2)
  const dir = at < 0 ? path : dirOf(a.slice(0, at), path)
  if (!dir) return
  const name = a.slice(at + 1).toLowerCase()
  return folder(dir).find(
    (it) =>
      it.name.toLowerCase() === name || it.name.toLowerCase() === `${name}/`,
  )
}

/** The status bar's count, as a Finder window's reads. */
export function itemsAt(path: string) {
  const n = folder(path).length
  return n === 1 ? '1 item' : `${n} items`
}

function runExe(exe: string, ctx: Ctx): string[] {
  if (exe === 'waves.exe') {
    ctx.waves()
    if (ctx.meadowHere()) ctx.gust()
    return ['Running waves.exe...', '{m|press any key to stop}']
  }
  if (exe === 'datamines.exe') {
    ctx.go('~/projects')
    return [
      'Running datamines.exe...',
      '{e|datamines.exe: needs a Windows build.} {m|Opening the project instead.}',
    ]
  }
  return [`./${exe}: Permission denied or not an executable`]
}

export function run(input: string, ctx: Ctx): string[] {
  const raw = input.trim()
  if (!raw) return []
  const args = raw.split(/\s+/)
  const cmd = args[0].toLowerCase()
  const a = (args[1] ?? '').toLowerCase()
  ctx.history.push(raw)

  if (cmd.startsWith('./')) return runExe(cmd.slice(2), ctx)

  switch (cmd) {
    case 'help':
      return [...HELP]
    case 'work': {
      if (a) {
        const job = WORK.find((w) => w.key === a)
        if (!job)
          return [
            `Company "${a}" not found. Available options: ${WORK.map((w) => w.key).join(', ')}`,
          ]
        return [`{u|${job.company}}  {m|${job.start}}`, job.title, '', job.desc]
      }
      const out = ['']
      for (const w of WORK)
        out.push(
          `  {u|${pad(w.company, 32)}}{m|${w.start}}`,
          `  ${w.title}`,
          '',
        )
      out.push(
        '',
        `{m|Type 'work ${WORK[0].key}' (${WORK.slice(1)
          .map((w) => w.key)
          .join(', ')}) for more.}`,
      )
      return out
    }
    case 'projects': {
      const out = ['']
      for (const p of PROJECTS.slice(0, 6))
        out.push(`  {u|${p.name}}`, `  {m|${p.description}}`, '')
      out.push(
        `  {m|and ${PROJECTS.slice(6)
          .map((p) => p.slug)
          .join(', ')}. 'cd projects' for all of them.}`,
      )
      return out
    }
    case 'ls': {
      const dir = args[1] ? dirOf(args[1], ctx.path) : ctx.path
      if (!dir) return [`ls: ${args[1]}: No such file or directory`]
      const items = folder(dir)
      return items.length ? [items.map((it) => it.shown).join('  ')] : []
    }
    case 'cat': {
      if (!args[1]) return ['Usage: cat <file>']
      const it = itemOf(args[1], ctx.path)
      if (!it) return [`cat: ${args[1]}: No such file or directory`]
      if (it.name.endsWith('/')) return [`cat: ${args[1]}: Is a directory`]
      return it.cat
        ? it.cat(ctx)
        : [`cat: ${args[1]}: not a text file. Try 'open ${args[1]}'`]
    }
    case 'open': {
      if (!args[1]) return ['Usage: open <file>']
      const it = itemOf(args[1], ctx.path)
      if (!it) {
        const dir = dirOf(args[1], ctx.path)
        if (dir) return ctx.go(dir), []
        return [`open: ${args[1]}: No such file or directory`]
      }
      return it.open(ctx)
    }
    case 'cd': {
      const to = a.replace(/\/$/, '').replace(/^~\//, '')
      if (!to || to === '~' || to === '..' || to === 'meadow' || to === '/') {
        ctx.go('~')
        return []
      }
      if (PAGES.includes(to)) {
        ctx.go(`~/${to}`)
        return []
      }
      return [`cd: no such directory: ${args[1]}`]
    }
    case 'pwd':
      return [ctx.path === '~' ? '/' : ctx.path.slice(1)]
    case 'tree':
      return [
        '{h|~}',
        '├── {h|projects}',
        ...PROJECTS.map(
          (p, i) =>
            `│   ${i === PROJECTS.length - 1 ? '└' : '├'}── {h|${p.slug}}`,
        ),
        ...['photos', 'writing', 'music'].flatMap((d) => {
          const items = folder(`~/${d}`)
          return [
            `├── {h|${d}}`,
            ...items.map(
              (it, i) =>
                `│   ${i === items.length - 1 ? '└' : '├'}── ${it.shown}`,
            ),
          ]
        }),
        ...Object.keys(FILES).map((f) => `├── ${f}`),
        ...EXES.map((e) => `├── {g|${e}}`),
        '└── resume.pdf',
        '',
        `${4 + PROJECTS.length} directories, ${
          Object.keys(FILES).length +
          EXES.length +
          1 +
          folder('~/photos').length +
          folder('~/writing').length
        } files`,
      ]
    case 'github':
      ctx.open(GITHUB)
      return ['Opening github...']
    case 'linkedin':
      ctx.open(LINKEDIN)
      return ['Opening linkedin...']
    case 'resume':
      ctx.open('/resume')
      return ['Opening resume...']
    case 'email':
      ctx.copy(EMAIL)
      return [`${EMAIL}  {m|copied}`]
    case 'echo':
      return [args.slice(1).join(' ')]
    case 'whoami':
      return ['dev']
    case 'date': {
      const d = new Date()
      return [
        `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.${d.getFullYear()}`,
      ]
    }
    case 'history':
      return ctx.history.map(
        (h, i) => `  {m|${String(i + 1).padStart(3, ' ')}}  ${h}`,
      )
    case 'clear':
      ctx.clear()
      return []
    case 'exit':
      ctx.close()
      return []
    case 'sudo':
      return ['hah! nice try']
    case 'rm':
    case 'mkdir':
    case 'touch': {
      if (!args[1]) return [`${cmd}: missing operand`]
      const verb = { rm: 'remove', mkdir: 'create directory', touch: 'touch' }[
        cmd
      ]
      return [`${cmd}: cannot ${verb} '${args[1]}': Permission denied`]
    }
    case 'vim':
    case 'nvim':
    case 'vi':
      return ['nerd']

    case 'time': {
      if (!a)
        return [
          `${hhmm(ctx.hour)}  {m|· ${phase(ctx.hour)}${ctx.follow ? ' · following your clock' : ''}}`,
        ]
      if (a === 'now') {
        ctx.setHour(null)
        return [
          `${hhmm(ctx.hour)}  {m|· ${phase(ctx.hour)} · following your clock}`,
        ]
      }
      const m = a.match(/^(\d{1,2})(?::(\d{2}))?$/)
      if (!m || +m[1] > 23 || +(m[2] ?? 0) > 59)
        return [
          `time: {e|${args[1]}} is not an hour. Try time 19:00, or time now`,
        ]
      const h = +m[1] + +(m[2] ?? 0) / 60
      ctx.setHour(h)
      return [
        `${hhmm(h)}  {m|· ${phase(h)}}`,
        "{m|Your clock is off. 'time now' follows it again.}",
      ]
    }
    case 'wind': {
      if (!a) return [`wind {y|${ctx.wind.toFixed(2)}}`]
      const w = parseFloat(a)
      if (Number.isNaN(w) || w < 0 || w > 1)
        return [
          `wind: {e|${args[1]}} is out of range. Try a number from 0 to 1`,
        ]
      const was = ctx.wind
      ctx.setWind(w)
      return [
        `wind {y|${w.toFixed(2)}} {m|(was ${was.toFixed(2)})}`,
        ...(ctx.meadowHere() ? [] : elsewhere),
      ]
    }
    case 'regrow': {
      if (!ctx.meadowHere()) return elsewhere
      const seed = 1e9 + Math.floor(Math.random() * 9e8)
      ctx.regrow(seed)
      return [`regrowing  {m|· a new meadow, seed ${seed}}`]
    }
  }
  return [`shell: command not found: ${args[0]}. Try 'help' to get started.`]
}

export function complete(s: string, path: string) {
  const parts = s.split(' ')
  const here = folder(path).map((it) => it.name)
  const pool =
    parts.length === 1
      ? NAMES
      : parts[0] === 'cd'
        ? PAGES
        : ['cat', 'open', 'ls'].includes(parts[0])
          ? here
          : parts[0] === 'work'
            ? WORK.map((w) => w.key)
            : []
  const last = parts[parts.length - 1]
  const hits = pool.filter((n) => n.startsWith(last))
  if (hits.length !== 1) return s
  parts[parts.length - 1] = hits[0]
  return parts.join(' ') + (parts.length === 1 ? ' ' : '')
}

/** A post's markdown as output lines: headings stand out, fences and the
 * front matter's rules go quiet. Lines with braces stay plain. */
export function markdownLines(md: string) {
  return md.split('\n').map((line) => {
    if (/[{}]/.test(line) || !line) return line
    if (/^#{1,6} /.test(line)) return `{u|${line}}`
    if (/^(```|---$)/.test(line)) return `{m|${line}}`
    return line
  })
}

/** One output line's markup as [text, class] runs. */
export function parse(line: string): [string, string][] {
  const out: [string, string][] = []
  const re = /\{([gumhye])\|([^{}]*)\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    if (m.index > last) out.push([line.slice(last, m.index), ''])
    out.push([m[2], m[1]])
    last = re.lastIndex
  }
  if (last < line.length) out.push([line.slice(last), ''])
  return out
}
