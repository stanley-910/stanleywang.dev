type Project = {
  name: string
  description: string
  link: string
  video: string
  id: string
}

type WorkExperience = {
  company: string
  title: string
  start: string
  end: string
  desc: string
  link: string
  id: string
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
    name: 'Motion Primitives Pro',
    description:
      'Advanced components and templates to craft beautiful websites.',
    link: 'https://pro.motion-primitives.com/',
    video:
      'https://res.cloudinary.com/read-cv/video/upload/t_v_b/v1/1/profileItems/W2azTw5BVbMXfj7F53G92hMVIn32/newProfileItem/d898be8a-7037-4c71-af0c-8997239b050d.mp4?_a=DATAdtAAZAA0',
    id: 'project1',
  },
  {
    name: 'Motion Primitives',
    description: 'UI kit to make beautiful, animated interfaces.',
    link: 'https://motion-primitives.com/',
    video:
      'https://res.cloudinary.com/read-cv/video/upload/t_v_b/v1/1/profileItems/W2azTw5BVbMXfj7F53G92hMVIn32/XSfIvT7BUWbPRXhrbLed/ee6871c9-8400-49d2-8be9-e32675eabf7e.mp4?_a=DATAdtAAZAA0',
    id: 'project2',
  },
]

export const WORK_EXPERIENCE: WorkExperience[] = [
  {
    company: 'Reglazed Studio',
    title: 'CEO',
    start: '2024',
    end: 'Present',
    desc: 'I ran a company',
    link: 'https://ibelick.com',
    id: 'work1',
  },
  {
    company: 'Freelance',
    title: 'Design Engineer',
    start: '2022',
    end: '2024',
    desc: 'I was a design engineer',
    link: 'https://ibelick.com',
    id: 'work2',
  },
  {
    company: 'Freelance',
    title: 'Front-end Developer',
    start: '2017',
    end: 'Present',
    desc: 'I was a front-end developer',
    link: 'https://ibelick.com',
    id: 'work3',
  },
]

export const BLOG_POSTS: BlogPost[] = [
  {
    title: 'Exploring the Intersection of Design, AI, and Design Engineering',
    description: 'How AI is changing the way we design',
    link: '/blog/exploring-the-intersection-of-design-ai-and-design-engineering',
    uid: 'blog-1',
    date: '2024-04-20',
    readingTime: '10 min',
    tags: ['Design', 'AI', 'Engineering'],
  },
  {
    title: 'Why I left my job to start my own company',
    description:
      'A deep dive into my decision to leave my job and start my own company',
    link: '/blog/exploring-the-intersection-of-design-ai-and-design-engineering',
    uid: 'blog-2',
    date: '2024-04-20',
    readingTime: '10 min',
    tags: ['Design', 'AI', 'Engineering'],
  },
  {
    title: 'What I learned from my first year of freelancing',
    description:
      'A look back at my first year of freelancing and what I learned',
    link: '/blog/exploring-the-intersection-of-design-ai-and-design-engineering',
    uid: 'blog-3',
    date: '2024-04-20',
    readingTime: '10 min',
    tags: ['Design', 'AI', 'Engineering'],
  },
  {
    title: 'Building a Design System from Scratch',
    description: 'A comprehensive guide to creating a scalable design system',
    link: '/blog/exploring-the-intersection-of-design-ai-and-design-engineering',
    uid: 'blog-4', 
    date: '2023-11-15',
    readingTime: '15 min',
    tags: ['Design Systems', 'Frontend', 'Architecture'],
  },
  {
    title: 'The Future of Web Animation with CSS and JavaScript',
    description: 'Exploring modern animation techniques for engaging web experiences',
    link: '/blog/exploring-the-intersection-of-design-ai-and-design-engineering',
    uid: 'blog-5',
    date: '2023-06-22',
    readingTime: '8 min', 
    tags: ['Animation', 'CSS', 'JavaScript'],
  },
  {
    title: 'Getting Started with Design Engineering',
    description: 'Essential skills and tools for aspiring design engineers',
    link: '/blog/exploring-the-intersection-of-design-ai-and-design-engineering',
    uid: 'blog-6',
    date: '2022-09-30',
    readingTime: '12 min',
    tags: ['Career', 'Design', 'Engineering'],
  }
]

export const SOCIAL_LINKS: SocialLink[] = [
  {
    label: 'Github',
    link: 'https://github.com/ibelick',
  },
  {
    label: 'Twitter',
    link: 'https://twitter.com/ibelick',
  },
  {
    label: 'LinkedIn',
    link: 'https://www.linkedin.com/in/ibelick',
  },
  {
    label: 'Instagram',
    link: 'https://www.instagram.com/ibelick',
  },
]

export const EMAIL = 'your@email.com'
