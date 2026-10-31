import { EMAIL, PROJECTS, WORK_EXPERIENCE } from '@/app/data'

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
  '',
  'Available commands:',
  '',
  '  {g|about}          - Display information about me',
  '  {g|help}           - Self-explanatory',
  '  {g|projects}       - List my most recent projects',
  '  {g|work}           - List a timeline of my work experience',
  '',
  '  {g|github}         - Visit my Github profile',
  '  {g|linkedin}       - View my LinkedIn profile',
  '  {g|resume}         - Open my resume',
  '  {g|email}          - Copy my email address',
  '',
  '  {g|cd}             - Change directory',
  '  {g|ls}             - List content of current directory',
  '  {g|cat}            - Read a file',
  '  {g|tree}           - Display directory structure in a tree-like format',
  '',
  '  {g|time}           - Set the hour: time 19:00, or time now',
  '  {g|wind}           - Set the breeze: wind 0.6',
  '  {g|regrow}         - Grow a new meadow',
  '',
  '{y|[tab]}: Trigger completion',
  '{y|[ctrl+l]}/{y|clear}: Clear terminal',
  '{y|[`]}: Open or close the terminal',
  '',
]

const NAMES = [
  'about',
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
  'time',
  'wind',
  'regrow',
  ...EXES.map((e) => `./${e}`),
]

/** Off home, the meadow commands say where the meadow is. */
const elsewhere = ["{m|The meadow's at home. 'cd ~' to see it.}"]

export function run(input: string, ctx: Ctx): string[] {
  const raw = input.trim()
  if (!raw) return []
  const args = raw.split(/\s+/)
  const cmd = args[0].toLowerCase()
  const a = (args[1] ?? '').toLowerCase()
  ctx.history.push(raw)

  if (cmd.startsWith('./')) {
    const exe = cmd.slice(2)
    if (exe === 'waves.exe') {
      ctx.waves()
      if (!ctx.meadowHere())
        return ['Running waves.exe...', '{m|press any key to stop}']
      ctx.gust()
      return [
        'Running waves.exe...',
        '  {m|a gust rolls across the grass}',
        '{m|press any key to stop}',
      ]
    }
    if (exe === 'datamines.exe') {
      ctx.go('~/projects')
      return [
        'Running datamines.exe...',
        '{e|datamines.exe: needs a Windows build.} {m|Opening the project instead.}',
      ]
    }
    return [`${cmd}: Permission denied or not an executable`]
  }

  switch (cmd) {
    case 'help':
      return [...HELP]
    case 'about':
      return [
        '你好, I’m Stanley.',
        '',
        'I’m currently studying Computer Science at {h|McGill University.} Most recently,',
        'I interned on Commerce & Identity at {h|Electronic Arts.} Before that, I wrote',
        'software with the {h|Flow PT team} at Autodesk and engineered structural tooling',
        'for {h|BETA Technologies.}',
        '',
        `{m|github / linkedin / ${EMAIL}}`,
      ]
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
      if (ctx.path === '~')
        return [
          [
            ...PAGES.slice(1).map((p) => `{h|${p}/}`),
            ...Object.keys(FILES),
            ...EXES.map((e) => `{g|${e}}`),
            'resume.pdf',
          ].join('  '),
        ]
      if (ctx.path === '~/projects')
        return [PROJECTS.map((p) => `{h|${p.slug}/}`).join('  ')]
      return ['']
    }
    case 'cat': {
      if (!args[1]) return ['Usage: cat <file>']
      const name = args[1].replace(/^\.\//, '')
      if (ctx.path === '~' && FILES[name]) return [...FILES[name]]
      if (PAGES.includes(name.replace(/\/$/, '')))
        return [`cat: ${args[1]}: Is a directory`]
      return [`cat: ${args[1]}: No such file or directory`]
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
        '├── {h|photos}',
        '├── {h|writing}',
        '├── {h|music}',
        ...Object.keys(FILES).map((f) => `├── ${f}`),
        ...EXES.map((e) => `├── {g|${e}}`),
        '└── resume.pdf',
        '',
        `4 directories, ${Object.keys(FILES).length + EXES.length + 1} files`,
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

export function complete(s: string) {
  const parts = s.split(' ')
  const pool =
    parts.length === 1
      ? NAMES
      : parts[0] === 'cd'
        ? PAGES
        : parts[0] === 'cat'
          ? Object.keys(FILES)
          : parts[0] === 'work'
            ? WORK.map((w) => w.key)
            : []
  const last = parts[parts.length - 1]
  const hits = pool.filter((n) => n.startsWith(last))
  if (hits.length !== 1) return s
  parts[parts.length - 1] = hits[0]
  return parts.join(' ') + (parts.length === 1 ? ' ' : '')
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
