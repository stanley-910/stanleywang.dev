import Link from 'next/link'
import { format } from 'date-fns'
import type { BlogPost } from '@/app/data'
import '@/components/styles/PostsTable.css'

interface PostsTableProps {
  posts: BlogPost[]
}

export default function PostsTable({ posts }: PostsTableProps) {
  // Group posts by year
  const postsByYear = posts.reduce((acc, post) => {
    const year = new Date(post.date).getFullYear().toString()
    if (!acc[year]) {
      acc[year] = []
    }
    acc[year].push(post)
    return acc
  }, {} as Record<string, BlogPost[]>)

  // Sort years in descending order
  const sortedYears = Object.keys(postsByYear).sort((a, b) => parseInt(b) - parseInt(a))

  return (
    <div className="posts-container">
      {sortedYears.map(year => (
        <div key={year} className="posts-grid">
          {/* Year column */}
          <div className="year-column font-inter text-[0.9em]">
            {year}
          </div>
          
          {/* Posts column */}
          <div className="posts-column">
            {postsByYear[year]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map((post) => (
                <Link 
                  href={post.link} 
                  key={post.uid}
                  className="post-link"
                >
                  <div className="post-row">
                    <p className="post-title font-serif text-[1em]">
                      {post.title}
                    </p>
                    <div className="post-date font-inter text-[0.9em]">
                      {format(new Date(post.date), 'MMMM dd')}
                    </div>
                  </div>
                </Link>
              ))}
          </div>
        </div>
      ))}
    </div>
  )
}