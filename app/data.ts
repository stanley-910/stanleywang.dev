export type Project = {
  name: string
  description: string
  link: string
  media: {
    type: 'video' | 'images'
    sources: string[]  // Single video URL or array of image URLs
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
}

export type BlogPost = {
  title: string
  description: string
  link: string
  uid: string
  date: string
  readingTime: string
  tags: string[]
}

type SocialLink = {
  label: string
  link: string
}

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
        '/trading-fours3.png'
      ]
    },
    id: 'project-1',
    category: 'Machine Learning'
  },
  {
    name: 'Datamines',
    description: "reggie's got a long day ahead of him.",
    link: 'https://averageosiris.itch.io/datamines',
    media: {
      type: 'video',
      sources: ['/videos/datamines-demo.mp4']
    },
    id: 'project-2',
    category: 'Game Dev'
  },
]

export const WORK_EXPERIENCE: WorkExperience[] = [
  {
    company: 'Autodesk',
    title: 'Software Engineer Intern',
    start: 'Summer 2025',
    end: '',
    location: 'Montreal',
    desc: 'EMS Team',
    link: 'https://www.autodesk.com/collections/media-entertainment/included-software',
    id: 'work-1',
    gradient: 'blue'
  },
  {
    company: 'Beta Technologies',
    title: 'Software Engineer Intern',
    start: 'Jan 2025',
    end: 'Apr 2025',
    location: 'Montreal',
    desc: 'Structural Team',
    link: 'https://beta.team/aircraft',
    id: 'work-2',
    gradient: 'yellow'
  },
  {
    company: 'McGill AI Ethics Lab',
    title: 'Lead Researcher',
    start: 'May 2024',
    end: 'Dec 2024',
    location: 'Montreal',
    desc: 'Presented novel research at UCORE 2024, McGill\'s Undergraduate Research Symposium',
    link: 'https://www.mcgill.ca/',
    id: 'work-3',
    gradient: 'red'
  },

  // {
  //   company: 'Freelance',
  //   title: 'Front-end Developer',
  //   start: '2017',
  //   end: 'Present',
  //   desc: 'I was a front-end developer',
  //   link: 'https://ibelick.com',
  //   id: 'work3',
  // },
]

export const BLOG_POSTS: BlogPost[] = [
  {
    title: "Improvisation on the Artist",
    description: 'On Jack Whitten and the artistic process',
    link: '/writing/improvisation-on-the-artist',
    uid: 'post-2',
    date: '2025-06-15',
    readingTime: '12 min',
    tags: ['Art', 'Philosophy'],
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

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'Github',
    link: 'https://github.com/stanley-utf8',
  },
  {
    label: 'LinkedIn',
    link: 'https://www.linkedin.com/in/stanley-utf8/',
  },
]

export const EMAIL = 'stanley.wang.cs@gmail.com'
