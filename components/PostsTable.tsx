import { format } from 'date-fns'
import Link from 'next/link'

import type { BlogPost } from '@/app/data'
import '@/components/styles/PostsTable.css'

interface PostsTableProps {
  posts: BlogPost[]
}

// Every post in one list, newest first, each dated with its year.
export default function PostsTable({ posts }: PostsTableProps) {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return (
    <div className="posts-container posts-list">
      {sorted.map((post) => (
        <Link href={post.link} key={post.uid} className="post-link">
          <div className="post-row">
            <p className="post-title">{post.title}</p>
            <div className="post-date font-mono text-[0.9em]">
              {format(new Date(post.date), 'MMM d, yyyy')}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
