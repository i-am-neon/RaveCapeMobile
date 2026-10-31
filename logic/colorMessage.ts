import { ColorAnimation } from '../cape/protocol';
import { normalizeHex } from './strokeColor';

export const COLOR_ANIMATIONS: { name: ColorAnimation; title: string }[] = [
  { name: 'solid', title: 'Solid' },
  { name: 'pulse', title: 'Pulse' },
  { name: 'flow', title: 'Flow' },
  { name: 'emanate', title: 'Emanate' },
];

// Cape message for a color animation: "name:rrggbb,rrggbb". Empty slots are skipped, at
// most 3 colors are used. Returns null if no valid color was chosen.
export function buildColorMessage(name: ColorAnimation, colors: string[]): string | null {
  const hexes = colors
    .map(c => (c ? normalizeHex(c) : null))
    .filter((c): c is string => c !== null)
    .slice(0, 3);
  return hexes.length === 0 ? null : `${name}:${hexes.join(',')}`;
}
