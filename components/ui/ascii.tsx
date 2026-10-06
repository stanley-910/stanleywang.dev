'use client'

import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'

// Define ASCII art variants outside the component
const asciiArtDark = `⠀⠀⠀.　　　　　　　　　　　　　.　　　ﾟ .　　　　　　　　　.
.     𖥔݁ ˖        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀　　　.　　　⠀ . 　　　　.       ✦
　　　˚　　　　　　　　ﾟ　　　　　.           *⠀　　　⠀✦⠀　
　　　　　　*　　　　　　　　　　　.  .　　　　　　　　　　　　　. 　　✦

　　　　　　*　　　　　　　　　　　　　　　　　　.              *
 .　　　　.　　　⠀ . 　　　　.          ✦⠀⠀⠀⠀⠀⠀⠀⠀⠀✦                .𖥔 ݁ ˖
　　　　　　　  *⠀　　⠀  　　　　　⠀✦⠀　                    ✦
　　　˚　　　　　　　　ﾟ　　　　　.           *⠀　　　⠀✦⠀　
.⠀ 　　　　　　　　　　.　　　　　　　　.  ✦⠀　   　　　,　　   　　　　　　　　.
　　　*　　⠀.                                                ✦
         ⠀✦                                           .        ✦
　　　　　.　　　　　　　　　　⠀✦ ˚　　　　　　　　　　　　　　*
.⠀ 　　　　　　　　　　.　　　　　　　　.  ✦⠀　   　　　,　　    　　　　　　　　.
　˚　　　　　　　　　　　　　　*
⠀⠀⠀⠀⠀⠀.　　　　　　　　　　⠀⠀⠀✦
                            ⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠀⠀⠀⠀              ┈━═☆
                    ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
                    ⢀⡞⠀ not everything you    ⠀⠈⣷⡀
                    ⢸  touch                   ⠀⠀⣽
                    ⠸⡄      turns to gold yet  ⢠⣿⢳
                    ⠀⠱⣄⠀⠀                   ⢀⣴⡿⠋
                    ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⠀
                    ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⠔⠛⠐
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                                    ₊__
                                   ⋆𐙚 _)
                           _.----._/ /
                          /         /
                       __/ (  | (  |
                      /__.-'|_|--|_|   𓍊𓋼𓍊𓋼𓍊𓋼𓍊  𓇢𓆸`

const asciiArtLight = `


                                                         |
           _  __                                       \\ _ /
		  ( \`   )_                                 -< = (_) = >-
		 (    )    \`)                                  /   \\
	   (_   (_ .  _) _)                                  |

                                                              _
                                                             (  )
                      _, _ .                              ( \`  ) . )
                     ( (  _ )_                           (_, _(  ,_)_)
                   (_(_  _(_ ,)


                            ⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠀⠀⠀⠀
                    ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
                    ⢀⡞⠀ je danse, je suis, and⠀⠈⣷⡀
                    ⢸  the time ticks          ⠀⠀⣽
                    ⠸⡄   ⠀⠀⠀⠀⠀⠀             ⠀⠀⢠⣿⢳
                    ⠀⠱⣄⠀⠀   slightly back⠀⠀⠀⢀⣴⡿⠋
                    ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⠀
                    ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⠔⠛⠐
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                                    ₊𐚁, ⊹
                                    / _)  ‧₊˚♪♫ ˚♪⊹
                           _.----._/ /
                          /         /
                       __/ (  | (  |
                      /__.-'|_|--|_|  ❀𖡼.𖤣𖥧𖡼.𖤣𖥧 ⋆˚✿˖°`

const asciiArtDarkMedium = `
                            ⠀⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
    ┈━═☆             ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠀⠀⠀⠀
                    ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
                    ⢀⡞⠀ je danse, je suis, and⠀⠈⣷⡀
                    ⢸  the time ticks          ⠀⠀⣽
                    ⠸⡄   ⠀⠀⠀⠀⠀⠀             ⠀⠀⢠⣿⢳
                    ⠀⠱⣄⠀⠀   slightly back⠀⠀⠀⢀⣴⡿⠋
                    ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⠀
                    ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⠔⠛⠐
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                                    ₊__
                                   ⋆𐙚 _)
                           _.----._/ /
                          /         /
                       __/ (  | (  |
                      /__.-'|_|--|_|   𓍊𓋼𓍊𓋼𓍊𓋼𓍊  𓇢𓆸`
