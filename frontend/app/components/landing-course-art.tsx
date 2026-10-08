type CourseSubject = string

const palettes: Record<string, [string, string, string]> = {
  math: ['#cbe6ff', '#3979d4', '#17529a'],
  physics: ['#ffe5c4', '#f7a339', '#cf7120'],
  biology: ['#c9f3d8', '#46ad72', '#207c59'],
  chemistry: ['#e2d9ff', '#7c78e2', '#4f5cb8'],
  history: ['#fce8cb', '#d9a65b', '#a77435'],
  reading: ['#ffdbe6', '#e57d9d', '#b85175'],
  literacy: ['#cff5ee', '#43bfae', '#0c8e8c'],
  informatics: ['#e2dcff', '#8b7de0', '#5d52b2'],
}

/** Decorative, standalone vector artwork for the eight public course cards. */
export function CourseArt({ subject }: { subject: CourseSubject }) {
  const [light, mid, dark] = palettes[subject] ?? palettes.math
  const face = `course-${subject}-face`
  const shade = `course-${subject}-shade`
  const shadow = `course-${subject}-shadow`

  return <svg viewBox="0 0 300 215" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={face} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fff" /><stop offset=".45" stopColor={light} /><stop offset="1" stopColor={mid} /></linearGradient>
      <linearGradient id={shade} x1="0" x2="1" y1="0" y2="1"><stop stopColor={mid} /><stop offset="1" stopColor={dark} /></linearGradient>
      <filter id={shadow} x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="9" stdDeviation="9" floodColor={dark} floodOpacity=".23" /></filter>
    </defs>

    {subject === 'math' && <>
      <text x="26" y="52" fill={mid} opacity=".45" fontSize="22" fontWeight="700">a² + b² = c²</text>
      <path d="M33 97 74 57 112 109Z" fill="none" stroke={mid} strokeWidth="2" opacity=".36" />
      <g transform="translate(144 22) rotate(12 66 80)" filter={`url(#${shadow})`}>
        <rect x="22" y="8" width="125" height="168" rx="16" fill={dark} />
        <rect x="26" y="10" width="117" height="160" rx="13" fill={`url(#${face})`} />
        <rect x="41" y="30" width="88" height="35" rx="5" fill="#eff8ff" stroke="#94bfea" strokeWidth="2" />
        <text x="111" y="55" textAnchor="end" fill={dark} fontSize="19" fontWeight="700">130</text>
        {[0, 1, 2, 3].map(row => [0, 1, 2].map(col => <rect key={`${row}-${col}`} x={43 + col * 30} y={76 + row * 21} width="24" height="16" rx="4" fill={row === 3 && col === 2 ? dark : '#d6eaff'} stroke="#88b7e8" strokeWidth="1" />))}
      </g>
      <g transform="rotate(-31 136 173)"><rect x="75" y="169" width="125" height="8" rx="4" fill={dark} /><path d="M200 169 216 173 200 177Z" fill="#dbac75" /></g>
    </>}

    {subject === 'physics' && <>
      <text x="28" y="54" fill={mid} opacity=".43" fontSize="23" fontStyle="italic">E = mc²</text>
      <circle cx="209" cy="117" r="72" fill={light} opacity=".34" />
      <g fill="none" stroke={dark} strokeWidth="3" opacity=".87">
        <ellipse cx="205" cy="115" rx="100" ry="38" transform="rotate(27 205 115)" />
        <ellipse cx="205" cy="115" rx="100" ry="38" transform="rotate(-32 205 115)" />
        <ellipse cx="205" cy="115" rx="98" ry="38" transform="rotate(88 205 115)" />
      </g>
      <circle cx="205" cy="115" r="23" fill={`url(#${shade})`} filter={`url(#${shadow})`} />
      <circle cx="205" cy="115" r="10" fill={light} opacity=".7" />
      <circle cx="116" cy="79" r="10" fill={`url(#${face})`} stroke={mid} strokeWidth="2" />
      <circle cx="269" cy="64" r="9" fill={`url(#${face})`} stroke={mid} strokeWidth="2" />
      <circle cx="250" cy="168" r="9" fill={`url(#${face})`} stroke={mid} strokeWidth="2" />
    </>}

    {subject === 'biology' && <>
      <g opacity=".46" fill="none" stroke={mid} strokeWidth="3"><path d="M35 35c55 22 6 72 61 94M95 35C40 57 89 107 34 129" /><path d="M49 48h33M43 69h43M44 93h44M49 116h31" /></g>
      <path d="M106 177c-12-35-12-63 7-94" fill="none" stroke={dark} strokeWidth="4" />
      <path d="M110 132c-29-12-36-29-30-42 21 2 37 14 30 42ZM111 111c21-31 35-29 47-24-9 25-21 34-47 24Z" fill={`url(#${face})`} stroke={mid} strokeWidth="2" />
      <g filter={`url(#${shadow})`}>
        <path d="M169 180h97l-13-16h-72Z" fill={dark} /><rect x="178" y="156" width="77" height="12" rx="5" fill={mid} />
        <path d="M195 160c35-10 48-31 40-59l-16 7c4 16-5 29-28 35Z" fill={`url(#${shade})`} />
        <g transform="rotate(-26 222 77)"><rect x="200" y="37" width="32" height="79" rx="8" fill={`url(#${face})`} stroke={dark} strokeWidth="3" /><rect x="197" y="30" width="39" height="12" rx="4" fill={dark} /><rect x="207" y="105" width="18" height="24" rx="4" fill={dark} /></g>
        <rect x="175" y="133" width="74" height="10" rx="5" fill={dark} /><circle cx="247" cy="124" r="9" fill={light} stroke={dark} strokeWidth="3" />
      </g>
    </>}

    {subject === 'chemistry' && <>
      <g fill="none" stroke={mid} strokeWidth="2" opacity=".43"><path d="m50 53 23-15 23 15v27L73 95 50 80Z" /><path d="m96 53 23-15 23 15v27l-23 15-23-15" /><path d="M73 38V20M119 95v20M142 53l19-14" /></g>
      <g filter={`url(#${shadow})`}>
        <path d="M180 23h45v13h-9v49l43 72c9 16 0 30-18 30h-77c-18 0-26-15-17-30l42-72V36h-9Z" fill={`url(#${face})`} stroke={dark} strokeWidth="3" />
        <path d="M170 129c22 9 44-8 67 0l19 33c6 10 1 19-12 19h-80c-12 0-18-9-12-19Z" fill={mid} opacity=".86" />
        <path d="M166 135c30 9 52-10 77 1" fill="none" stroke="#fff" strokeWidth="3" opacity=".75" />
        <rect x="180" y="25" width="45" height="11" rx="3" fill={dark} />
      </g>
      <circle cx="185" cy="149" r="5" fill="#fff" opacity=".76" /><circle cx="214" cy="158" r="7" fill="#fff" opacity=".64" />
      <g fill={mid} opacity=".74"><circle cx="267" cy="67" r="10" /><circle cx="286" cy="95" r="8" /><circle cx="264" cy="120" r="7" /></g>
      <path d="m267 67 19 28-22 25" fill="none" stroke={dark} strokeWidth="3" opacity=".45" />
    </>}

    {subject === 'history' && <>
      <circle cx="202" cy="69" r="57" fill={light} opacity=".55" />
      <g fill={`url(#${face})`} stroke={dark} strokeWidth="2" filter={`url(#${shadow})`}>
        <path d="M129 118h139v51H129Z" /><path d="M144 111c7-38 37-61 55-61s48 23 55 61Z" /><path d="M122 112h151v11H122Z" />
        <path d="M139 130h17v39h-17ZM169 130h17v39h-17ZM211 130h17v39h-17ZM242 130h17v39h-17Z" fill="#fff" />
        <path d="M118 169h158v12H118Z" fill={mid} />
      </g>
      <path d="M199 50V33m0 0-9 11h18Z" fill={dark} stroke={dark} strokeWidth="2" />
      <path d="M79 176V88l9-12 9 12v88M67 176h42" fill={`url(#${shade})`} stroke={dark} strokeWidth="2" />
      <circle cx="88" cy="70" r="13" fill={mid} /><path d="M78 72c9-2 16-2 20 0" fill="none" stroke="#fff" strokeWidth="2" />
    </>}

    {subject === 'reading' && <>
      <g filter={`url(#${shadow})`}>
        <g transform="rotate(-8 228 128)"><rect x="170" y="67" width="108" height="25" rx="5" fill={dark} /><rect x="176" y="70" width="99" height="17" rx="3" fill="#fff8fb" /><rect x="164" y="92" width="115" height="27" rx="5" fill={mid} /><rect x="170" y="96" width="106" height="19" rx="3" fill="#fff9fc" /><rect x="176" y="119" width="107" height="28" rx="5" fill={dark} /><rect x="181" y="123" width="98" height="19" rx="3" fill="#fff9fc" /></g>
        <path d="M62 160c36-19 65-18 99 4 34-22 68-23 105-5v34c-37-16-72-15-105 6-31-21-63-22-99-6Z" fill="#fff" stroke={mid} strokeWidth="3" />
        <path d="M161 164v35M74 169c35-13 60-10 80 2M170 171c32-15 61-16 85-6" fill="none" stroke={mid} strokeWidth="2" opacity=".58" />
      </g>
      <path d="m85 47 11 8-4 14-14 2-8-12 8-11Z" fill={light} opacity=".85" />
      <path d="M87 51v16m-7-11h14" stroke={dark} strokeWidth="2" opacity=".56" />
    </>}

    {subject === 'literacy' && <>
      <g filter={`url(#${shadow})`}>
        <path d="M106 178h169" fill="none" stroke={dark} strokeWidth="4" strokeLinecap="round" />
        <rect x="120" y="123" width="30" height="55" rx="5" fill={`url(#${face})`} stroke={mid} strokeWidth="2" />
        <rect x="164" y="96" width="30" height="82" rx="5" fill={`url(#${shade})`} />
        <rect x="209" y="61" width="30" height="117" rx="5" fill={`url(#${face})`} stroke={mid} strokeWidth="2" />
        <rect x="252" y="34" width="29" height="144" rx="5" fill={`url(#${shade})`} />
      </g>
      <path d="m82 111 45-31 46 10 46-38" fill="none" stroke={dark} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".55" />
      <g fill={mid}><circle cx="82" cy="111" r="5" /><circle cx="127" cy="80" r="5" /><circle cx="173" cy="90" r="5" /><circle cx="219" cy="52" r="5" /></g>
      <path d="M69 181a37 37 0 1 1 37-37H69Z" fill={light} stroke={mid} strokeWidth="2" opacity=".9" /><path d="M72 144h34M72 144v-37" stroke={dark} strokeWidth="2" />
    </>}

    {subject === 'informatics' && <>
      <g opacity=".42" fill={light} stroke={mid} strokeWidth="2"><rect x="35" y="41" width="77" height="52" rx="8" /><path d="M48 55h23M48 65h38M48 75h30" /></g>
      <g filter={`url(#${shadow})`}>
        <path d="M122 47h143c7 0 12 5 12 12v100H110V59c0-7 5-12 12-12Z" fill={dark} />
        <path d="M119 56h149v95H119Z" fill={`url(#${face})`} />
        <path d="M85 160h210l-16 17H99Z" fill={mid} /><path d="M85 160h210v7H85Z" fill={light} />
        <path d="m167 97-17 15 17 15m49-30 17 15-17 15m-31 9 15-48" fill="none" stroke={dark} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <circle cx="253" cy="75" r="5" fill={light} /><circle cx="239" cy="75" r="5" fill={light} />
    </>}
  </svg>
}
