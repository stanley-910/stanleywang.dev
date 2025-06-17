'use client'
import { motion, AnimatePresence } from 'motion/react'
import { XIcon } from 'lucide-react'
import { Spotlight } from '@/components/ui/spotlight'
import { Magnetic } from '@/components/ui/magnetic'
import { Stars } from '@/components/ui/stars'
import {
  MorphingDialog,
  MorphingDialogTrigger,
  MorphingDialogContent,
  MorphingDialogClose,
  MorphingDialogContainer,
} from '@/components/ui/morphing-dialog'
import Link from 'next/link'
import '@/app/styles/prose.css'
import '@/app/styles/markdown.css'
import { AnimatedBackground } from '@/components/ui/animated-background'
import {
  PROJECTS,
  WORK_EXPERIENCE,
  BLOG_POSTS,
  EMAIL,
  SOCIAL_LINKS,
} from './data'
import { format } from 'date-fns'
import { useState, useEffect } from 'react'
// import { cn } from '@/lib/utils'
import { AsciiArt } from '@/components/ui/ascii'
import { TextEffect } from '@/components/ui/text-effect'

const VARIANTS_CONTAINER = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const VARIANTS_SECTION = {
  hidden: { opacity: 0, y: 10, filter: 'blur(8px)' },
  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
}

const TRANSITION_SECTION = {
  duration: 0.3,
}

type ProjectMediaProps = {
  media: {
    type: 'video' | 'images'
    sources: string[]
  }
}

function ProjectMedia({ media }: ProjectMediaProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Auto-advance slideshow every 3 seconds
  useEffect(() => {
    if (media.type === 'images' && media.sources.length > 1) {
      const timer = setInterval(() => {
        setCurrentImageIndex((prev) => 
          prev === media.sources.length - 1 ? 0 : prev + 1
        )
      }, 3000)
      return () => clearInterval(timer)
    }
  }, [media])


  if (media.type === 'video') {
    return (
      <MorphingDialog
        transition={{
          type: 'spring',
          bounce: 0,
          duration: 0.3,
        }}
      >
        <MorphingDialogTrigger>
          <div className="relative w-full">
            <video
              src={media.sources[0]}
              autoPlay
              loop
              muted
              playsInline
              className="aspect-video w-full cursor-zoom-in rounded-xl"
              onClick={(e) => {
                // Only prevent the video's default behavior
                e.preventDefault()
              }}
            />
          </div>
        </MorphingDialogTrigger>
        <MorphingDialogContainer>
          <MorphingDialogContent className="relative aspect-video rounded-2xl bg-zinc-50 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950 dark:ring-zinc-800/50">
            <video
              src={media.sources[0]}
              autoPlay
              loop
              muted
              className="aspect-video h-[50vh] w-full rounded-xl md:h-[70vh]"
            />
          </MorphingDialogContent>
          <MorphingDialogClose
            className="fixed top-6 right-6 h-fit w-fit rounded-full bg-white p-1"
            variants={{
              initial: { opacity: 0 },
              animate: {
                opacity: 1,
                transition: { delay: 0.3, duration: 0.1 },
              },
              exit: { opacity: 0, transition: { duration: 0 } },
            }}
          >
            <XIcon className="h-5 w-5 text-zinc-500" />
          </MorphingDialogClose>
        </MorphingDialogContainer>
      </MorphingDialog>
    )
  }

  return (
    <MorphingDialog
      transition={{
        type: 'spring',
        bounce: 0,
        duration: 0.3,
      }}
    >
      <MorphingDialogTrigger>
        <div 
          className="relative aspect-video w-full overflow-hidden rounded-xl"
        >
          <AnimatePresence mode="wait">
            <motion.img
              key={currentImageIndex}
              src={media.sources[currentImageIndex]}
              alt={`Project image ${currentImageIndex + 1}`}
              className="h-full w-full cursor-pointer object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          </AnimatePresence>
        </div>
      </MorphingDialogTrigger>
      <MorphingDialogContainer>
        <MorphingDialogContent className="relative aspect-video rounded-2xl bg-zinc-50 p-1 ring-1 ring-zinc-200/50 ring-inset dark:bg-zinc-950 dark:ring-zinc-800/50">
          <img
            src={media.sources[currentImageIndex]}
            alt={`Project image ${currentImageIndex + 1}`}
            className="w-full h-full rounded-xl object-contain max-h-[80vh] max-w-[90vw]"
          />
        </MorphingDialogContent>
        <MorphingDialogClose
          className="fixed top-6 right-6 h-fit w-fit rounded-full bg-white p-1"
          variants={{
            initial: { opacity: 0 },
            animate: {
              opacity: 1,
              transition: { delay: 0.3, duration: 0.1 },
            },
            exit: { opacity: 0, transition: { duration: 0 } },
          }}
        >
          <XIcon className="h-5 w-5 text-zinc-500" />
        </MorphingDialogClose>
      </MorphingDialogContainer>
    </MorphingDialog>
  )
}

function MagneticSocialLink({
  children,
  link,
}: {
  children: React.ReactNode
  link: string
}) {
  return (
    <Magnetic springOptions={{ bounce: 0 }} intensity={0.3}>
      <a
        href={link}
        className="group relative inline-flex shrink-0 items-center gap-[1px] rounded-full bg-zinc-100 px-2.5 py-1 text-sm text-black transition-colors duration-200 hover:bg-zinc-950 hover:text-zinc-50 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
      >
        {children}
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-3 w-3"
        >
          <path
            d="M3.64645 11.3536C3.45118 11.1583 3.45118 10.8417 3.64645 10.6465L10.2929 4L6 4C5.72386 4 5.5 3.77614 5.5 3.5C5.5 3.22386 5.72386 3 6 3L11.5 3C11.6326 3 11.7598 3.05268 11.8536 3.14645C11.9473 3.24022 12 3.36739 12 3.5L12 9.00001C12 9.27615 11.7761 9.50001 11.5 9.50001C11.2239 9.50001 11 9.27615 11 9.00001V4.70711L4.35355 11.3536C4.15829 11.5488 3.84171 11.5488 3.64645 11.3536Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          ></path>
        </svg>
      </a>
    </Magnetic>
  )
}



