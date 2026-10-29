import { BLOG_POSTS, EXPERIENCE_POSTS } from '@/app/data'
import PostsTable from '@/components/PostsTable'

export default function PostsPage() {
  return (
    <main className="writing-index">
      <section>
        <h2 className="writing-heading">In Writing</h2>
        <PostsTable posts={[...BLOG_POSTS, ...EXPERIENCE_POSTS]} />
      </section>
    </main>
  )
}
