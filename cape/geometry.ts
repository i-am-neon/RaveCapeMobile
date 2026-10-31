// How the cape maps onto the phone screen. The app shows the cape as an abstract,
// full-screen field: each strip is a column and each LED a row, edge to edge, then heavily
// blurred into washes of color. Live-draw touches use the same mapping, so a stroke lands
// on screen where your finger is.

export const STRIPS = 8;
export const LEDS_PER_STRIP = 60;

// Screen rectangle covered by LED l of strip s.
export function ledCell(s: number, l: number, width: number, height: number) {
  const cellWidth = width / STRIPS;
  const cellHeight = height / LEDS_PER_STRIP;
  return { x: s * cellWidth, y: l * cellHeight, width: cellWidth, height: cellHeight };
}

// Inverse of ledCell for touches, measured from cell centers: normalized cape coordinates
// (x 0 = leftmost strip, 1 = rightmost; y 0 = shoulders, 1 = hem), clamped to the cape.
export function touchToCape(px: number, py: number, width: number, height: number) {
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return {
    x: clamp(((px / width) * STRIPS - 0.5) / (STRIPS - 1)),
    y: clamp(((py / height) * LEDS_PER_STRIP - 0.5) / (LEDS_PER_STRIP - 1)),
  };
}
