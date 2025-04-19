'use client'

// This is a root layout for the posts page that won't inherit the scroll progress
export default function RootLayoutPosts({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <main className="prose prose-gray mt-10 pb-20 dark:prose-invert">
      {children}
    </main>
  )
} 