export type Project = {
  name: string
  description: string
  link: string
  media: {
    type: 'video' | 'images'
    sources: string[] // Single video URL or array of image URLs
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
    name: 'Trading Fours',
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
