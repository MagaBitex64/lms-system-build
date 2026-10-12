/** Cohesive decorative illustrations used only by the public five-step section. */
export function ProcessArt({ step }: { step: number }) {
  const id = `process-${step}`
  const blue = `url(#${id}-blue)`
  const light = `url(#${id}-light)`
  const cyan = `url(#${id}-cyan)`
  const gold = `url(#${id}-gold)`
  const shadow = `url(#${id}-shadow)`

  return <svg viewBox="0 0 240 175" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a2dcff" /><stop offset=".48" stopColor="#52a5ec" /><stop offset="1" stopColor="#2075c6" /></linearGradient>
      <linearGradient id={`${id}-light`} x1="0" y1="0" x2=".85" y2="1"><stop stopColor="#fff" /><stop offset=".65" stopColor="#f2f7ff" /><stop offset="1" stopColor="#c8ddf7" /></linearGradient>
      <linearGradient id={`${id}-cyan`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d4fcff" /><stop offset=".48" stopColor="#8ee8ed" /><stop offset="1" stopColor="#35bbd4" /></linearGradient>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#ffe9ac" /><stop offset="1" stopColor="#ffbc3c" /></linearGradient>
      <radialGradient id={`${id}-floor`}><stop stopColor="#6397d6" stopOpacity=".24" /><stop offset="1" stopColor="#9cc2ec" stopOpacity="0" /></radialGradient>
      <filter id={`${id}-shadow`} x="-30%" y="-30%" width="170%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#5489c2" floodOpacity=".18" /></filter>
    </defs>
    <ellipse cx="122" cy="153" rx="101" ry="15" fill={`url(#${id}-floor)`} />

    {step === 1 && <g filter={shadow}>
      <path d="M30 35h68a20 20 0 0 1 20 20v34a20 20 0 0 1-20 20H57l-21 16 3-17a20 20 0 0 1-29-19V55a20 20 0 0 1 20-20Z" fill={cyan} />
      {[37, 58, 79].map(x => <circle key={x} cx={x} cy="71" r="6.5" fill={light} />)}
      <ellipse cx="143" cy="88" rx="46" ry="53" fill={light} />
      <path d="M96 94V77a47 47 0 0 1 94 0v20" fill="none" stroke="#237bd2" strokeWidth="13" strokeLinecap="round" />
      <path d="M96 89V76a47 47 0 0 1 94 0v13" fill="none" stroke="#9ddaff" strokeWidth="7" strokeLinecap="round" />
      <rect x="85" y="79" width="24" height="43" rx="12" fill={blue} stroke="#78baf0" strokeWidth="2" />
      <rect x="180" y="79" width="25" height="43" rx="12" fill={blue} stroke="#78baf0" strokeWidth="2" />
      <path d="M193 119c0 22-17 28-41 28" fill="none" stroke="#2683cd" strokeWidth="5" strokeLinecap="round" />
      <rect x="130" y="139" width="32" height="15" rx="7.5" fill={blue} />
      <path d="M91 91v18M186 89v20" stroke="#caeaff" strokeWidth="3" strokeLinecap="round" opacity=".85" />
    </g>}

    {step === 2 && <g filter={shadow}>
      <g transform="rotate(-3 99 92)">
        <rect x="44" y="29" width="119" height="126" rx="13" fill={blue} />
        <rect x="48" y="34" width="111" height="116" rx="10" fill={light} stroke="#d7e7fb" strokeWidth="2" />
        <path d="M78 24h13a12 12 0 0 1 24 0h13v19H78Z" fill={blue} />
        <circle cx="103" cy="22" r="4" fill="#eff9ff" />
        {[64, 93, 122].map((y) => <g key={y}><rect x="60" y={y} width="19" height="19" rx="5" fill={blue} /><path d={`m65 ${y + 10} 4 4 6-9`} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><rect x="90" y={y + 3} width="48" height="5" rx="2.5" fill="#b7d4f1" /><rect x="90" y={y + 13} width="33" height="4" rx="2" fill="#d3e3f5" /></g>)}
      </g>
      <path d="M177 86a37 37 0 1 0 37 37h-37Z" fill={cyan} stroke="#a0e9ef" strokeWidth="1.5" />
      <path d="M182 80v37h37a37 37 0 0 0-37-37Z" fill={blue} />
      <path d="m182 117 26-26" stroke="#d9f8ff" strokeWidth="2" />
    </g>}

    {step === 3 && <g filter={shadow}>
      {[111, 80, 49].map((y, i) => <g key={y}><path d={`M39 ${y} 146 ${y - 5}v29L39 ${y + 34}Q27 ${y + 32} 27 ${y + 18}T39 ${y}`} fill={blue} /><path d={`M44 ${y + 4} 146 ${y}v24L44 ${y + 28}Q35 ${y + 27} 35 ${y + 16}T44 ${y + 4}`} fill={light} /><path d={`M46 ${y + 12} 137 ${y + 8}M47 ${y + 19} 137 ${y + 15}`} stroke="#c5d9ee" strokeWidth="1.2" /><path d={`M44 ${y - 1} 153 ${y - 6}v5L44 ${y + 4}Z`} fill={i === 1 ? '#8cc7f0' : '#a6d9f8'} /></g>)}
      <g stroke="#e1b359" strokeWidth="1"><path d="m174 95-19-60 6-2 19 60Z" fill={gold} /><path d="m181 94-4-68 7-1 4 69Z" fill={gold} /><path d="m188 96 16-57 7 2-16 57Z" fill={gold} /></g>
      <path d="M164 89h39l-4 51q-16 10-31 0Z" fill={blue} />
      <ellipse cx="183.5" cy="89" rx="20" ry="6" fill="#74bdea" />
      <path d="M170 99v34" stroke="#b9e5ff" strokeWidth="3" strokeLinecap="round" opacity=".6" />
      <rect x="12" y="89" width="52" height="52" rx="12" fill={gold} /><path d="m32 102 18 13-18 13Z" fill="#fff" />
    </g>}

    {step === 4 && <g filter={shadow}>
      <g transform="rotate(-2 90 90)">
        <rect x="23" y="38" width="125" height="92" rx="9" fill="#206cae" />
        <rect x="27" y="42" width="117" height="84" rx="6" fill={blue} />
        <rect x="34" y="49" width="103" height="68" rx="4" fill="#367fc1" />
        <path d="m78 61 23 15q4 3 0 6l-23 15q-4 2-4-3V64q0-5 4-3Z" fill={light} />
        <path d="M42 107h86" stroke="#b3d9f3" strokeWidth="3" strokeLinecap="round" /><path d="M42 107h31" stroke="#6bf0ef" strokeWidth="3" strokeLinecap="round" /><circle cx="73" cy="107" r="3.5" fill="#91ffff" />
        <path d="m23 129 125-1 17 20H9Z" fill={light} stroke="#c4d9f0" strokeWidth="1.5" /><path d="M9 148h156v4q-4 5-10 5H20q-8 0-11-5Z" fill="#a9cce9" />
        <path d="m30 133 112-1 7 9H22Z" fill="#b7d9f2" /><path d="M73 143h28l5 5H68Z" fill="#dfeefe" />
      </g>
      <g transform="rotate(9 191 97)"><rect x="161" y="59" width="59" height="82" rx="11" fill={light} stroke="#d4e3f9" strokeWidth="1.5" />{[78, 99, 120].map(y => <g key={y}><circle cx="174" cy={y} r="4" fill={blue} /><rect x="186" y={y - 3} width="23" height="6" rx="3" fill="#81b9e8" /></g>)}</g>
    </g>}

    {step === 5 && <g filter={shadow}>
      {[30, 47, 68, 95, 119].map((height, i) => <g key={height}><rect x={25 + i * 35} y={149 - height} width="28" height={height} rx="7" fill={i < 2 ? cyan : i === 4 ? light : blue} /><ellipse cx={39 + i * 35} cy={152 - height} rx="13" ry="4" fill={i < 2 ? '#b2f4f6' : i === 4 ? '#e9f4ff' : '#acdfff'} /></g>)}
      <path d="M29 96c36-9 59-24 86-59" fill="none" stroke="#edb644" strokeWidth="8" strokeLinecap="round" /><path d="m101 34 21-10-4 24Z" fill={gold} /><path d="M30 94c36-10 56-24 82-57" fill="none" stroke="#ffe9a7" strokeWidth="3" strokeLinecap="round" />
      <path d="M160 48v22q22 14 44 0V48Z" fill={blue} /><path d="m147 43 37-14 42 13-40 17Z" fill={blue} stroke="#8cc8f0" strokeWidth="1.5" /><path d="m185 43 33 4v24" fill="none" stroke="#eab04c" strokeWidth="2" /><path d="m218 68-4 12h8Z" fill={gold} />
      <path d="m178 94 5-10 5 10 11 2-8 8 1 11-9-6-10 6 2-11-8-8Z" fill={gold} />
    </g>}
  </svg>
}
