'use client'

import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'

// Define ASCII art variants outside the component
const asciiArtDark = `⠀⠀⠀.　　　　　　　　　　　　　.　　　ﾟ .　　　　　　　　　.
.     𖥔݁ ˖        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀　　　.　　　⠀ . 　　　　.       ✦
　　　˚　　　　　　　　ﾟ　　　　　.           *⠀　　　⠀✦⠀　    
　　　　　　*　　　　　　　　　　　.  .　　　　　　　　　　　　　. 　　✦
            I'm Stanley Wang
　　　　　　*　　　　　　　　　　　　　　　　　　.              *
 .　　　　.　　　⠀ . 　　　　.          ✦⠀⠀⠀⠀⠀⠀⠀⠀⠀✦                .𖥔 ݁ ˖  
　　　　　　　  *⠀　　⠀  　　　　　⠀✦⠀　                    ✦               
　　　˚　　　　　　　　ﾟ　　　　　.           *⠀　　　⠀✦⠀　               
.⠀ 　　　　　　　　　　.　　　　　　　　.  ✦⠀　   　　　,　　   　　　　　　　　.
　　　*　　⠀.                            welcome to my       ✦
         ⠀✦                               website     .        ✦
　　　　　.　　　　　　　　　　⠀✦ ˚　　　　　　　　　　　　　　*
.⠀ 　　　　　　　　　　.　　　　　　　　.  ✦⠀　   　　　,　　    　　　　　　　　.
　˚　　　　　　　　　　　　　　*
⠀⠀⠀⠀⠀⠀.　　　　　　　　　　⠀⠀⠀✦  
                          ⠀⠀⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠢⣄⠀⠀⠀⠀
                    ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
                    ⢀⡞⠀ je danse, je suis, and⠀⠈⣷⡀⠀⠀         ┈━═☆
                    ⢸  the time ticks          ⠀⠀⣽⡗⠀⠀
                    ⠸⡄   ⠀⠀⠀⠀⠀⠀             ⠀⠀⢠⣿⢳⣼⠄
                    ⠀⠱⣄⠀⠀   slightly back⠀⠀⠀⢀⣴⡿⠋⠀⡟⠀
                    ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⣀⠀⠄⠁⠀
                    ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⢕⢕⢕⢝⠟⠅⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠛⠐⠐⠑⠑⠑⠁⠁⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃  
                                    ₊__  
                                   ⋆𐙚 _)  
                           _.----._/ /    
                          /         / 
                       __/ (  | (  |    
                      /__.-'|_|--|_|   𓍊𓋼𓍊    𓇢𓆸`

const asciiArtLight = `
  
  
                                                         |
           _I'm Stanley Wang                           \\ _ /
		  ( \`   )_                                 -< = (_) = >-
		 (    )    \`)                                  /   \\
	   (_   (_ .  _) _)                                  |

                                                              _
                                        welcome to my        (  )
                      _, _ .              website         ( \`  ) . )
                     ( (  _ )_                           (_, _(  ,_)_)
                   (_(_  _(_ ,)
                   
                   
                          ⠀⠀⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠢⣄⠀⠀⠀⠀
                    ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
                    ⢀⡞⠀ pressure in its last  ⠀⠈⣷⡀⠀⠀
                    ⢸  form   ⠀⠀                 ⣽⡗⠀⠀
                    ⠸⡄   ⠀⠀          ⠀⠀⠀    ⠀⠀⢠⣿⢳⣼⠄
                    ⠀⠱⣄⠀⠀    is poetry⠀    ⠀⢀⣴⡿⠋⠀⡟⠀
                    ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⣀⠀⠄⠁⠀
                    ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⢕⢕⢕⢝⠟⠅⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠛⠐⠐⠑⠑⠑⠁⠁⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                                    ₊𐚁, ⊹  
                                    / _)  ‧₊˚♪♫ ˚♪⊹
                           _.----._/ /
                          /         /
                       __/ (  | (  |
                      /__.-'|_|--|_|  ❀𖡼.𖤣𖥧𖡼.𖤣𖥧 ⋆˚✿˖°`

const asciiArtDarkMedium = `
                          ⠀⠀⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠢⣄⠀⠀⠀⠀
     ┈━═☆            ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
                    ⢀⡞⠀ je danse, je suis, and⠀⠈⣷⡀
                    ⢸  the time ticks          ⠀⠀⣽⡗
                    ⠸⡄   ⠀⠀⠀⠀⠀⠀             ⠀⠀⢠⣿⢳⣼⠄
                    ⠀⠱⣄⠀⠀   slightly back⠀⠀⠀⢀⣴⡿⠋⠀⡟
                    ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⣀⠀⠄⠁
                    ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⢕⢕⢕⢝⠟⠅⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠛⠐⠐⠑⠑⠑⠁⠁⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                                    ₊__     
                                   ⋆𐙚 _)
                           _.----._/ /
                          /         /
                       __/ (  | (  |
                      /__.-'|_|--|_|   𓍊𓋼𓍊    𓇢𓆸`
