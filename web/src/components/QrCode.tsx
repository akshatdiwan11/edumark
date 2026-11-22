import { useMemo } from "react";
import QRCode from "qrcode";

/**
 * Renders a QR code as crisp SVG using the app's own colours, so it themes
 * with the page. Finder patterns are drawn as rounded squares.
 */
export function QrCode({ value, size = 280, className }: { value: string; size?: number; className?: string }) {
  const { cells, count } = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    return { cells: qr.modules.data, count: qr.modules.size };
  }, [value]);

  const quiet = 2;
  const total = count + quiet * 2;
  const inFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= count - 7 && y < 7) || (x < 7 && y >= count - 7);

  const dots: string[] = [];
  for (let y = 0; y < count; y++) {
    for (let x = 0; x < count; x++) {
      if (!cells[y * count + x] || inFinder(x, y)) continue;
      dots.push(`M${x + quiet + 0.1},${y + quiet + 0.1}h0.8v0.8h-0.8z`);
    }
  }

  const finder = (fx: number, fy: number) => (
    <g key={`${fx}-${fy}`} transform={`translate(${fx + quiet} ${fy + quiet})`}>
      <rect x={0.5} y={0.5} width={6} height={6} rx={1.8} fill="none" stroke="currentColor" strokeWidth={1} />
      <rect x={2} y={2} width={3} height={3} rx={0.9} fill="currentColor" />
    </g>
  );

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${total} ${total}`}
      role="img"
      aria-label="Attendance QR code"
      shapeRendering="geometricPrecision"
    >
      <rect width={total} height={total} rx={2} fill="#fffdf8" />
      <g color="#1c1f33">
        <path d={dots.join("")} fill="currentColor" />
        {finder(0, 0)}
        {finder(count - 7, 0)}
        {finder(0, count - 7)}
      </g>
    </svg>
  );
}
