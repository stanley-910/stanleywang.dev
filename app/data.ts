import datamineTracks from './projects/datamines-tracks.json'

export type MediaItem = string | { light: string; dark: string }

export type Track = {
  title: string
  src: string
  duration: number
  // Loudness per bar of the waveform, 0 to 1.
  peaks: number[]
}

export type Project = {
  name: string
  description: string
  // A live site or demo, and its icon (a globe when unset).
  demo?: string
  demoIcon?: string
  // A drawn character for the demo icon, in place of demoIcon.
  demoMascot?: 'pip'
  // A strip of pixel-art frames for the demo icon: a standing frame, then a
  // cycle that plays while the link is hovered.
  demoSprite?: { src: string; width: number; height: number; frames: number }
  github?: string
  // 'video' marks a demo that's a recording rather than something to try.
  demoKind?: 'video'
  // Music written for the project, played on its card.
  tracks?: Track[]
  // Editable code on the card, sent to the project's own page to run.
  snippet?: { file: string; label: string; source: string; href: string }
  slug: string
  media?: {
    type: 'video' | 'images'
    // A video URL, or images; an image can come as a light and dark pair.
    sources: MediaItem[]
    alt?: string
    // Images fit inside the frame unless set to cover.
    fit?: 'cover' | 'contain'
    // The frame's width over height, matching the media (16:9 when unset).
    aspect?: number
  }
  id: string
  category?: string
}

type WorkExperience = {
  company: string
  title: string
  start: string
  end: string
  desc: string
  link: string
  location: string
  id: string
  gradient?: string
  caseStudy?: string
}

export type Post = {
  title: string
  description: string
  link: string
  uid: string
  date: string
  readingTime: string
  tags?: string[]
  edited?: string
}

export type BlogPost = Post
export type ExperiencePost = Post

export const PROJECTS: Project[] = [
  {
    name: 'Portal',
    slug: 'portal',
    description:
      'A multiplayer canvas for trip planning with your friends, with the power of an alien travel agent at your disposal. Developed in a single weekend for HKU Hackathon 2026 at the University of Hong Kong.',
    media: {
      type: 'images',
      aspect: 2000 / 1192,
      sources: ['/images/projects/portal-trip.webp'],
      alt: 'Portal’s globe with a flight from Seattle to Montréal, and Lydia’s live cursor on the map.',
    },
    demo: 'https://portal-swart-mu.vercel.app',
    demoMascot: 'pip',
    github: 'https://github.com/stanley-910/portal',
    id: 'portal',
    category: 'Web',
  },
  {
    name: 'Mini Compiler',
    slug: 'mini-compiler',
    description:
      'Try out a compiler I coded from scratch. In the process, visualize and learn how source to assembly compilers actually work.',
    demo: '/projects/mini-compiler',
    snippet: {
      file: 'main.c',
      label: 'loop',
      // mini-c-prototype/reference/loop.c, the walkthrough's own example.
      source: `int main() {
  int i; int sum;
  i = 0; sum = 0;
  while (i < 3) {
    sum = sum + i * 2;
    i = i + 1;
  }
  return sum;
}
`,
      href: '/projects/mini-compiler',
    },
    media: {
      type: 'images',
      sources: [
        {
          light: '/images/projects/mini-compiler-parse-light.png',
          dark: '/images/projects/mini-compiler-parse-dark.png',
        },
        {
          light: '/images/projects/mini-compiler-emit-light.png',
          dark: '/images/projects/mini-compiler-emit-dark.png',
        },
        {
          light: '/images/projects/mini-compiler-regs-light.png',
          dark: '/images/projects/mini-compiler-regs-dark.png',
        },
      ],
      alt: 'Mini Compiler on a small loop: the finished syntax tree, the emitted MIPS beside its stack frame, and the coloured register interference graph.',
    },
    id: 'mini-compiler',
    category: 'Systems',
  },
  {
    name: 'Eastwatch',
    slug: 'eastwatch',
    description:
      'An agentic dispatch system. Works with GitHub, GitLab and Jira, and runs on a shared server that gives each person their own containerized agent workspace.',
    media: {
      type: 'images',
      aspect: 1848 / 1026,
      sources: ['/images/projects/eastwatch-fleet.png'],
      alt: 'Eastwatch’s fleet TUI with seven agents working or finished and a live trace of one agent’s tool calls.',
    },
    github: 'https://github.com/stanley-910/eastwatch',
    id: 'eastwatch',
    category: 'Developer Tools',
  },
  {
    name: 'Datamines',
    slug: 'datamines',
    description:
      'A 2D retro-inspired endless side-scroller set inside a computer. Developed in 36 hours for McGill CodeJam 14, with a soundtrack I composed.',
    media: {
      type: 'video',
      aspect: 2940 / 1912,
      sources: ['/videos/datamines-demo.mp4'],
    },
    demo: 'https://averageosiris.itch.io/datamines',
    demoSprite: {
      src: '/images/projects/datamines-reggie.svg',
      width: 14,
      height: 17,
      frames: 6,
    },
    github: 'https://github.com/CRook99/DATAMINES',
    tracks: datamineTracks,
    id: 'project-2',
    category: 'Game Dev',
  },
  {
    name: 'Chani',
    slug: 'chani',
    description:
      'A TCP chatroom in OCaml. Terminal clients connect to an asynchronous Lwt server that broadcasts messages to the room.',
    media: {
      type: 'images',
      aspect: 2000 / 1256,
      sources: ['/images/projects/chani-chat.webp'],
      alt: 'Chani in tmux: the server broadcasting a message above two terminal clients chatting with each other.',
    },
    github: 'https://github.com/stanley-910/chani',
    id: 'chani',
    category: 'Systems',
  },
  {
    name: 'Trading Fours',
    slug: 'trading-fours',
    description:
      'Music recommendations from your Spotify listening history, driven by an XGBoost genre classifier. Flask and React services, deployed to AWS.',
    media: {
      type: 'images',
      aspect: 1907 / 971,
      sources: [
        '/trading-fours1.png',
        '/trading-fours2.png',
        '/trading-fours3.png',
      ],
    },
    demo: 'https://www.youtube.com/watch?v=sx5btkY24hQ',
    demoKind: 'video',
    github: 'https://github.com/stanley-910/trading-fours',
    id: 'project-1',
    category: 'Machine Learning',
  },
  {
    name: 'Lovebox',
    slug: 'lovebox',
    description:
      'Something I built to stay connected with my partner while we were long distance.',
    media: {
      type: 'images',
      aspect: 5 / 3,
      sources: [
        '/images/projects/lovebox-home-light.png',
        '/images/projects/lovebox-draw-dark.png',
      ],
      alt: 'Lovebox’s home screen with messages, clocks and weather for San Francisco and Montreal, and its draw tab with a heart drawn by both of us.',
    },
    github: 'https://github.com/stanley-910/lovebox',
    id: 'lovebox',
    category: 'Personal Projects',
  },
  {
    name: 'pi-talk',
    slug: 'pi-talk',
    description:
      'A voice for Pi. Streams assistant responses as speech on macOS, with pause, resume, and playback-speed controls.',
    github: 'https://github.com/stanley-910/pi-talk',
    id: 'pi-talk',
    category: 'Developer Tools',
  },
  {
    name: 'OS Sim',
    slug: 'os-sim',
    description:
      'An operating system simulator in C: process control blocks with round-robin scheduling and priority aging, demand paging with per-process page tables and LRU replacement, and a producer-consumer work queue guarded by mutexes and semaphores.',
    id: 'os-sim',
    category: 'Systems',
  },
  {
    name: 'Dictate',
    slug: 'dictate',
    description:
      'My local model solution to dictation app subscriptions like Superwhisper or Wispr Flow.',
    github: 'https://github.com/stanley-910/dictate',
    id: 'dictate',
    category: 'Developer Tools',
  },
]

