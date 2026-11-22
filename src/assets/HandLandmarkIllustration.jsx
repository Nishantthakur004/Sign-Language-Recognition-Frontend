export default function HandLandmarkIllustration({ className = '' }) {
  const points = [
    [160, 270], [119, 231], [88, 187], [67, 137], [61, 91],
    [105, 191], [100, 126], [102, 62], [110, 25],
    [137, 184], [145, 109], [158, 42], [170, 13],
    [165, 190], [186, 124], [207, 70], [220, 48],
    [191, 209], [218, 163], [243, 126], [255, 111],
  ];
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
  ];
  return (
    <svg viewBox="0 0 320 310" className={className} fill="none" role="img" aria-label="Illustration of twenty-one tracked hand landmarks">
      <defs>
        <linearGradient id="hand-line" x1="50" y1="30" x2="250" y2="270" gradientUnits="userSpaceOnUse">
          <stop stopColor="#DDD6FE" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <filter id="hand-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d="M31 254C87 302 211 310 284 242" stroke="white" strokeOpacity=".08" strokeWidth="34" strokeLinecap="round" />
      {connections.map(([from, to]) => (
        <line key={`${from}-${to}`} x1={points[from][0]} y1={points[from][1]} x2={points[to][0]} y2={points[to][1]} stroke="url(#hand-line)" strokeWidth="4" strokeLinecap="round" />
      ))}
      {points.map(([x, y], index) => (                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 
        <g key={index} filter="url(#hand-glow)">
          <circle cx={x} cy={y} r={index === 0 ? 8 : 5.5} fill={index % 4 === 0 ? '#F5F3FF' : '#C4B5FD'} />
          <circle cx={x} cy={y} r="2" fill="#6D28D9" />
        </g>
      ))}
      <circle cx="160" cy="155" r="137" stroke="white" strokeOpacity=".08" strokeDasharray="4 10" />
    </svg>
  );
}
