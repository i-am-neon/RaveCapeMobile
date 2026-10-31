/* eslint-disable no-bitwise */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import cppStats from './fixtures/cpp_stats.json';
import {
  Frame,
  LED_COUNT,
  L,
  S,
  MAX_CHANNEL_SUM_PER_STRIP,
  TICK,
  applyDrawEvent,
  createAnimator,
  output,
  outputInto,
  setRandomSource,
  stampBrush,
  stampSegment,
} from '../cape/model';
import type { BrushPoint } from '../cape/model';
import {
  BRUSH_FALLOFF,
  DRAW_FADE_PER_FRAME,
  SPOOKY_IDS,
  emitDraw,
} from '../cape/protocol';
import type { CapeAnimation } from '../cape/protocol';

// Deterministic PRNG (mulberry32) so statistical tests are repeatable.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

beforeEach(() => setRandomSource(seeded(12345)));
afterEach(() => setRandomSource(null));

const TICKS = 1500;

// Same statistics as the C++ host test: averaged over 1500 ticks at brightness 255, after the cap.
function stats(animation: CapeAnimation, ticks = TICKS, brightness = 255) {
  const animator = createAnimator(animation, () => brightness);
  const out = new Uint8Array(LED_COUNT * 3);
  let load = 0;
  let lit = 0;
  let maxStripSum = 0;
  for (let tick = 0; tick < ticks; tick++) {
    animator.step(tick * TICK);
    const o = outputInto(animator.frame, brightness, out);
    load += o.load;
    let litCount = 0;
    for (let s = 0; s < S; s++) {
      let stripSum = 0;
      for (let l = 0; l < L; l++) {
        const i = (s * L + l) * 3;
        const sum = out[i] + out[i + 1] + out[i + 2];
        stripSum += sum;
        if (sum > 8) {
          litCount++;
        }
      }
      maxStripSum = Math.max(maxStripSum, stripSum);
    }
    lit += litCount / LED_COUNT;
  }
  animator.dispose();
  return { load: load / ticks, lit: lit / ticks, maxStripSum };
}

describe('parity with the C++ firmware', () => {
  const reference = cppStats as Record<string, { load: number; lit: number }>;
  const tol = (v: number) => Math.max(0.05, 0.15 * v);

  it('covers all 16 spooky ids', () => {
    expect(Object.keys(reference).sort()).toEqual([...SPOOKY_IDS].sort());
  });

  it.each([...SPOOKY_IDS])('%s matches load and lit', id => {
    const mine = stats({ kind: 'spooky', id });
    const cpp = reference[id];
    expect(Math.abs(mine.load - cpp.load)).toBeLessThanOrEqual(tol(cpp.load));
    expect(Math.abs(mine.lit - cpp.lit)).toBeLessThanOrEqual(tol(cpp.lit));
  });
});

