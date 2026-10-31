// Shared contract between the BLE layer, the cape renderer and the panes.
// Mirrors the firmware's text protocol (rave-cape-controller/src/main.cpp).

export const SPOOKY_IDS = [
  'bonfire', 'ghostfire', 'witchfire', 'inferno', 'heartbeat', 'ghost', 'drip', 'ecto',
  'cauldron', 'banshee', 'glitch', 'reaper', 'rain', 'pumpkin', 'candycorn', 'aurora',
] as const;
export type SpookyId = (typeof SPOOKY_IDS)[number];

export type ColorAnimation = 'solid' | 'pulse' | 'flow' | 'emanate';

// What the cape is currently playing. Colors are 6-digit hex without '#', e.g. 'ff5000'.
export type CapeAnimation =
  | { kind: 'spooky'; id: SpookyId }
  | { kind: 'rainbow_flow' }
  | { kind: ColorAnimation; colors: string[] }
  | { kind: 'draw' }
  | { kind: 'unknown' };

// Shuffle: sending SHUFFLE makes the cape pick a new preset every minute by itself. Each
// pick is notified to the phone (and stored for reconnecting phones) as SHUFFLE_PREFIX + the
// preset's message, e.g. "shuffle>bonfire".
export const SHUFFLE = 'shuffle';
export const SHUFFLE_PREFIX = 'shuffle>';

// Returns the animation a message starts, or null for messages that don't change the
// animation (brightness, live-draw points, the shuffle command itself).
export function parseCapeMessage(message: string): CapeAnimation | null {
  if (message.startsWith(SHUFFLE_PREFIX)) {
    return parseCapeMessage(message.slice(SHUFFLE_PREFIX.length));
  }
  if (
    message.startsWith('brightness:') ||
    message.startsWith('p:') ||
    message.startsWith('u:') ||
    message === SHUFFLE
  ) {
    return null;
  }
  if ((SPOOKY_IDS as readonly string[]).includes(message)) {
    return { kind: 'spooky', id: message as SpookyId };
  }
  if (message === 'rainbow_flow') {
    return { kind: 'rainbow_flow' };
  }
  if (message === 'draw') {
    return { kind: 'draw' };
  }
  const [name, colorList] = message.split(':');
  if ((name === 'solid' || name === 'pulse' || name === 'flow' || name === 'emanate') && colorList) {
    return { kind: name, colors: colorList.split(',').map(c => c.toLowerCase()) };
  }
  return { kind: 'unknown' };
}

export function toCapeMessage(animation: CapeAnimation): string | null {
  switch (animation.kind) {
    case 'spooky':
      return animation.id;
    case 'rainbow_flow':
    case 'draw':
      return animation.kind;
    case 'solid':
    case 'pulse':
    case 'flow':
    case 'emanate':
      return `${animation.kind}:${animation.colors.join(',')}`;
    default:
      return null;
  }
}

// ---- Live draw ----
// Positions are normalized: x 0 = leftmost strip, 1 = rightmost; y 0 = shoulders, 1 = hem.
export interface DrawPoint {
  finger: number; // 0-3
  x: number;
  y: number;
  color: string; // 6-digit hex without '#'
}

// Firmware message for one or more points: "p:<finger>,<x 0-1000>,<y 0-1000>,<rrggbb>;..."
// Consecutive points from the same finger are joined into a stroke on the cape.
export function toPointsMessage(points: DrawPoint[]): string {
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 1000);
  return 'p:' + points.map(p => `${p.finger},${clamp(p.x)},${clamp(p.y)},${p.color}`).join(';');
}

// Firmware message when a finger lifts, so its next touch starts a new stroke.
export function toFingerUpMessage(finger: number): string {
  return `u:${finger}`;
}

// In-app event bus so the on-screen cape mirrors live drawing without waiting on BLE.
type DrawEvent = { type: 'point'; point: DrawPoint } | { type: 'up'; finger: number };
const drawListeners = new Set<(event: DrawEvent) => void>();

export function emitDraw(event: DrawEvent) {
  drawListeners.forEach(listener => listener(event));
}

export function subscribeDraw(listener: (event: DrawEvent) => void): () => void {
  drawListeners.add(listener);
  return () => {
    drawListeners.delete(listener);
  };
}

// Trail length for live draw: each frame (50 fps) multiplies the frame by this, so a
// stroke fades to ~5% in about a second. The firmware uses the same constant.
export const DRAW_FADE_PER_FRAME = 0.942;

// Brush, identical in the firmware: a point at (x, y) maps to strip sx = x * 7 and LED
// ly = y * 59. Every LED with d2 = ((s - sx) * 4)^2 + (l - ly)^2 < 25 gets
// color * exp(-d2 / 4) added. Consecutive points of one finger are joined by stamping
// the brush every 0.5 units along the segment (same distance metric).
export const BRUSH_STRIP_SCALE = 4;
export const BRUSH_RADIUS_SQUARED = 25;
export const BRUSH_FALLOFF = 4;
export const BRUSH_STAMP_SPACING = 0.5;