const asciiArtLightMedium = `
                          ⠀⠀⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠢⣄⠀⠀⠀⠀
                    ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
                    ⢀⡞⠀ pressure in its last  ⠀⠈⣷⡀⠀⠀
                    ⢸  form   ⠀⠀                 ⣽⡗⠀⠀
                    ⠸⡄   ⠀⠀          ⠀⠀⠀    ⠀⠀⢠⣿⢳⣼⠄
                    ⠀⠱⣄⠀⠀    is poetry⠀    ⠀⢀⣴⡿⠋⠀⡟⠀
                    ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⣀⠀⠄⠁⠀
                    ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⢕⢕⢕⢝⠟⠅⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠛⠐⠐⠑⠑⠑⠁⠁⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
                    ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                                    ₊𐚁, ⊹  
                                    / _)  ‧₊˚♪♫ ˚♪⊹
                           _.----._/ /
                          /         /
                       __/ (  | (  |
                      /__.-'|_|--|_|  ❀𖡼.𖤣𖥧𖡼.𖤣𖥧 ⋆˚✿˖°`

const asciiArtDarkSmall = `
              ⠀⠀⠀⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
 ┈━═☆    ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠢⣄⠀⠀⠀⠀
        ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀⠀⠀
        ⢀⡞⠀ je danse, je suis, and⠀⠈⣷⡀
        ⢸  the time ticks          ⠀⠀⣽⡗
        ⠸⡄   ⠀⠀⠀⠀⠀⠀             ⠀⠀⢠⣿⢳⣼⠄
        ⠀⠱⣄⠀⠀   slightly back⠀⠀⠀⢀⣴⡿⠋⠀⡟
        ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⣀⠀⠄⠁
        ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⢕⢕⢕⢝⠟⠅⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠛⠐⠐⠑⠑⠑⠁⠁⠀⠀⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                        ₊__    
                       ⋆𐙚 _)
               _.----._/ /
              /         /
           __/ (  | (  |
          /__.-'|_|--|_|   𓍊𓋼𓍊    𓇢𓆸`

const asciiArtLightSmall = `
    ⠀⠀⠀           ⣀⣀⣀⡤⠤⠤⠤⣄⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
        ⠀⢉⠅⠊⣠⠴⠒⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠑⠲⢤⣒⠢⣄⠀
        ⡔⠁⡴⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⣌⢳⡀
        ⢀⡞⠀ pressure in its last  ⠀⠈⣷⡀⠀⠀
        ⢸  form   ⠀⠀                 ⣽⡗⠀⠀
        ⠸⡄   ⠀⠀          ⠀⠀⠀    ⠀⠀⢠⣿⢳⣼⠄
        ⠀⠱⣄⠀⠀    is poetry⠀    ⠀⢀⣴⡿⠋⠀⡟⠀
        ⠀⠀⠈⠑⠦⣤⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣴⢾⣿⣟⣀⠀⠄⠁⠀
        ⠀⠀⠀⠀⠀⠙⠉⢷⣄⠀⠀⢸⣟⣿⢿⣿⡝⢝⢝⢕⢕⢕⢝⠟⠅⠀⠀⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⢦⣈⣿⡅⠔⠛⠐⠐⠑⠑⠑⠁⠁⠀⠀⠀⠀⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠝⢝⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
        ⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠃⠀
                        ₊𐚁, ⊹   
                        / _) ‧₊˚♪♫ ˚♪⊹
               _.----._/ /
              /         /
           __/ (  | (  |
          /__.-'|_|--|_|  ❀𖡼.𖤣𖥧𖡼.𖤣𖥧 ⋆˚✿˖°`

export const AsciiArt = () => {
    const { theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // During server-side rendering and initial mount, use light theme as default
    const currentAscii = !mounted ? asciiArtLight : (theme === 'dark' ? asciiArtDark : asciiArtLight)
    const currentAsciiMedium = !mounted ? asciiArtLightMedium : (theme === 'dark' ? asciiArtDarkMedium : asciiArtLightMedium)
    const currentAsciiSmall = !mounted ? asciiArtLightSmall : (theme === 'dark' ? asciiArtDarkSmall : asciiArtLightSmall)
    return (
        <div className="flex-1">
            {/* Placeholder for small screens (hidden by default, shown on small screens) */}
            <div className="sm:hidden">
                {/* ASCII art for small screens */}
                <pre className="transparent-pre font-mono whitespace-pre leading-[1.2] text-sm mt-2 text-zinc-600 dark:text-zinc-400">
                    {currentAsciiSmall}
                </pre>
            </div>

            {/* Placeholder for medium screens (hidden by default, shown on medium screens) */}
            <div className="hidden sm:block md:hidden">
                {/* ASCII art for medium screens */}
                <pre className="transparent-pre font-mono whitespace-pre leading-[1.2] text-sm mt-2 text-zinc-600 dark:text-zinc-400">
                    {currentAsciiMedium}
                </pre>
            </div>

            {/* Placeholder for large screens (shown by default, hidden on smaller screens) */}
            <div className="hidden md:block">
                {/* ASCII art for large screens */}
                <pre className="transparent-pre font-mono whitespace-pre leading-[1.2] text-sm mt-2 text-zinc-600 dark:text-zinc-400">
                    {currentAscii}
                </pre>
            </div>
        </div>
    )
}

