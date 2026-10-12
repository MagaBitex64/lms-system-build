'use client'

import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import { getFileUrl, getToken } from '@/lib/api'

export default function AuthImage({ fileId, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fileId: number }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    const controller = new AbortController()
    let blobUrl: string | undefined
    setSrc(undefined)
    void fetch(getFileUrl(fileId), {
      headers: { Authorization: `Bearer ${getToken() ?? ''}` }, signal: controller.signal,
    }).then(async response => {
      if (!response.ok) throw new Error('Image unavailable')
      const blob = await response.blob()
      if (controller.signal.aborted) return
      blobUrl = URL.createObjectURL(blob)
      setSrc(blobUrl)
    }).catch(() => { /* alt text remains available */ })
    return () => { controller.abort(); if (blobUrl) URL.revokeObjectURL(blobUrl) }
  }, [fileId])
  return <img {...props} src={src} />
}
