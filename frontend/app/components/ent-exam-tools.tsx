'use client'

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Atom, Calculator, FlaskConical, GripHorizontal, X } from 'lucide-react'
import { cx } from '@/components/ui'

type ToolId = 'calculator' | 'periodic' | 'solubility'
type ElementTuple = [number, string, string, string, number, number, 's' | 'p' | 'd' | 'f']

const ELEMENTS: ElementTuple[] = [
  [1, 'H', 'Сутек', '1.008', 1, 1, 's'], [2, 'He', 'Гелий', '4.003', 1, 18, 'p'],
  [3, 'Li', 'Литий', '6.94', 2, 1, 's'], [4, 'Be', 'Бериллий', '9.012', 2, 2, 's'], [5, 'B', 'Бор', '10.81', 2, 13, 'p'], [6, 'C', 'Көміртек', '12.011', 2, 14, 'p'], [7, 'N', 'Азот', '14.007', 2, 15, 'p'], [8, 'O', 'Оттек', '15.999', 2, 16, 'p'], [9, 'F', 'Фтор', '18.998', 2, 17, 'p'], [10, 'Ne', 'Неон', '20.180', 2, 18, 'p'],
  [11, 'Na', 'Натрий', '22.990', 3, 1, 's'], [12, 'Mg', 'Магний', '24.305', 3, 2, 's'], [13, 'Al', 'Алюминий', '26.982', 3, 13, 'p'], [14, 'Si', 'Кремний', '28.085', 3, 14, 'p'], [15, 'P', 'Фосфор', '30.974', 3, 15, 'p'], [16, 'S', 'Күкірт', '32.06', 3, 16, 'p'], [17, 'Cl', 'Хлор', '35.45', 3, 17, 'p'], [18, 'Ar', 'Аргон', '39.948', 3, 18, 'p'],
  [19, 'K', 'Калий', '39.098', 4, 1, 's'], [20, 'Ca', 'Кальций', '40.078', 4, 2, 's'], [21, 'Sc', 'Скандий', '44.956', 4, 3, 'd'], [22, 'Ti', 'Титан', '47.867', 4, 4, 'd'], [23, 'V', 'Ванадий', '50.942', 4, 5, 'd'], [24, 'Cr', 'Хром', '51.996', 4, 6, 'd'], [25, 'Mn', 'Марганец', '54.938', 4, 7, 'd'], [26, 'Fe', 'Темір', '55.845', 4, 8, 'd'], [27, 'Co', 'Кобальт', '58.933', 4, 9, 'd'], [28, 'Ni', 'Никель', '58.693', 4, 10, 'd'], [29, 'Cu', 'Мыс', '63.546', 4, 11, 'd'], [30, 'Zn', 'Мырыш', '65.38', 4, 12, 'd'], [31, 'Ga', 'Галлий', '69.723', 4, 13, 'p'], [32, 'Ge', 'Германий', '72.630', 4, 14, 'p'], [33, 'As', 'Күшән', '74.922', 4, 15, 'p'], [34, 'Se', 'Селен', '78.971', 4, 16, 'p'], [35, 'Br', 'Бром', '79.904', 4, 17, 'p'], [36, 'Kr', 'Криптон', '83.798', 4, 18, 'p'],
  [37, 'Rb', 'Рубидий', '85.468', 5, 1, 's'], [38, 'Sr', 'Стронций', '87.62', 5, 2, 's'], [39, 'Y', 'Иттрий', '88.906', 5, 3, 'd'], [40, 'Zr', 'Цирконий', '91.224', 5, 4, 'd'], [41, 'Nb', 'Ниобий', '92.906', 5, 5, 'd'], [42, 'Mo', 'Молибден', '95.95', 5, 6, 'd'], [43, 'Tc', 'Технеций', '[98]', 5, 7, 'd'], [44, 'Ru', 'Рутений', '101.07', 5, 8, 'd'], [45, 'Rh', 'Родий', '102.91', 5, 9, 'd'], [46, 'Pd', 'Палладий', '106.42', 5, 10, 'd'], [47, 'Ag', 'Күміс', '107.87', 5, 11, 'd'], [48, 'Cd', 'Кадмий', '112.41', 5, 12, 'd'], [49, 'In', 'Индий', '114.82', 5, 13, 'p'], [50, 'Sn', 'Қалайы', '118.71', 5, 14, 'p'], [51, 'Sb', 'Сүрме', '121.76', 5, 15, 'p'], [52, 'Te', 'Теллур', '127.60', 5, 16, 'p'], [53, 'I', 'Йод', '126.90', 5, 17, 'p'], [54, 'Xe', 'Ксенон', '131.29', 5, 18, 'p'],
  [55, 'Cs', 'Цезий', '132.91', 6, 1, 's'], [56, 'Ba', 'Барий', '137.33', 6, 2, 's'], [57, 'La', 'Лантан', '138.91', 6, 3, 'f'], [58, 'Ce', 'Церий', '140.12', 6, 4, 'f'], [59, 'Pr', 'Празеодим', '140.91', 6, 5, 'f'], [60, 'Nd', 'Неодим', '144.24', 6, 6, 'f'], [61, 'Pm', 'Прометий', '[145]', 6, 7, 'f'], [62, 'Sm', 'Самарий', '150.36', 6, 8, 'f'], [63, 'Eu', 'Еуропий', '151.96', 6, 9, 'f'], [64, 'Gd', 'Гадолиний', '157.25', 6, 10, 'f'], [65, 'Tb', 'Тербий', '158.93', 6, 11, 'f'], [66, 'Dy', 'Диспрозий', '162.50', 6, 12, 'f'], [67, 'Ho', 'Гольмий', '164.93', 6, 13, 'f'], [68, 'Er', 'Эрбий', '167.26', 6, 14, 'f'], [69, 'Tm', 'Тулий', '168.93', 6, 15, 'f'], [70, 'Yb', 'Иттербий', '173.05', 6, 16, 'f'], [71, 'Lu', 'Лютеций', '174.97', 6, 17, 'f'],
  [72, 'Hf', 'Гафний', '178.49', 6, 4, 'd'], [73, 'Ta', 'Тантал', '180.95', 6, 5, 'd'], [74, 'W', 'Вольфрам', '183.84', 6, 6, 'd'], [75, 'Re', 'Рений', '186.21', 6, 7, 'd'], [76, 'Os', 'Осмий', '190.23', 6, 8, 'd'], [77, 'Ir', 'Иридий', '192.22', 6, 9, 'd'], [78, 'Pt', 'Платина', '195.08', 6, 10, 'd'], [79, 'Au', 'Алтын', '196.97', 6, 11, 'd'], [80, 'Hg', 'Сынап', '200.59', 6, 12, 'd'], [81, 'Tl', 'Таллий', '204.38', 6, 13, 'p'], [82, 'Pb', 'Қорғасын', '207.2', 6, 14, 'p'], [83, 'Bi', 'Висмут', '208.98', 6, 15, 'p'], [84, 'Po', 'Полоний', '[209]', 6, 16, 'p'], [85, 'At', 'Астат', '[210]', 6, 17, 'p'], [86, 'Rn', 'Радон', '[222]', 6, 18, 'p'],
  [87, 'Fr', 'Франций', '[223]', 7, 1, 's'], [88, 'Ra', 'Радий', '[226]', 7, 2, 's'], [89, 'Ac', 'Актиний', '[227]', 7, 3, 'f'], [90, 'Th', 'Торий', '232.04', 7, 4, 'f'], [91, 'Pa', 'Протактиний', '231.04', 7, 5, 'f'], [92, 'U', 'Уран', '238.03', 7, 6, 'f'], [93, 'Np', 'Нептуний', '[237]', 7, 7, 'f'], [94, 'Pu', 'Плутоний', '[244]', 7, 8, 'f'], [95, 'Am', 'Америций', '[243]', 7, 9, 'f'], [96, 'Cm', 'Кюрий', '[247]', 7, 10, 'f'], [97, 'Bk', 'Берклий', '[247]', 7, 11, 'f'], [98, 'Cf', 'Калифорний', '[251]', 7, 12, 'f'], [99, 'Es', 'Эйнштейний', '[252]', 7, 13, 'f'], [100, 'Fm', 'Фермий', '[257]', 7, 14, 'f'], [101, 'Md', 'Менделевий', '[258]', 7, 15, 'f'], [102, 'No', 'Нобелий', '[259]', 7, 16, 'f'], [103, 'Lr', 'Лоуренсий', '[266]', 7, 17, 'f'],
  [104, 'Rf', 'Резерфордий', '[267]', 7, 4, 'd'], [105, 'Db', 'Дубний', '[268]', 7, 5, 'd'], [106, 'Sg', 'Сиборгий', '[269]', 7, 6, 'd'], [107, 'Bh', 'Борий', '[270]', 7, 7, 'd'], [108, 'Hs', 'Хассий', '[269]', 7, 8, 'd'], [109, 'Mt', 'Мейтнерий', '[278]', 7, 9, 'd'], [110, 'Ds', 'Дармштадтий', '[281]', 7, 10, 'd'], [111, 'Rg', 'Рентгений', '[282]', 7, 11, 'd'], [112, 'Cn', 'Коперниций', '[285]', 7, 12, 'd'], [113, 'Nh', 'Нихоний', '[286]', 7, 13, 'p'], [114, 'Fl', 'Флеровий', '[289]', 7, 14, 'p'], [115, 'Mc', 'Московий', '[290]', 7, 15, 'p'], [116, 'Lv', 'Ливерморий', '[293]', 7, 16, 'p'], [117, 'Ts', 'Теннессин', '[294]', 7, 17, 'p'], [118, 'Og', 'Оганесон', '[294]', 7, 18, 'p'],
]