describe('output stage', () => {
  it('rainbow flow defines the power budget (load ~ 1.0)', () => {
    const r = stats({ kind: 'rainbow_flow' }, 300);
    expect(r.load).toBeGreaterThan(0.97);
    expect(r.load).toBeLessThanOrEqual(1);
  });

  const animations: CapeAnimation[] = [
    ...SPOOKY_IDS.map(id => ({ kind: 'spooky' as const, id })),
    { kind: 'rainbow_flow' },
    { kind: 'solid', colors: ['ffffff'] },
    { kind: 'solid', colors: ['ffffff', 'ffffff', 'ffffff'] },
    { kind: 'pulse', colors: ['ffffff'] },
    { kind: 'flow', colors: ['ffffff', 'ff00ff'] },
    { kind: 'emanate', colors: ['ffffff', 'ffff00', '00ffff'] },
    { kind: 'unknown' },
  ];

  it.each(animations.map(a => [JSON.stringify(a), a] as const))(
    'never exceeds the per-strip cap: %s',
    (_name, animation) => {
      const r = stats(animation, 400);
      expect(r.maxStripSum).toBeLessThanOrEqual(MAX_CHANNEL_SUM_PER_STRIP);
    },
  );

  it('white solid is scaled down to the cap, not clipped to black', () => {
    const f = new Frame();
    f.fill([255, 255, 255]);
    const o = output(f, 255);
    expect(o.rawPeak).toBeCloseTo(3, 5);
    expect(o.load).toBeGreaterThan(0.98); // integer scaling rounds down slightly
    expect(o.load).toBeLessThanOrEqual(1);
    expect(o.out[0]).toBeGreaterThan(70);
  });

  it('brightness 0 is all black', () => {
    for (const a of animations) {
      const animator = createAnimator(a);
      for (let tick = 0; tick < 30; tick++) {
        animator.step(tick * TICK);
      }
      const o = output(animator.frame, 0);
      expect(o.out.every(v => v === 0)).toBe(true);
      expect(o.load).toBe(0);
      animator.dispose();
    }
  });

  it('brightness scales linearly like the emulator (floor(v * b / 255))', () => {
    const f = new Frame();
    f.set(0, 0, [200, 100, 50]);
    const o = output(f, 128);
    expect(Array.from(o.out.slice(0, 3))).toEqual([100, 50, 25]);
  });
});

describe('classic animations', () => {
  const px = (a: ReturnType<typeof createAnimator>, s: number, l: number) =>
    a.frame.get(s, l);

  it('solid with one color fills the cape', () => {
    const a = createAnimator({ kind: 'solid', colors: ['ff8000'] });
    a.step(0);
    expect(px(a, 0, 0)).toEqual([255, 128, 0]);
    expect(px(a, 7, 59)).toEqual([255, 128, 0]);
  });

  it('solid with two colors blends top to bottom (ColorUtils truncation)', () => {
    const a = createAnimator({ kind: 'solid', colors: ['ff0000', '0000ff'] });
    a.step(0);
    expect(px(a, 3, 0)).toEqual([255, 0, 0]);
    expect(px(a, 3, 59)).toEqual([0, 0, 255]);
  });

  it('pulse breathes between 20% and 100%, one step per 50 ms of time', () => {
    const a = createAnimator({ kind: 'pulse', colors: ['ff0000'] });
    const reds: number[] = [];
    for (let tick = 0; tick < 100; tick++) {
      a.step(tick * TICK);
      reds.push(px(a, 0, 0)[0]);
    }
    expect(reds[0]).toBe(Math.floor(255 * 0.2));
    expect(Math.max(...reds)).toBe(255);
    expect(Math.min(...reds)).toBe(Math.floor(255 * 0.2));
    // 2 s = 40 updates; one full up/down cycle is 32 updates (0.2 -> 1.0 -> 0.2 in 0.05 steps)
    const peakTick = reds.indexOf(255);
    expect(peakTick * TICK).toBeGreaterThan(0.7);
    expect(peakTick * TICK).toBeLessThan(0.9);
  });

  it('flow moves one LED per 50 ms', () => {
    const a = createAnimator({ kind: 'flow', colors: ['ff0000', '0000ff'] });
    a.step(0);
    const before = px(a, 0, 10);
    for (let tick = 1; tick <= 50; tick++) {
      a.step(tick * TICK); // 1 s -> 20 updates after the first
    }
    // after 21 updates the pattern has shifted by 20 LEDs: LED 30 now holds what LED 10 held
    expect(px(a, 0, 30)).toEqual(before);
  });

  it('flow with a single color renders nothing (firmware needs >= 2)', () => {
    const a = createAnimator({ kind: 'flow', colors: ['ff0000'] });
    a.step(0);
    expect(px(a, 0, 0)).toEqual([0, 0, 0]);
  });

  it('emanate is symmetric about the middle of the strip', () => {
    const a = createAnimator({
      kind: 'emanate',
      colors: ['ff0000', '00ff00', '0000ff'],
    });
    for (let tick = 0; tick < 40; tick++) {
      a.step(tick * TICK);
    }
    for (let d = 1; d < 30; d++) {
      expect(px(a, 2, 30 - d)).toEqual(px(a, 2, 30 + d));
    }
  });

  it('unknown renders something dim but not black', () => {
    const a = createAnimator({ kind: 'unknown' });
    a.step(1);
    const o = output(a.frame, 255);
    expect(o.load).toBeGreaterThan(0.02);
    expect(o.load).toBeLessThan(0.3);
  });
});

