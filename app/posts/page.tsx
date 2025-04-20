import PostsTable from '@/components/PostsTable'
import { BLOG_POSTS } from '@/app/data'

export default function PostsPage() {
  return (
    <div className="">
      <div className="">
        <p className="text-lg font-serif italic mb-4 text-gray-900 dark:text-gray-100">
          In Writing
        </p>
        <PostsTable posts={BLOG_POSTS} />
      </div>
    </div>
  )
} 