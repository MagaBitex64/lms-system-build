// Server timestamps determine the duration. The device wall clock is never used.
export function serverCountdown(deadline: string | null | undefined, serverTime: string | undefined, monotonicNow: () => number) {
  if (!deadline || !serverTime) return () => null
  const duration = Date.parse(deadline) - Date.parse(serverTime)
  if (!Number.isFinite(duration)) return () => null
  const received = monotonicNow()
  return () => Math.max(0, Math.ceil((duration - (monotonicNow() - received)) / 1000))
}
