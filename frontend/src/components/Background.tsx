// frontend/src/components/Background.tsx
export default function Background() {
  return (
    <svg
      viewBox="0 0 800 500"
      className="absolute inset-0 w-full h-full"
      style={{ imageRendering: 'pixelated' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Sky / back wall */}
      <rect width="800" height="500" fill="#1a0800" />

      {/* Back wall planks */}
      {[0,1,2,3,4].map(i => (
        <rect key={i} x={0} y={i * 80} width="800" height="78" fill={i % 2 === 0 ? '#2d1500' : '#251000'} />
      ))}

      {/* Saloon sign */}
      <rect x="250" y="20" width="300" height="48" fill="#3d1e00" rx="2" />
      <rect x="254" y="24" width="292" height="40" fill="#2d1200" rx="1" />
      <text x="400" y="52" textAnchor="middle" fill="#f0c060"
        style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 'bold', letterSpacing: '4px' }}>
        ★ THE SALOON ★
      </text>

      {/* Lamps */}
      {[150, 400, 650].map(x => (
        <g key={x}>
          <rect x={x - 1} y={0} width={2} height={60} fill="#5d3000" />
          <polygon points={`${x},60 ${x-16},90 ${x+16},90`} fill="#f0c060" opacity="0.9" />
          <ellipse cx={x} cy={95} rx={20} ry={8} fill="#f0c060" opacity="0.25" />
        </g>
      ))}

      {/* Bar counter */}
      <rect x="0" y="340" width="800" height="20" fill="#5d3000" />
      <rect x="0" y="330" width="800" height="12" fill="#8d6000" />
      {/* Bar front planks */}
      {[0,4,8,12,16].map(i => (
        <rect key={i} x={0} y={360 + i * 14} width="800" height="12" fill={i % 2 === 0 ? '#3d1e00' : '#2d1500'} />
      ))}

      {/* Floor */}
      {Array.from({ length: 50 }, (_, i) => (
        <rect key={i} x={i * 16} y={430} width="14" height="70" fill={i % 2 === 0 ? '#3d2000' : '#2d1800'} />
      ))}

      {/* Beer mugs on bar */}
      {[120, 240, 560, 680].map(x => (
        <g key={x}>
          <rect x={x} y={310} width="16" height="20" fill="#88ccff" opacity="0.6" rx="1" />
          <rect x={x - 1} y={308} width="18" height="4" fill="#fff" opacity="0.4" />
        </g>
      ))}
    </svg>
  )
}
