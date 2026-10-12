// Retro icons drawn from character grids: each character is one pixel.
const ICONS = {
  lock: [
    "..#####..",
    ".#.....#.",
    ".#.....#.",
    "#########",
    "#########",
    "####.####",
    "####.####",
    "#########",
    "#########",
  ],
  camera: [
    "...####....",
    "###########",
    "####...####",
    "###.....###",
    "###.....###",
    "####...####",
    "###########",
  ],
  arrow: [
    "...#...",
    "..###..",
    ".#####.",
    "#######",
    "..###..",
    "..###..",
    "..###..",
  ],
  sparkle: [
    "...#...",
    "...#...",
    "..###..",
    "#######",
    "..###..",
    "...#...",
    "...#...",
  ],
  trash: [
    "...###...",
    "#########",
    ".........",
    ".#######.",
    ".#.#.#.#.",
    ".#.#.#.#.",
    ".#.#.#.#.",
    ".#.#.#.#.",
    ".#######.",
  ],
  plus: [
    "..###..",
    "..###..",
    "#######",
    "#######",
    "#######",
    "..###..",
    "..###..",
  ],
  refresh: [
    ".#####...",
    "#.....#..",
    "#.....#..",
    "#...#####",
    "#....###.",
    "#.....#..",
    "#........",
    ".#####...",
  ],
  exit: [
    "#####.....",
    "#.....#...",
    "#......#..",
    "#...######",
    "#......#..",
    "#.....#...",
    "#####.....",
  ],
  bubble: [
    ".#######.",
    "#########",
    "#########",
    "#########",
    "#########",
    ".#######.",
    "..##.....",
    "..#......",
  ],
  trophy: [
    ".#######.",
    "#.#####.#",
    "#.#####.#",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
    "...###...",
    "..#####..",
  ],
  person: [
    "..###..",
    "..###..",
    "..###..",
    ".......",
    ".#####.",
    "#######",
    "#######",
    "#######",
  ],
  sun: [
    ".......oo.......",
    ".......oo.......",
    "..oo........oo..",
    "..oo..yyyy..oo..",
    ".....yyyyyy.....",
    "....yyyyyyyy....",
    "...yyyyyyyyyy...",
    "oo.yykyyyykyy.oo",
    "oo.yykyyyykyy.oo",
    "...yyyyyyyyyy...",
    "....ykyyyyky....",
    ".....ykkkky.....",
    "..oo..yyyy..oo..",
    "..oo........oo..",
    ".......oo.......",
    ".......oo.......",
  ],
  moon: [
    "................",
    ".....mmmmmm.....",
    "...mmmmmmmmmm...",
    "..mmmmmmmmccmm..",
    "..mmmmmmmmccmm..",
    ".mmmkmmmmkmmmmm.",
    ".mmmkmmmmkmmmmm.",
    ".mmmmmmmmmmmmmm.",
    ".mmmmmmmmmmmmmm.",
    ".mmkmmmmmmkmmmm.",
    "..mmkkkkkkmmcm..",
    "..mmmmmmmmmmmm..",
    "...mmcmmmmmmm...",
    ".....mmmmmm.....",
    "................",
    "................",
  ],
} as const;

// "#" takes the surrounding text colour; the rest are fixed character colours.
const FILLS: Record<string, string> = {
  "#": "currentColor",
  y: "#ffcf33",
  o: "#ff9f43",
  m: "#f4efe1",
  c: "#c9c2a8",
  k: "#1f2440",
};

export type PixelIconName = keyof typeof ICONS;

export function PixelIcon({
  name,
  size = 16,
  className,
}: {
  name: PixelIconName;
  size?: number; // rendered height in px
  className?: string;
}) {
  const rows = ICONS[name];
  const width = rows[0].length;
  const height = rows.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={(size * width) / height}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden
      className={`pixel-icon ${className ?? ""}`}
    >
      {rows.flatMap((row, y) =>
        [...row].map((pixel, x) =>
          FILLS[pixel] ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={FILLS[pixel]} />
          ) : null,
        ),
      )}
    </svg>
  );
}

// The sun by day and the moon by night, following the device's colour mode.
export function SunOrMoon({ size }: { size: number }) {
  return (
    <>
      <PixelIcon name="sun" size={size} className="dark:hidden" />
      <PixelIcon name="moon" size={size} className="hidden dark:block" />
    </>
  );
}