describe('brush', () => {
  const brightnessOf = (f: Frame, s: number, l: number) => f.get(s, l);

  it('a single point lights the documented LEDs with exp(-d2/4) falloff', () => {
    const f = new Frame();
    // x = 3/7 -> strip 3 exactly, y = 30/59 -> LED 30 exactly
    stampBrush(f, 3 / 7, 30 / 59, [100, 50, 0]);
    expect(brightnessOf(f, 3, 30)[0]).toBeCloseTo(100, 6);
    expect(brightnessOf(f, 3, 30)[1]).toBeCloseTo(50, 6);
    // one LED along the strip: d2 = 1
    expect(brightnessOf(f, 3, 31)[0]).toBeCloseTo(
      100 * Math.exp(-1 / BRUSH_FALLOFF),
      6,
    );
    expect(brightnessOf(f, 3, 29)[0]).toBeCloseTo(
      100 * Math.exp(-1 / BRUSH_FALLOFF),
      6,
    );
    // one strip over: d2 = 16
    expect(brightnessOf(f, 4, 30)[0]).toBeCloseTo(
      100 * Math.exp(-16 / BRUSH_FALLOFF),
      6,
    );
    // d2 = 16 + 1 = 17 still inside; 16 + 9 = 25 is NOT (strict <)
    expect(brightnessOf(f, 4, 31)[0]).toBeCloseTo(
      100 * Math.exp(-17 / BRUSH_FALLOFF),
      6,
    );
    expect(brightnessOf(f, 4, 33)[0]).toBe(0);
    // along the strip: d = 4 -> d2 = 16 inside, d = 5 -> d2 = 25 outside
    expect(brightnessOf(f, 3, 34)[0]).toBeGreaterThan(0);
    expect(brightnessOf(f, 3, 35)[0]).toBe(0);
    // two strips over is d2 >= 64: outside
    expect(brightnessOf(f, 5, 30)[0]).toBe(0);
    expect(brightnessOf(f, 3, 30)[2]).toBe(0);
  });

  it('matches a brute-force evaluation of the documented formula', () => {
    const f = new Frame();
    const x = 0.37;
    const y = 0.61;
    stampBrush(f, x, y, [90, 90, 90]);
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const d2 = ((s - x * 7) * 4) ** 2 + (l - y * 59) ** 2;
        const expected = d2 < 25 ? 90 * Math.exp(-d2 / 4) : 0;
        expect(f.get(s, l)[0]).toBeCloseTo(expected, 6);
      }
    }
  });

  it('clips at the edges of the cape without throwing', () => {
    const f = new Frame();
    stampBrush(f, 0, 0, [255, 255, 255]);
    stampBrush(f, 1, 1, [255, 255, 255]);
    expect(f.get(0, 0)[0]).toBe(255);
    expect(f.get(7, 59)[0]).toBe(255);
  });

  it('a two-point segment stamps the LEDs in between', () => {
    const single = new Frame();
    stampBrush(single, 3 / 7, 10 / 59, [60, 60, 60]);
    stampBrush(single, 3 / 7, 40 / 59, [60, 60, 60]);
    expect(single.get(3, 25)[0]).toBe(0); // far from both ends: nothing

    const f = new Frame();
    const a: BrushPoint = { x: 3 / 7, y: 10 / 59 };
    const b: BrushPoint = { x: 3 / 7, y: 40 / 59 };
    stampSegment(f, a, b, [60, 60, 60]);
    for (let l = 11; l <= 40; l++) {
      expect(f.get(3, l)[0]).toBeGreaterThan(0);
    }
    // `from` is not re-stamped (that is the previous point's job)...
    expect(f.get(3, 4)[0]).toBe(0);
    // ...and a diagonal segment passes through its midpoint
    const g = new Frame();
    stampSegment(
      g,
      { x: 2 / 7, y: 20 / 59 },
      { x: 4 / 7, y: 40 / 59 },
      [60, 60, 60],
    );
    expect(g.get(3, 30)[0]).toBeGreaterThan(0);
  });

  it('stamps every 0.5 units: a 1 unit segment is two stamps, zero length is none', () => {
    const f = new Frame();
    stampSegment(
      f,
      { x: 3 / 7, y: 10 / 59 },
      { x: 3 / 7, y: 11 / 59 },
      [10, 0, 0],
    );
    // two stamps (at +0.5 and +1.0) -> LED 11 holds the second stamp at full strength plus the first at d2=0.25
    expect(f.get(3, 11)[0]).toBeGreaterThan(10);
    const g = new Frame();
    stampSegment(
      g,
      { x: 3 / 7, y: 0.5 },
      { x: 3 / 7, y: 0.5 },
      [255, 255, 255],
    );
    expect(g.data.every(v => v === 0)).toBe(true);
  });

  it('strokes of different fingers are independent, and up ends a stroke', () => {
    const f = new Frame();
    const last = new Map<number, BrushPoint>();
    const pt = (finger: number, x: number, y: number) =>
      ({ type: 'point', point: { finger, x, y, color: 'ff0000' } } as const);
    applyDrawEvent(f, last, pt(0, 0, 0.1));
    applyDrawEvent(f, last, pt(1, 1, 0.1));
    applyDrawEvent(f, last, pt(0, 0, 0.6)); // finger 0 joins down the left edge
    expect(f.get(0, 30)[0]).toBeGreaterThan(0);
    expect(f.get(3, 30)[0]).toBe(0); // finger 1 did not draw a line to finger 0
    applyDrawEvent(f, last, { type: 'up', finger: 0 });
    const g = new Frame();
    const last2 = new Map<number, BrushPoint>();
    applyDrawEvent(g, last2, pt(0, 0, 0.1));
    applyDrawEvent(g, last2, { type: 'up', finger: 0 });
    applyDrawEvent(g, last2, pt(0, 0, 0.9)); // new stroke: no line joining 0.1 -> 0.9
    expect(g.get(0, 30)[0]).toBe(0);
    expect(g.get(0, 53)[0]).toBeGreaterThan(0);
  });

  it('the draw animator subscribes to emitDraw, fades per tick and unsubscribes on dispose', () => {
    const a = createAnimator({ kind: 'draw' });
    emitDraw({
      type: 'point',
      point: { finger: 0, x: 3 / 7, y: 30 / 59, color: 'ff0000' },
    });
    a.step(0);
    expect(a.frame.get(3, 30)[0]).toBeCloseTo(255, 6);
    a.step(TICK);
    expect(a.frame.get(3, 30)[0]).toBeCloseTo(255 * DRAW_FADE_PER_FRAME, 4);
    a.dispose();
    emitDraw({
      type: 'point',
      point: { finger: 0, x: 0.9, y: 0.9, color: 'ff0000' },
    });
    a.step(2 * TICK);
    expect(a.frame.get(6, 53)[0]).toBe(0);
  });

  it('fade drops a stroke below 5% in ~50 ticks', () => {
    const a = createAnimator({ kind: 'draw' });
    emitDraw({
      type: 'point',
      point: { finger: 0, x: 0.5, y: 0.5, color: 'ffffff' },
    });
    a.step(0);
    const peak = a.frame.get(3, 30)[0];
    let ticks = 0;
    while (a.frame.get(3, 30)[0] > peak * 0.05) {
      a.step(++ticks * TICK);
    }
    expect(ticks).toBeGreaterThanOrEqual(48);
    expect(ticks).toBeLessThanOrEqual(53);
    a.dispose();
  });
});
