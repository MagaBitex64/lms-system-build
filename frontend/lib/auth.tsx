'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api, setToken as saveToken, getToken as readToken } from '@/lib/api'
import type { ReactNode } from 'react'

export type Role = 'guest' | 'student' | 'teacher' | 'admin' | 'user'

export type User = {
  id: number
  email: string
  full_name: string
  role: Role
  is_blocked: boolean
}

type AuthContextState = {
  user: User | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, full_name: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    const token = readToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const data = await api('/auth/me')
      setUser(data as User)
      setError(null)
    } catch (err) {
      setUser(null)
      setError('Session expired')
      saveToken(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    const data = await api('/auth/login', { body: { email, password } })
    saveToken((data as any).token)
    setUser((data as any).user as User)
    setError(null)
    setLoading(false)
  }

  const register = async (email: string, password: string, full_name: string) => {
    setLoading(true)
    const data = await api('/auth/register', { body: { email, password, full_name } })
    saveToken((data as any).token)
    setUser((data as any).user as User)
    setError(null)
    setLoading(false)
  }

  const logout = () => {
    saveToken(null)
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, loading, error, login, register, logout, refresh }),
    [user, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}