const CATIONS = ['H⁺', 'Li⁺', 'NH₄⁺', 'K⁺', 'Na⁺', 'Ag⁺', 'Ba²⁺', 'Ca²⁺', 'Mg²⁺', 'Zn²⁺', 'Mn²⁺', 'Cu²⁺', 'Hg²⁺', 'Pb²⁺', 'Fe²⁺', 'Fe³⁺', 'Al³⁺', 'Cr³⁺', 'Sn²⁺', 'Sr²⁺']
const SOLUBILITY: [string, string[]][] = [
  ['OH⁻', ['', 'Е', 'Е', 'Е', 'Е', '–', 'Е', 'АЕ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', '–', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'АЕ']],
  ['NO₃⁻', Array(18).fill('Е').concat(['–', 'Е'])],
  ['F⁻', ['Е', 'АЕ', 'Е', 'Е', 'Е', 'Е', 'АЕ', 'ЕМ', 'ЕМ', 'АЕ', 'АЕ', 'Е', '–', 'ЕМ', 'АЕ', 'АЕ', 'АЕ', 'ЕМ', 'Е', 'АЕ']],
  ['Cl⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'АЕ', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е']],
  ['Br⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'АЕ', 'АЕ', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е']],
  ['I⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'Е', 'Е', 'Е', 'Е', 'Е', '–', 'ЕМ', 'ЕМ', 'Е', '–', 'Е', '–', 'АЕ', 'Е']],
  ['S²⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'Е', '–', '–', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', '–', '–', '–', 'ЕМ', 'Е']],
  ['SO₃²⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'ЕМ', 'ЕМ', 'АЕ', 'АЕ', 'ЕМ', '–', 'ЕМ', 'ЕМ', 'АЕ', '–', '–', '–', '–', 'ЕМ']],
  ['SO₄²⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'АЕ', 'ЕМ', 'АЕ', 'Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ']],
  ['CO₃²⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', '–', 'ЕМ', 'ЕМ', 'ЕМ', '–', '–', '–', '–', 'ЕМ']],
  ['SiO₃²⁻', ['ЕМ', 'Е', '–', 'Е', 'Е', 'ЕМ', 'ЕМ', 'ЕМ', '–', 'ЕМ', 'ЕМ', 'ЕМ', '–', 'ЕМ', 'ЕМ', '–', 'ЕМ', '–', '–', 'ЕМ']],
  ['PO₄³⁻', ['Е', 'ЕМ', 'Е', 'Е', 'Е', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ', 'АЕ', 'ЕМ', 'ЕМ', 'ЕМ', 'ЕМ']],
  ['CrO₄²⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'ЕМ', 'ЕМ', 'АЕ', 'Е', 'ЕМ', 'ЕМ', 'ЕМ', '–', 'ЕМ', '–', '–', '–', '–', '–', 'АЕ']],
  ['CH₃COO⁻', ['Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'Е', 'АЕ', 'Е', 'Е', 'Е']],
]

const toolMeta = {
  calculator: { label: 'Калькулятор', short: 'Есептеу', icon: Calculator },
  periodic: { label: 'Менделеев кестесі', short: 'Элементтер', icon: Atom },
  solubility: { label: 'Ерігіштік кестесі', short: 'Ерігіштік', icon: FlaskConical },
}

function DraggableWindow({ title, onClose, children, large = false }: { title: string; onClose: () => void; children: ReactNode; large?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const drag = useRef({ pointerId: 0, dx: 0, dy: 0 })
  const [position, setPosition] = useState(() => ({ x: large ? 104 : 116, y: large ? 56 : 100 }))

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    drag.current = { pointerId: event.pointerId, dx: event.clientX - position.x, dy: event.clientY - position.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId !== event.pointerId) return
    const width = panelRef.current?.offsetWidth ?? 320
    const maxX = Math.max(8, window.innerWidth - Math.min(width, 120))
    const maxY = Math.max(8, window.innerHeight - 52)
    setPosition({
      x: Math.min(maxX, Math.max(8, event.clientX - drag.current.dx)),
      y: Math.min(maxY, Math.max(8, event.clientY - drag.current.dy)),
    })
  }
  function stopDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current.pointerId === event.pointerId) drag.current.pointerId = 0
  }

  return <div
    ref={panelRef}
    role="dialog"
    aria-label={title}
    className={cx(
      'fixed z-50 flex max-h-[calc(100vh-24px)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl',
      large ? 'h-[78vh] w-[min(1120px,calc(100vw-124px))] min-w-[300px] resize' : 'w-80',
    )}
    style={{ left: position.x, top: position.y }}
  >
    <div
      className="flex h-12 shrink-0 touch-none cursor-move select-none items-center justify-between border-b border-border bg-surface-muted px-4"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      <span className="flex items-center gap-2 font-bold"><GripHorizontal size={18} className="text-muted" />{title}</span>
      <button type="button" className="rounded-lg p-1.5 hover:bg-surface" onPointerDown={event => event.stopPropagation()} onClick={onClose} aria-label="Терезені жабу"><X size={20} /></button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
  </div>
}

function CalculatorTool() {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState<number | null>(null)
  const [operation, setOperation] = useState<string | null>(null)
  const [replace, setReplace] = useState(true)
  function number(value: string) { setDisplay(current => replace ? value : current === '0' ? value : `${current}${value}`); setReplace(false) }
  function decimal() { if (replace) { setDisplay('0.'); setReplace(false) } else if (!display.includes('.')) setDisplay(`${display}.`) }
  function calculate(nextOperation?: string) {
    const current = Number(display)
    let result = current
    if (stored !== null && operation) {
      if (operation === '+') result = stored + current
      if (operation === '−') result = stored - current
      if (operation === '×') result = stored * current
      if (operation === '÷') result = current === 0 ? NaN : stored / current
    }
    setDisplay(Number.isFinite(result) ? String(Number(result.toPrecision(12))) : 'Қате')
    setStored(nextOperation ? result : null); setOperation(nextOperation ?? null); setReplace(true)
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
  return <div className="space-y-3">
    <output className="block min-h-14 overflow-hidden rounded-xl bg-surface-muted p-3 text-right font-mono text-2xl" aria-live="polite">{display}</output>
    <div className="grid grid-cols-4 gap-2">
      <button className="rounded-lg bg-surface-muted p-3 font-semibold" onClick={() => { setDisplay('0'); setStored(null); setOperation(null); setReplace(true) }}>C</button>
      <button className="rounded-lg bg-surface-muted p-3 font-semibold" onClick={() => unary('sign')}>±</button>
      <button className="rounded-lg bg-surface-muted p-3 font-semibold" onClick={() => unary('percent')}>%</button>
      <button className="rounded-lg bg-surface-muted p-3 font-semibold" onClick={() => unary('sqrt')}>√</button>
      {keys.map(key => <button key={key} className="rounded-lg border border-border bg-surface p-3 font-semibold hover:bg-primary-soft" onClick={() => key >= '0' && key <= '9' ? number(key) : key === '.' ? decimal() : key === '=' ? calculate() : choose(key)}>{key}</button>)}
    </div>
  </div>
}

const elementTone = { s: 'bg-violet-200', p: 'bg-cyan-200', d: 'bg-pink-200', f: 'bg-amber-200' }
function ElementCell({ item, row, column }: { item: ElementTuple; row?: number; column?: number }) {
  const [number, symbol, name, mass, period, group, block] = item
  return <div
    className={cx('relative min-h-16 rounded border border-foreground/25 p-1 text-foreground', elementTone[block])}
    style={row && column ? { gridRow: row, gridColumn: column } : undefined}
    title={`${number}. ${name} (${symbol}) — ${mass}`}
  >
    <span className="absolute right-1 top-0.5 text-[9px]">{number}</span>
    <b className="block text-lg leading-5">{symbol}</b>
    <span className="block truncate text-[9px]">{name}</span>
    <span className="block text-right text-[9px] font-semibold">{mass}</span>
    <span className="sr-only">{period}-период, {group}-топ</span>
  </div>
}

function PeriodicTable() {
  const main = ELEMENTS.filter(item => item[6] !== 'f')
  const lanthanides = ELEMENTS.filter(item => item[0] >= 57 && item[0] <= 71)
  const actinides = ELEMENTS.filter(item => item[0] >= 89 && item[0] <= 103)
  return <div className="min-w-[1080px] space-y-4 text-foreground">
    <div className="text-center"><h3 className="text-lg font-bold">Химиялық элементтердің периодтық жүйесі</h3><p className="text-xs text-muted">Ұяшықта атомдық нөмір, таңба, атау және салыстырмалы атомдық масса берілген</p></div>
    <div className="grid grid-cols-[32px_1fr] gap-1 text-center text-[10px] text-muted">
      <span />
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(18, minmax(52px, 1fr))' }}>{Array.from({ length: 18 }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
    </div>
    <div className="grid grid-cols-[32px_1fr] gap-1">
      <div className="grid gap-1" style={{ gridTemplateRows: 'repeat(7, minmax(64px, auto))' }}>{Array.from({ length: 7 }, (_, i) => <span key={i} className="flex min-h-16 items-center justify-center text-xs font-bold text-muted">{i + 1}</span>)}</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(18, minmax(52px, 1fr))', gridTemplateRows: 'repeat(7, minmax(64px, auto))' }}>
        {main.map(item => <ElementCell key={item[0]} item={item} row={item[4]} column={item[5]} />)}
        <div className="flex min-h-16 items-center justify-center rounded border border-dashed border-amber-500 bg-amber-100 text-xs font-bold" style={{ gridRow: 6, gridColumn: 3 }}>57–71</div>
        <div className="flex min-h-16 items-center justify-center rounded border border-dashed border-amber-500 bg-amber-100 text-xs font-bold" style={{ gridRow: 7, gridColumn: 3 }}>89–103</div>
      </div>
    </div>
    <div className="space-y-1 pl-[36px]">
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, minmax(52px, 1fr))' }}>{lanthanides.map(item => <ElementCell key={item[0]} item={item} />)}</div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(15, minmax(52px, 1fr))' }}>{actinides.map(item => <ElementCell key={item[0]} item={item} />)}</div>
    </div>
    <div className="flex flex-wrap justify-center gap-4 text-xs">
      <span className="rounded bg-violet-200 px-3 py-1">s-блок</span><span className="rounded bg-pink-200 px-3 py-1">d-блок</span><span className="rounded bg-cyan-200 px-3 py-1">p-блок</span><span className="rounded bg-amber-200 px-3 py-1">f-блок</span>
    </div>
  </div>
}

const solubilityTone: Record<string, string> = { 'Е': 'bg-violet-200', 'АЕ': 'bg-cyan-300', 'ЕМ': 'bg-pink-200', '–': 'bg-amber-300' }
function SolubilityTable() {
  return <div className="min-w-[1080px] space-y-5 text-foreground">
    <div className="text-center"><h3 className="text-lg font-bold">Қышқыл, негіз және тұздардың суда ерігіштігі</h3><p className="text-xs text-muted">Бөлме температурасындағы сапалық анықтамалық</p></div>
    <table className="w-full table-fixed border-collapse text-center text-xs">
      <thead><tr><th className="sticky left-0 z-10 w-20 border border-foreground/30 bg-surface p-2">Анион</th>{CATIONS.map(cation => <th key={cation} className="border border-foreground/30 bg-surface-muted p-2 font-bold">{cation}</th>)}</tr></thead>
      <tbody>{SOLUBILITY.map(([anion, values]) => <tr key={anion}><th className="sticky left-0 z-10 border border-foreground/30 bg-surface p-2 text-sm">{anion}</th>{values.map((value, index) => <td key={`${anion}-${index}`} className={cx('h-9 border border-foreground/30 font-semibold', value ? solubilityTone[value] : 'bg-surface')}>{value}</td>)}</tr>)}</tbody>
    </table>
    <div className="flex flex-wrap justify-center gap-4 text-sm">
      <span className="rounded bg-violet-200 px-3 py-2"><b>Е</b> — зат ериді</span>
      <span className="rounded bg-cyan-300 px-3 py-2"><b>АЕ</b> — зат аз ериді</span>
      <span className="rounded bg-pink-200 px-3 py-2"><b>ЕМ</b> — зат ерімейді</span>
      <span className="rounded bg-amber-300 px-3 py-2"><b>–</b> — зат алынбайды немесе ыдырайды</span>
    </div>
    <div className="text-center"><p className="font-bold">Металдардың белсенділік қатары</p><p className="mt-1 tracking-wide">Li, K, Ba, Ca, Na, Mg, Al, Mn, Cr, Zn, Fe, Co, Sn, Pb, H₂, Cu, Hg, Ag, Au</p><p className="text-xs text-muted">Белсенділігі және тотықсыздандырғыш қасиеті солдан оңға қарай әлсірейді →</p></div>
  </div>
}

export default function EntExamTools() {
  const [active, setActive] = useState<ToolId | null>(null)
  const meta = active ? toolMeta[active] : null
  return <>
    <aside className="fixed left-3 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2 rounded-2xl border border-border bg-surface/95 p-2 shadow-lg backdrop-blur" aria-label="Тест құралдары">
      {(Object.keys(toolMeta) as ToolId[]).map(id => {
        const item = toolMeta[id]
        const Icon = item.icon
        return <button key={id} type="button" onClick={() => setActive(current => current === id ? null : id)} aria-pressed={active === id} title={item.label} className={cx('flex w-16 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition-colors', active === id ? 'bg-primary text-primary-foreground' : 'hover:bg-primary-soft hover:text-primary')}>
          <Icon size={22} /><span className="leading-tight">{item.short}</span>
        </button>
      })}
    </aside>
    {active && meta && <DraggableWindow key={active} title={meta.label} onClose={() => setActive(null)} large={active !== 'calculator'}>
      {active === 'calculator' ? <CalculatorTool /> : active === 'periodic' ? <PeriodicTable /> : <SolubilityTable />}
    </DraggableWindow>}
  </>
}