export const WORK_EXPERIENCE: WorkExperience[] = [
  {
    company: 'Electronic Arts',
    title: 'Software Engineer Intern',
    start: 'Summer 2026',
    end: '',
    location: '',
    desc: 'Commerce & Identity. Prototyped a personalized shopping assistant for Madden Mobile and built reusable agentic commerce components for EA’s games and web stores.',
    link: 'https://www.ea.com',
    id: 'work-ea',
  },
  {
    company: 'Autodesk',
    title: 'Software Engineer Intern',
    start: 'Summer 2025',
    end: '',
    location: '',
    desc: 'Media & Entertainment. Built a diagnostic pipeline and visual debugger for collaborative film-review sessions, and resolved a production login outage for two large studios.',
    link: 'https://www.autodesk.com/collections/media-entertainment/included-software',
    id: 'work-1',
    gradient: 'blue',
  },
  {
    company: 'BETA Technologies',
    title: 'Software Engineer Intern',
    start: 'Winter 2025',
    end: '',
    location: '',
    desc: 'Stress & Structures. Built a Python library for NASTRAN aircraft models that cut a three-day manual preprocessing workflow to under 10 seconds.',
    link: 'https://beta.team/aircraft',
    caseStudy: '/experience/beta-case-study',
    id: 'work-2',
    gradient: 'yellow',
  },
  {
    company: 'McGill AI Ethics Research Lab',
    title: 'Lead Researcher',
    start: 'Summer–Fall 2024',
    end: '',
    location: '',
    desc: "Built a browser extension backend that fact-checks claims in YouTube videos, and presented the research at McGill's undergraduate research symposium.",
    link: 'https://www.mcgill.ca/',
    id: 'work-3',
    gradient: 'red',
  },
]

export const EXPERIENCE_POSTS: ExperiencePost[] = [
  {
    title:
      'Case Study: Developing Structural Analysis Tooling for Experimental Aircraft',
    description:
      'On creating a pseudo-DSL for the Finite Element Representations of Aircraft',
    link: '/experience/beta-case-study',
    uid: 'exp-1',
    date: '2025-07-07',
    readingTime: '15 min',
    tags: ['Software', 'Aerospace', 'Finite Element Analysis'],
  },
]

export const BLOG_POSTS: BlogPost[] = [
  {
    title: 'Exploring a Recurrent Neural Network',
    description: 'COMP 551 Notes',
    link: '/writing/exploring-a-recurrent-neural-network',
    uid: 'post-3',
    date: '2026-03-28',
    readingTime: '14 min',
    tags: ['Machine Learning', 'RNNs'],
  },
  {
    title: 'Improvisation on the Artist',
    description: 'On Jack Whitten and the adhesion of visual art & jazz.',
    link: '/writing/improvisation-on-the-artist',
    uid: 'post-2',
    date: '2025-06-15',
    readingTime: '12 min',
    tags: ['Jazz', 'Art'],
  },
  {
    title: "Dijkstra\'s Algorithm",
    description: 'COMP 251 Notes',
    link: '/writing/dijkstras-algorithm',
    uid: 'post-1',
    date: '2025-04-21',
    readingTime: '10 min',
    tags: ['Algorithms'],
  },
]

export const EMAIL = 'hi@stanleywang.cc'
