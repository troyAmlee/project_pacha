const FLAG_COLORS = ["#e63946", "#f4a261", "#06a77d", "#1e3a8a", "#d62828", "#f4a261", "#06a77d", "#e63946"];

export default function PapelPicado() {
  return (
    <div aria-hidden="true" className="papel-picado">
      <svg
        className="papel-picado__svg"
        preserveAspectRatio="none"
        viewBox="0 0 320 36"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line stroke="rgba(26, 26, 26, 0.35)" strokeWidth="0.6" x1="0" x2="320" y1="2" y2="2" />
        {FLAG_COLORS.map((color, index) => {
          const x = index * 40 + 3;
          const notches = Array.from({ length: 6 }, (_, i) => {
            const baseX = x + 2 + i * 5;
            return `L ${baseX + 2.5} 30 L ${baseX + 5} 22`;
          }).join(" ");
          const path = `M ${x} 2 L ${x + 34} 2 L ${x + 34} 22 ${notches} L ${x} 22 Z`;
          return (
            <g key={index}>
              <path d={path} fill={color} opacity="0.88" />
              <circle cx={x + 17} cy={11} fill="#faf3e3" opacity="0.6" r="2.4" />
              <circle cx={x + 9} cy={15} fill="#faf3e3" opacity="0.45" r="1.2" />
              <circle cx={x + 25} cy={15} fill="#faf3e3" opacity="0.45" r="1.2" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
