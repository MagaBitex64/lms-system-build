'use client'

import useSWR from 'swr'
import { api } from './api'

export async function fetchAllGroups<T>(): Promise<{ items: T[] }> {
  const items: T[] = []
  for (let page = 1; ; page += 1) {
    const result = await api<{ items: T[]; total: number }>(`/admin/groups?per_page=100&page=${page}`)
    items.push(...result.items)
    if (!result.items.length || items.length >= result.total) return { items }
  }
}

// The API remains paginated; group pickers must not silently discard later pages.
export function useAllGroups<T>(enabled = true) {
  return useSWR<{ items: T[] }>(enabled ? 'admin-groups-all-pages' : null, () => fetchAllGroups<T>())
}
