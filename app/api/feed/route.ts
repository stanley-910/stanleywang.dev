import { Feed } from 'feed'
import { BLOG_POSTS } from '@/app/data'
import { WEBSITE_URL } from '@/lib/constants'
import fs from 'fs/promises'
import path from 'path'

async function getPostContent(postSlug: string) {
  try {
    // Extract just the last part of the path (e.g., "dijkstras-algorithm" from "/writing/dijkstras-algorithm")
    const slug = postSlug.split('/').pop() || ''
    const filePath = path.join(process.cwd(), 'app/writing', slug, 'page.mdx')
    
    console.log('Reading file from:', filePath) // Debug log
    const content = await fs.readFile(filePath, 'utf-8')
    
    // Remove frontmatter (content between --- markers)
    const contentWithoutFrontmatter = content.replace(/^---[\s\S]*?---/, '').trim()
    
    return contentWithoutFrontmatter
  } catch (error) {
    console.error(`Error reading post content for ${postSlug}:`, error)
    return null
  }
}

export async function GET() {
  // Create new feed
  const feed = new Feed({
    title: "Stanley Wang's Blog",
    description: "Writing about tech, algorithms, and more",
    id: WEBSITE_URL,
    link: WEBSITE_URL,
    language: "en",
    favicon: `${WEBSITE_URL}/favicon.ico`,
    copyright: `All rights reserved ${new Date().getFullYear()}`,
    author: {
      name: "Stanley Wang",
      link: WEBSITE_URL
    }
  });

  // Add blog posts to feed
  for (const post of BLOG_POSTS) {
    const postContent = await getPostContent(post.link)
    
    feed.addItem({
      title: post.title,
      id: `${WEBSITE_URL}${post.link}`,
      link: `${WEBSITE_URL}${post.link}`,
      description: post.description,
      content: postContent || post.description, // Fallback to description if content can't be read
      date: new Date(post.date),
      author: [{
        name: "Stanley Wang",
        link: WEBSITE_URL
      }],
      category: post.tags.map(tag => ({ name: tag }))
    });
  }

  // Return the feed as XML with proper headers
  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    }
  })
} 