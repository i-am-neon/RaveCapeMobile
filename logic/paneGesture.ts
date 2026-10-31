// Pure pane-drag math. Everything here is a worklet so the gesture handlers can call it on
// the UI thread; it is also plain JS and unit-tested.
//
// Progress model: horizontal position x in [-1, 1] (+1 = Halloween pane fully open, from
// the left; -1 = Custom pane fully open, from the right) and vertical y in [0, 1]
// (1 = Live draw pane fully open, from the bottom).

export type Pane = 'center' | 'halloween' | 'custom' | 'draw';
export type Axis = 'none' | 'h' | 'v';

// A drag must move this far (dp) before it activates and picks an axis.
export const ACTIVATE_DISTANCE = 10;
// Velocity (in screens per second) is projected this many seconds ahead when deciding.
export const PROJECTION_SECONDS = 0.2;
// Opening from center: projected position beyond this snaps open.
export const OPEN_THRESHOLD = 0.3;
// Open pane: projected position below this snaps closed (i.e. dragged > 30% closed).
export const STAY_OPEN_THRESHOLD = 0.7;

export function clamp(value: number, lo: number, hi: number): number {
  'worklet';
  return Math.max(lo, Math.min(hi, value));
}

// Lock a gesture to the axis it first moved most along.
export function lockAxis(dx: number, dy: number): Axis {
  'worklet';
  if (Math.max(Math.abs(dx), Math.abs(dy)) < ACTIVATE_DISTANCE) {
    return 'none';
  }
  return Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
}

// Which pane is (mostly) open at the given progress.
export function paneFromProgress(x: number, y: number): Pane {
  'worklet';
  if (y > 0.5) {
    return 'draw';
  }
  if (x > 0.5) {
    return 'halloween';
  }
  if (x < -0.5) {
    return 'custom';
  }
  return 'center';
}

// Horizontal drag: position follows the finger from the position it started at.
export function horizontalPosition(
  startX: number,
  translationX: number,
  width: number,
  lo = -1,
  hi = 1,
): number {
  'worklet';
  return clamp(startX + translationX / width, lo, hi);
}

// Vertical drag (up is negative translation): position follows the finger.
export function verticalPosition(
  startY: number,
  translationY: number,
  height: number,
  lo = 0,
  hi = 1,
): number {
  'worklet';
  return clamp(startY - translationY / height, lo, hi);
}

export interface DecideInput {
  from: Pane; // pane that was open when the gesture started
  axis: Axis;
  x: number; // current horizontal position, -1..1
  y: number; // current vertical position, 0..1
  vx: number; // horizontal velocity, screens/second, positive = rightwards
  vy: number; // vertical velocity, screens/second, positive = downwards
}

// Where to snap when the finger lifts. Only the locked axis' velocity counts, so a
// sloppy flick on the other axis can't open the wrong pane.
export function decidePane({ from, axis, x, y, vx, vy }: DecideInput): Pane {
  'worklet';
  if (from === 'draw') {
    // The draw pane is closed by its back button, never by dragging.
    return 'draw';
  }
  const px = x + (axis === 'h' ? vx * PROJECTION_SECONDS : 0);
  const py = y + (axis === 'v' ? -vy * PROJECTION_SECONDS : 0);

  if (from === 'halloween') {
    return px > STAY_OPEN_THRESHOLD ? 'halloween' : 'center';
  }
  if (from === 'custom') {
    return px < -STAY_OPEN_THRESHOLD ? 'custom' : 'center';
  }
  // from center
  if (axis === 'v') {
    return py > OPEN_THRESHOLD ? 'draw' : 'center';
  }
  if (axis === 'h') {
    if (px > OPEN_THRESHOLD) {
      return 'halloween';
    }
    if (px < -OPEN_THRESHOLD) {
      return 'custom';
    }
  }
  return 'center';
}

// Target progress for each pane once settled.
export function targetProgress(pane: Pane): { x: number; y: number } {
  'worklet';
  if (pane === 'halloween') {
    return { x: 1, y: 0 };
  }
  if (pane === 'custom') {
    return { x: -1, y: 0 };
  }
  if (pane === 'draw') {
    return { x: 0, y: 1 };
  }
  return { x: 0, y: 0 };
}