export default function Personal() {
  return (
    <motion.main
      className="space-y-6"
      variants={VARIANTS_CONTAINER}
      initial="hidden"
      animate="visible"
    >
      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
      >
        <div className="mt-10 flex-1">
        <div className="text-zinc-600 dark:text-zinc-300">
            Studying Computer Science 
            at <b><a href="https://www.mcgill.ca" target="_blank" rel="noopener noreferrer" className="prose-link text-zinc-700 dark:text-zinc-200">McGill University</a></b>, writing software with 
            the <b><a href="https://www.autodesk.com/ca-en/products/flow-production-tracking/overview" target="_blank" rel="noopener noreferrer" className="prose-link text-zinc-700 dark:text-zinc-200">Flow PT team</a></b> at Autodesk, 
            and working on a few <b><Link href="/projects" className='prose-link text-zinc-700 dark:text-zinc-200'>side projects</Link></b> here and there. 

            <br/><br/>
            I'm trying to better value improvement over iteration.
            That means prioritizing my comprehension of the work, rather than the momentum of it.

            <br/><br/>
            Outside of software, I enjoy writing music & playing any instrument I can get my hands on. 
            You can listen to me in the raindrops that fall past your window, the flitted brushstrokes printed onto your favourite hotel paintings, 
            and the resonance of the low E string leaving the guitar after you sit down and realize there's nothing left for you to play.
            <br/><br/>
            I'm not on Spotify <i>just</i> yet. 
            <br/><br/>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">Last updated: June 17, 2025</div>
          </div>
        </div>
      </motion.section>
      <Stars className="fill-[rgb(186,149,94)] dark:fill-[rgb(186,149,94)] transition-colors" />



      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
        className="my-6"
      >
        <h3 className="mb-3 text-lg font-medium font-serif"><Link className="prose-link" href="/writing">Writing</Link></h3>

        <div className="flex flex-col space-y-0">
          <AnimatedBackground
            enableHover
            className="h-full w-full rounded-lg bg-zinc-100 dark:bg-zinc-900/80"
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.2,
            }}
          >
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.uid}
                className="-mx-3 rounded-xl px-3 py-3"
                href={post.link}
                data-id={post.uid}
              >
                <h4 className="text-md font-normal mb-1 dark:text-zinc-100">{post.title}</h4>
                <p className="text-sm text-zinc-500 mb-1">
                  <time dateTime={post.date}>
                    {format(new Date(post.date), 'MMMM dd, yyyy')}
                  </time>
                  {' · '}
                  {post.readingTime}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{post.description}</p>
              </Link>
            ))}
          </AnimatedBackground>
        </div>
      </motion.section>


      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
        className="my-6"
      >
        <h3 className="mb-5 text-lg font-medium font-serif">Experience</h3>
        <div className="flex flex-col space-y-2">
          {WORK_EXPERIENCE.map((job) => (
            <a
              className="relative overflow-hidden rounded-2xl bg-zinc-300/50 p-[1px] dark:bg-zinc-600/30"
              href={job.link}
              target="_blank"
              rel="noopener noreferrer"
              key={job.id}
            >
              <Spotlight
                className={'from-red-900 via-red-800 to-red-700 blur-2xl dark:from-red-100 dark:via-red-200 dark:to-red-50'
                }
                size={64}
              />
              <div className="relative h-full w-full rounded-[15px] bg-white p-4 dark:bg-zinc-950">
                <div className="relative flex w-full flex-row justify-between">
                  <div>
                    <h4 className="text-md font-normal dark:text-zinc-100 mb-1">
                      {job.title}<span className={`text-zinc-600 dark:text-zinc-400`}> @ {job.company}</span>
                    </h4>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                      {job.location}
                    </p>
                  </div>
                  <p className="italic text-sm text-zinc-600 dark:text-zinc-400 ">
                    {job.start}{job.end && ` - ${job.end}`}
                  </p>
                </div>
                {/* <svg className="w-10 h-10">
                  <use href={hr_handwritten_white.src} />
                </svg> */}
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {job.desc}
                </p>
              </div>
            </a>
          ))}
        </div>
      </motion.section>



      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
        className="mt-8 mb-6"
      >
        <h3 className="mb-5 text-lg font-medium font-serif">Connect</h3>
        <p className="mb-6 text-zinc-600 dark:text-zinc-400">
          Please don't email me at my email. Thanks. {' '}
          <a className="underline dark:text-zinc-300" href={`mailto:${EMAIL}`}>
            {EMAIL}
          </a>
        </p>
        <div className="flex items-center justify-start space-x-3">
          {SOCIAL_LINKS.map((link) => (
            <MagneticSocialLink key={link.label} link={link.link}>
              {link.label}
            </MagneticSocialLink>
          ))}
        </div>
      </motion.section>

        <Stars className="fill-[rgb(186,149,94)] dark:fill-[rgb(186,149,94)] transition-colors" />
      <motion.section
        variants={VARIANTS_SECTION}
        transition={TRANSITION_SECTION}
      >
        <AsciiArt />
      </motion.section>
    </motion.main>
  )
}

