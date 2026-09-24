export type Project = {
  name: string
  description: string
  link: string
  slug: string
  media?: {
    type: 'video' | 'images'
    sources: string[] // Single video URL or array of image URLs
    alt?: string
    fit?: 'cover' | 'contain'
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
    name: 'Eastwatch',
    slug: 'eastwatch',
    description:
      'A Night’s Watch for coding agents. Named after Eastwatch-by-the-Sea from Game of Thrones, it turns issue-board actions into resumable AI coding sessions, with a TUI to keep watch over the fleet.',
    link: '/projects/eastwatch',
    media: {
      type: 'images',
      sources: ['/images/projects/eastwatch-fleet.png'],
      fit: 'contain',
      alt: 'Eastwatch’s fleet TUI with seven agents working or finished and a live trace of one agent’s tool calls.',
    },
    id: 'eastwatch',
    category: 'Developer Tools',
  },
  {
    name: 'pi-talk',
    slug: 'pi-talk',
    description:
      'A voice for Pi. Streams assistant responses as speech on macOS, with pause, resume, and playback-speed controls.',
    link: '/projects/pi-talk',
    id: 'pi-talk',
    category: 'Developer Tools',
  },
  {
    name: 'Lovebox',
    slug: 'lovebox',
    description:
      'A little window into someone else’s day. A Raspberry Pi touchscreen for messages, shared drawings, moods, and music across the distance.',
    link: '/projects/lovebox',
    media: {
      type: 'images',
      sources: ['/images/projects/lovebox-home.png'],
      fit: 'contain',
      alt: 'Lovebox’s retro-terminal home screen with messages, clocks, weather, and shared status.',
    },
    id: 'lovebox',
    category: 'Personal Projects',
  },
  {
    name: 'Mini Compiler',
    slug: 'mini-compiler',
    description:
      'From a C-like language to MIPS: parsing, type checking, code generation, and graph-colouring register allocation. Walkthrough in progress.',
    link: '/projects/mini-compiler',
    id: 'mini-compiler',
    category: 'Systems',
  },
  {
    name: 'OS Sim',
    slug: 'os-sim',
    description:
      'A teaching shell in C exploring process scheduling, demand paging, and multithreaded execution. Writeup in progress.',
    link: '/projects/os-sim',
    id: 'os-sim',
    category: 'Systems',
  },
  {
    name: 'Chani',
    slug: 'chani',
    description:
      'A TCP chatroom in OCaml. Terminal clients connect to an asynchronous Lwt server that broadcasts messages to the room.',
    link: '/projects/chani',
    id: 'chani',
    category: 'Systems',
  },
  {
    name: 'Dictate',
    slug: 'dictate',
    description:
      'Press a hotkey, speak, and paste at your cursor. Offline macOS dictation with Cohere Transcribe running locally through transcribe.cpp and Metal.',
    link: '/projects/dictate',
    id: 'dictate',
    category: 'Developer Tools',
  },
  {
    name: 'Trading Fours',
    slug: 'trading-fours',
    description: 'recommending music.',
    link: 'https://www.youtube.com/watch?v=sx5btkY24hQ',
    media: {
      type: 'images',
      sources: [
        '/trading-fours1.png',
        '/trading-fours2.png',
        '/trading-fours3.png',
      ],
    },
    id: 'project-1',
    category: 'Machine Learning',
  },
  {
    name: 'Datamines',
    slug: 'datamines',
    description: "reggie's got a long day ahead of him.",
    link: 'https://averageosiris.itch.io/datamines',
    media: {
      type: 'video',
      sources: ['/videos/datamines-demo.mp4'],
    },
    id: 'project-2',
    category: 'Game Dev',
  },
]

export const WORK_EXPERIENCE: WorkExperience[] = [
  {
    company: 'Autodesk',
    title: 'Software Engineer Intern',
    start: 'Summer 2025',
    end: '',
    location: '',
    desc: 'EMS Team',
    link: 'https://www.autodesk.com/collections/media-entertainment/included-software',
    id: 'work-1',
    gradient: 'blue',
  },
  {
    company: 'Beta Technologies',
    title: 'Software Engineer Intern',
    start: 'Winter 2025',
    end: '',
    location: '',
    desc: 'Built a domain-specific library for finite element models of experimental aircraft, enabling rapid development of critical FAA certification tools.',
    link: 'https://beta.team/aircraft',
    caseStudy: '/experience/beta-case-study',
    id: 'work-2',
    gradient: 'yellow',
  },
  {
    company: 'McGill AI Ethics Lab',
    title: 'Lead Researcher',
    start: 'Fall 2024',
    end: '',
    location: '',
    desc: "Presented novel research at UCORE 2024, McGill's Undergraduate Research Symposium",
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

export const EMAIL = 'stanley.wang.cs@gmail.com'
