import { fetcher } from './api'
import type { ListingCourse } from '@/components/course-listing'

type CatalogPage = { items: ListingCourse[]; total: number }

/** Read only the existing permission-filtered, published catalog. */
export async function loadCatalog(query: string) {
  const courses: ListingCourse[] = []
  for (let page = 1; ; page++) {
    const result = await fetcher<CatalogPage>(`/courses?page=${page}&per_page=50&q=${encodeURIComponent(query)}`)
    courses.push(...result.items)
    if (!result.items.length || courses.length >= result.total) break
  }
  return courses
}
