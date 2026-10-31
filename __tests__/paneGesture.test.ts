import { describe, it, expect } from '@jest/globals';
import {
  decidePane, horizontalPosition, lockAxis, paneFromProgress, targetProgress, verticalPosition,
} from '../logic/paneGesture';

const W = 400;
const H = 800;

describe('lockAxis', () => {
  it('stays unlocked for tiny movement', () => {
    expect(lockAxis(3, 4)).toBe('none');
  });
  it('locks to the dominant axis', () => {
    expect(lockAxis(30, 10)).toBe('h');
    expect(lockAxis(-30, 10)).toBe('h');
    expect(lockAxis(10, -30)).toBe('v');
    expect(lockAxis(20, 20)).toBe('h');
  });
});

describe('positions follow the finger', () => {
  it('horizontal is clamped to the allowed range', () => {
    expect(horizontalPosition(0, 100, W)).toBeCloseTo(0.25);
    expect(horizontalPosition(0, -100, W)).toBeCloseTo(-0.25);
    expect(horizontalPosition(0, 900, W)).toBe(1);
    expect(horizontalPosition(1, -100, W, 0, 1)).toBeCloseTo(0.75);
    expect(horizontalPosition(1, 100, W, 0, 1)).toBe(1); // can't over-open
    expect(horizontalPosition(1, -900, W, 0, 1)).toBe(0); // can't swing into the other pane
    expect(horizontalPosition(-1, 900, W, -1, 0)).toBe(0);
  });
  it('vertical: dragging up opens the draw pane', () => {
    expect(verticalPosition(0, -200, H)).toBeCloseTo(0.25);
    expect(verticalPosition(0, 200, H)).toBe(0);
    expect(verticalPosition(0, -2000, H)).toBe(1);
  });
});

describe('paneFromProgress', () => {
  it('names the mostly-open pane', () => {
    expect(paneFromProgress(0, 0)).toBe('center');
    expect(paneFromProgress(0.8, 0)).toBe('halloween');
    expect(paneFromProgress(-0.8, 0)).toBe('custom');
    expect(paneFromProgress(0, 0.8)).toBe('draw');
    expect(paneFromProgress(0.3, 0.2)).toBe('center');
  });
});

describe('decidePane from center', () => {
  const base = { from: 'center' as const, y: 0, vx: 0, vy: 0 };

  it('opens Halloween on a long right drag, Custom on a long left drag', () => {
    expect(decidePane({ ...base, axis: 'h', x: 0.5 })).toBe('halloween');
    expect(decidePane({ ...base, axis: 'h', x: -0.5 })).toBe('custom');
  });
  it('snaps back on a short slow drag', () => {
    expect(decidePane({ ...base, axis: 'h', x: 0.15 })).toBe('center');
    expect(decidePane({ ...base, axis: 'h', x: -0.15 })).toBe('center');
  });
  it('opens on a quick flick even after a short drag', () => {
    expect(decidePane({ ...base, axis: 'h', x: 0.1, vx: 2 })).toBe('halloween');
    expect(decidePane({ ...base, axis: 'h', x: -0.1, vx: -2 })).toBe('custom');
  });
  it('snaps back when released flicking the other way, even past the threshold', () => {
    expect(decidePane({ ...base, axis: 'h', x: 0.4, vx: -2 })).toBe('center');
    expect(decidePane({ ...base, axis: 'h', x: -0.4, vx: 2 })).toBe('center');
  });
  it('opens draw on a long or fast upward drag', () => {
    expect(decidePane({ ...base, axis: 'v', x: 0, y: 0.5 })).toBe('draw');
    expect(decidePane({ ...base, axis: 'v', x: 0, y: 0.1, vy: -2 })).toBe('draw');
    expect(decidePane({ ...base, axis: 'v', x: 0, y: 0.15 })).toBe('center');
    expect(decidePane({ ...base, axis: 'v', x: 0, y: 0.4, vy: 2 })).toBe('center');
  });
  it('ignores velocity on the axis that is not locked', () => {
    expect(decidePane({ ...base, axis: 'v', x: 0, y: 0.05, vx: 5 })).toBe('center');
    expect(decidePane({ ...base, axis: 'h', x: 0.05, vy: -5 })).toBe('center');
  });
  it('does nothing without a locked axis', () => {
    expect(decidePane({ ...base, axis: 'none', x: 0, y: 0 })).toBe('center');
  });
});

describe('decidePane from an open pane', () => {
  it('Halloween stays open on a small drag, closes on a big or fast one', () => {
    const base = { from: 'halloween' as const, axis: 'h' as const, y: 0, vy: 0 };
    expect(decidePane({ ...base, x: 0.85, vx: 0 })).toBe('halloween');
    expect(decidePane({ ...base, x: 0.5, vx: 0 })).toBe('center');
    expect(decidePane({ ...base, x: 0.95, vx: -3 })).toBe('center');
    expect(decidePane({ ...base, x: 0.6, vx: 2 })).toBe('halloween');
  });
  it('Custom mirrors it', () => {
    const base = { from: 'custom' as const, axis: 'h' as const, y: 0, vy: 0 };
    expect(decidePane({ ...base, x: -0.85, vx: 0 })).toBe('custom');
    expect(decidePane({ ...base, x: -0.5, vx: 0 })).toBe('center');
    expect(decidePane({ ...base, x: -0.95, vx: 3 })).toBe('center');
  });
  it('draw never closes by dragging', () => {
    expect(decidePane({ from: 'draw', axis: 'v', x: 0, y: 0.2, vx: 0, vy: 5 })).toBe('draw');
  });
});

describe('targetProgress', () => {
  it('maps panes to rest positions', () => {
    expect(targetProgress('center')).toEqual({ x: 0, y: 0 });
    expect(targetProgress('halloween')).toEqual({ x: 1, y: 0 });
    expect(targetProgress('custom')).toEqual({ x: -1, y: 0 });
    expect(targetProgress('draw')).toEqual({ x: 0, y: 1 });
  });
});
