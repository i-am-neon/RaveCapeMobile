// Live-draw stroke colors: cycle smoothly through the chosen colors by distance traveled.

export type Rgb = [number, number, number];

// '#FF8800', 'ff8800', '#ff8800cc' -> 'ff8800'. Returns null if it isn't a 6/8 digit hex.
export function normalizeHex(input: string): string | null {
  const clean = input.trim().replace(/^#/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean)) {
    return null;
  }
  if (clean.length === 6) {
    return clean;
  }
  if (clean.length === 8) {
    return clean.slice(0, 6);
  }
  return null;
}

export function hexToRgb(hex: string): Rgb {
  const clean = normalizeHex(hex) ?? '000000';
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const part = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return part(r) + part(g) + part(b);
}

// Color at `distance` along a stroke. One full trip through all colors (and back to the
// first) takes `cycleLength` of distance; blending is linear in RGB between neighbours.
// A single color is constant.
export function colorAtDistance(colors: string[], distance: number, cycleLength: number): string {
  const valid = colors.map(normalizeHex).filter((c): c is string => c !== null);
  if (valid.length === 0) {
    return 'ffffff';
  }
  if (valid.length === 1 || !(cycleLength > 0) || !Number.isFinite(distance)) {
    return valid[0];
  }
  const cycles = distance / cycleLength;
  const t = cycles - Math.floor(cycles); // 0..1
  const scaled = t * valid.length;
  const index = Math.floor(scaled) % valid.length;
  const frac = scaled - Math.floor(scaled);
  const from = hexToRgb(valid[index]);
  const to = hexToRgb(valid[(index + 1) % valid.length]);
  return rgbToHex([
    from[0] + (to[0] - from[0]) * frac,
    from[1] + (to[1] - from[1]) * frac,
    from[2] + (to[2] - from[2]) * frac,
  ]);
}

// Tracks how far one finger has traveled in its current stroke (pixels).
export interface StrokeState {
  lastX: number;
  lastY: number;
  distance: number;
}

export function startStroke(x: number, y: number): StrokeState {
  return { lastX: x, lastY: y, distance: 0 };
}

export function advanceStroke(stroke: StrokeState, x: number, y: number): StrokeState {
  const step = Math.hypot(x - stroke.lastX, y - stroke.lastY);
  return { lastX: x, lastY: y, distance: stroke.distance + step };
}
