'use client'

import { useState } from 'react'
import { Calculator, X } from 'lucide-react'
import { Button, Card } from '@/components/ui'

export default function EntCalculator() {
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [replace, setReplace] = useState(true)

  function number(value: string) {
    setDisplay(current => replace ? value : current === '0' ? value : `${current}${value}`)
    setReplace(false)
  }
  function decimal() {
    if (replace) { setDisplay('0.'); setReplace(false) }
    else if (!display.includes('.')) setDisplay(`${display}.`)
  }
  function calculate(nextOperation?: string) {
    const current = Number(display)
    let result = current
    if (stored !== null && operation) {
      if (operation === '+') result = stored + current
      if (operation === '−') result = stored - current
      if (operation === '×') result = stored * current
      if (operation === '÷') result = current === 0 ? NaN : stored / current
    }
    const shown = Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Қате'
    setDisplay(shown); setStored(nextOperation ? result : null); setOperation(nextOperation ?? null); setReplace(true)
  }
  function choose(op: string) {
    if (display === 'Қате') return
    if (stored !== null && !replace) calculate(op)
    else { setStored(Number(display)); setOperation(op); setReplace(true) }
  }
  function unary(kind: 'sqrt' | 'percent' | 'sign') {
    const value = Number(display)
    const result = kind === 'sqrt' ? Math.sqrt(value) : kind === 'percent' ? value / 100 : -value
    setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Қате'); setReplace(true)
  }
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+']
  return <div className="fixed bottom-5 right-5 z-40">
    {open && <Card className="mb-3 w-72 space-y-3 p-4 shadow-xl"><div role="dialog" aria-label="Калькулятор" className="contents">
      <div className="flex items-center justify-between"><span className="font-bold">Калькулятор</span><button onClick={() => setOpen(false)} aria-label="Жабу"><X size={20} /></button></div>
      <output className="block min-h-14 overflow-hidden rounded-xl bg-surface-muted p-3 text-right font-mono text-2xl" aria-live="polite">{display}</output>
      <div className="grid grid-cols-4 gap-2">
        <button className="rounded-lg bg-surface-muted p-3 font-semibold" onClick={() => { setDisplay('0'); setStored(null); setOperation(null); setReplace(true) }}>C</button>
        <button className="rounded-lg bg-surface-muted p-3 font-semibold" onClick={() => unary('sign')}>±</button>
        <button className="rounded-lg bg-surface-muted p-3 font-semibold" onClick={() => unary('percent')}>%</button>
        <button className="rounded-lg bg-surface-muted p-3 font-semibold" onClick={() => unary('sqrt')}>√</button>
        {keys.map(key => <button key={key} className="rounded-lg border border-border bg-surface p-3 font-semibold hover:bg-primary-soft" onClick={() => key >= '0' && key <= '9' ? number(key) : key === '.' ? decimal() : key === '=' ? calculate() : choose(key)}>{key}</button>)}
      </div>
    </div></Card>}
    <Button onClick={() => setOpen(v => !v)} aria-expanded={open}><Calculator size={18} />Калькулятор</Button>
  </div>
}
