export type SearchResult = {id: number; title?: string; label?: string; description?: string; course_title?: string; course_id?: number; teacher_name?: string}
export type SearchPage = {courses: SearchResult[]; lessons: SearchResult[]; materials: SearchResult[]; page: number; per_page: number; has_more: boolean}
export type SearchState = {query: string; pages: SearchPage[]; pending: boolean; error: 'invalid' | 'request' | null}
export const validSearchQuery = (query: string) => query.trim().length > 0 && Array.from(query).length <= 200
export const emptySearchState = (query: string): SearchState => ({query, pages: [], pending: false, error: query && !validSearchQuery(query) ? 'invalid' : null})

export function mergeSearchPages(pages: SearchPage[]) {
  const unique = (key: 'courses' | 'lessons' | 'materials') => Array.from(new Map(pages.flatMap(page => page[key]).map(item => [item.id, item])).values())
  return {courses: unique('courses'), lessons: unique('lessons'), materials: unique('materials')}
}

// One request at a time; a query change invalidates responses still in flight.
export function createSearchPager(fetchPage: (query: string, page: number) => Promise<SearchPage>, changed: (state: SearchState) => void) {
  let generation = 0
  let state = emptySearchState('')
  const publish = (patch: Partial<SearchState>) => { state = {...state, ...patch}; changed(state) }
  async function load() {
    if (state.pending || !validSearchQuery(state.query)) return
    const current = generation
    const page = (state.pages.at(-1)?.page ?? 0) + 1
    publish({pending: true, error: null})
    try {
      const response = await fetchPage(state.query, page)
      if (current !== generation) return
      publish({pages: [...state.pages, response], pending: false})
    } catch (error) {
      if (current !== generation) return
      publish({pending: false, error: (error as {status?: number})?.status === 422 ? 'invalid' : 'request'})
    }
  }
  return {
    setQuery(query: string) { generation++; state = emptySearchState(query); changed(state); if (validSearchQuery(query)) void load() },
    loadMore() { if (state.pages.at(-1)?.has_more) return load() },
    retry() { if (state.error === 'request') return load() },
    dispose() { generation++ },
  }
}