const asciiArtLightMedium = `
                            ⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠀⠀⠀⠀
                    ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
                    ⢀⡞⠀ je danse, je suis, and⠀⠈⣷⡀
                    ⢸  the time ticks          ⠀⠀⣽
                    ⠸⡄   ⠀⠀⠀⠀⠀⠀             ⠀⠀⢠⣿⢳
                    ⠀⠱⣄⠀⠀   slightly back⠀⠀⠀⢀⣴⡿⠋
                    ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⠀
                    ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⠔⠛⠐
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                                    ₊𐚁, ⊹
                                    / _)  ‧₊˚♪♫ ˚♪⊹
                           _.----._/ /
                          /         /
                       __/ (  | (  |
                      /__.-'|_|--|_|  ❀𖡼.𖤣𖥧𖡼.𖤣𖥧 ⋆˚✿˖°`

const asciiArtDarkSmall = `
              ⠀⠀⠀ ⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
 ┈━═☆    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠀⠀⠀⠀
        ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
        ⢀⡞⠀ je danse, je suis, and⠀⠈⣷⡀
        ⢸  the time ticks          ⠀⠀⣽
        ⠸⡄   ⠀⠀⠀⠀⠀⠀             ⠀⠀⢠⣿⢳
        ⠀⠱⣄⠀⠀   slightly back⠀⠀⠀⢀⣴⡿⠋
        ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⠀
        ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⠔⠛⠐
        ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                        ₊__
                       ⋆𐙚 _)
               _.----._/ /
              /         /
           __/ (  | (  |
          /__.-'|_|--|_|   𓍊𓋼𓍊𓋼𓍊𓋼𓍊  𓇢𓆸`

const asciiArtLightSmall = `
              ⠀⠀⠀ ⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
         ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠀⠀⠀⠀
        ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
        ⢀⡞⠀ je danse, je suis, and⠀⠈⣷⡀
        ⢸  the time ticks          ⠀⠀⣽
        ⠸⡄   ⠀⠀⠀⠀⠀⠀             ⠀⠀⢠⣿⢳
        ⠀⠱⣄⠀⠀   slightly back⠀⠀⠀⢀⣴⡿⠋
        ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⠀
        ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⠔⠛⠐
        ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                        ₊𐚁, ⊹
                        / _) ‧₊˚♪♫ ˚♪⊹
               _.----._/ /
              /         /
           __/ (  | (  |
          /__.-'|_|--|_|  ❀𖡼.𖤣𖥧𖡼.𖤣𖥧 ⋆˚✿˖°`

export const AsciiArt = () => {
  const { resolvedTheme: theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During server-side rendering and initial mount, use light theme as default
  const currentAscii = !mounted
    ? asciiArtLight
    : theme === 'dark'
      ? asciiArtDark
      : asciiArtLight
  const currentAsciiMedium = !mounted
    ? asciiArtLightMedium
    : theme === 'dark'
      ? asciiArtDarkMedium
      : asciiArtLightMedium
  const currentAsciiSmall = !mounted
    ? asciiArtLightSmall
    : theme === 'dark'
      ? asciiArtDarkSmall
      : asciiArtLightSmall
  return (
    <div className="flex-1">
      {/* Placeholder for small screens (hidden by default, shown on small screens) */}
      <div className="sm:hidden">
        {/* ASCII art for small screens, scaled down to fit a narrow phone */}
        <pre className="transparent-pre mt-2 font-mono text-[min(0.875rem,3.5vw)] leading-[1.2] whitespace-pre text-zinc-600 dark:text-zinc-400">
          {currentAsciiSmall}
        </pre>
      </div>

      {/* Placeholder for medium screens (hidden by default, shown on medium screens) */}
      <div className="hidden sm:block md:hidden">
        {/* ASCII art for medium screens */}
        <pre className="transparent-pre mt-2 font-mono text-sm leading-[1.2] whitespace-pre text-zinc-600 dark:text-zinc-400">
          {currentAsciiMedium}
        </pre>
      </div>

      {/* Placeholder for large screens (shown by default, hidden on smaller screens) */}
      <div className="hidden md:block">
        {/* ASCII art for large screens */}
        <pre className="transparent-pre mt-2 font-mono text-sm leading-[1.2] whitespace-pre text-zinc-600 dark:text-zinc-400">
          {currentAscii}
        </pre>
      </div>
    </div>
  )
}
