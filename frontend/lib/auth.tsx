'use client'

import useSWR from 'swr'
import { api, fetcher, getToken, setToken, ApiError } from './api'

export type Role = 'student' | 'teacher' | 'admin'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
  is_blocked: boolean
  created_at: string
}

export function useAuth() {
  const hasToken = typeof window !== 'undefined' && !!getToken()
  const { data, error, isLoading, mutate } = useSWR<User>(hasToken ? '/auth/me' : null, fetcher, {
    shouldRetryOnError: (err) => !(err instanceof ApiError && (err.status === 401 || err.status === 403)),
  })

  const user = error ? undefined : data

  async function login(email: string, password: string) {
    const res = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } })
    setToken(res.token)
    await mutate(res.user, { revalidate: false })
    return res.user
  }

  function logout() {
    setToken(null)
    mutate(undefined, { revalidate: false })
    window.location.href = '/login'
  }

  return { user, isLoading: hasToken && isLoading, isAuthed: !!user, login, logout }
}
