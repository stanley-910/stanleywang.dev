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
    id: 'project1',
    category: 'Machine Learning'
  },
  {
    name: 'Datamines',
    description: "reggie's got a long day ahead of him.",
    link: 'https://averageosiris.itch.io/datamines',
    media: {
      type: 'video',
      sources: ['datamines-demo.mov']
    },
    id: 'project2',
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
    id: 'work1',
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
    id: 'work2',
    gradient: 'yellow'
  },
  {
    company: 'McGill AI Ethics Lab',
    title: 'Lead Researcher',
    start: 'May 2024',
    end: 'Dec 2024',
    location: 'Montreal',
    desc: 'Presented novel research at UCORE 2024, McGill\'s Undergraduate Research Symposium',
    link: '',
    id: 'work3',
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
  // {
  //   title: 'Exploring the Intersection of Design, AI, and Design Engineering',
  //   description: 'How AI is changing the way we design',
  //   link: '/writing/exploring-the-intersection-of-design-ai-and-design-engineering',
  //   uid: 'post-1',
  //   date: '2024-04-20',
  //   readingTime: '10 min',
  //   tags: ['Design', 'AI', 'Engineering'],
  // },
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'Github',
    link: 'https://github.com/stanley-utf8',
  },
  // {
  //   label: 'Twitter',
  //   link: 'https://twitter.com/stanley_utf8',
  // },
  {
    label: 'LinkedIn',
    link: 'https://www.linkedin.com/in/stanley-utf8/',
  },
]

export const EMAIL = 'stanley.wang.cs@gmail.com'
