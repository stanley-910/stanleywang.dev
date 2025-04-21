import Link from 'next/link'
import type { Project } from '@/app/data'
import '@/components/styles/PostsTable.css' // We'll reuse the same styles

interface ProjectsTableProps {
  projects: Project[]
}

export default function ProjectsTable({ projects }: ProjectsTableProps) {
  // Group projects by category
  const projectsByCategory = projects.reduce((acc, project) => {
    const category = project.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(project)
    return acc
  }, {} as Record<string, Project[]>)

  // Sort categories alphabetically
  const sortedCategories = Object.keys(projectsByCategory).sort()

  return (
    <div className="posts-container">
      {sortedCategories.map(category => (
        <div key={category} className="posts-grid">
          {/* Category column */}
          <div className="year-column font-inter text-sm">
            {category}
          </div>
          
          {/* Projects column */}
          <div className="posts-column">
            {projectsByCategory[category].map((project) => (
              <Link 
                href={project.link} 
                key={project.id}
                className="post-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="post-row">
                  <p className="post-title font-serif tracking-wide text-sm">
                    {project.name}
                  </p>
                  <div className="post-date font-inter text-sm">
                    {project.description}
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