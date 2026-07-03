'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getToken } from '@/lib/api'
import { Spinner } from '@/components/ui'

export default function Home() {
  const router = useRouter()
  useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login')
  }, [router])
  return <Spinner />
}
