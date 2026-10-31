// Pure cape model: frame buffer, the 16 spooky designs, the classic animations, the live
// draw brush and the firmware output stage (brightness + per-strip power cap).
//
// No React / Skia / Reanimated imports on purpose, so it is trivially unit-testable and the
// renderer (CapeView.tsx) is just a thin consumer. Designs are ports of the DESIGNS array in
// rave-cape-controller/tools/emulator/index.html (verified against the C++ firmware);
// Solid/Pulse/Flow/Emanate are ported from src/led/*.cpp.

/* eslint-disable no-bitwise */
import {
  BRUSH_FALLOFF,
  BRUSH_RADIUS_SQUARED,
  BRUSH_STAMP_SPACING,
  BRUSH_STRIP_SCALE,
  DRAW_FADE_PER_FRAME,
  subscribeDraw,
} from './protocol';
import type { CapeAnimation, DrawPoint, SpookyId } from './protocol';
import { LEDS_PER_STRIP, STRIPS } from './geometry';

export const S = STRIPS;
export const L = LEDS_PER_STRIP;
export const LED_COUNT = S * L;
export const MAX_CHANNEL_SUM_PER_STRIP = L * 255; // same as firmware LedStrip.h
export const TICK = 1 / 50; // the whole model simulates at 50 fps

export type RGB = [number, number, number];

// ---- Randomness (swappable so tests are deterministic) ----
let random: () => number = Math.random;
export function setRandomSource(source: (() => number) | null) {
  random = source ?? Math.random;
}
const rand = (n: number) => Math.floor(random() * n);
const rnd = (a: number, b: number) => a + random() * (b - a);

// ---- Color helpers (same names/semantics as the emulator) ----
const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
export const hex = (h: number): RGB => [
  (h >> 16) & 255,
  (h >> 8) & 255,
  h & 255,
];
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
export const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
export function hsv(h: number, s: number, v: number): RGB {
  // h 0-360, s/v 0-1
  h = (((h % 360) + 360) % 360) / 60;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  let r: number, g: number, b: number;
  switch (i) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    default:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [r * 255, g * 255, b * 255];
}
// Firmware interpolateGradient (Frame.cpp gradientColor): wraps back to the first color.
export function gradient(colors: RGB[], pos: number): RGB {
  const ext = [...colors, colors[0]];
  pos = ((pos % 1) + 1) % 1;
  const seg = 1 / (ext.length - 1);
  const i = Math.floor(pos / seg);
  return mix(ext[i], ext[i + 1], (pos - i * seg) / seg);
}
export function palette(stops: Array<[number, RGB]>, x: number): RGB {
  x = Math.max(0, Math.min(1, x));
  for (let i = 1; i < stops.length; i++) {
    if (x <= stops[i][0]) {
      return mix(
        stops[i - 1][1],
        stops[i][1],
        (x - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]),
      );
    }
  }
  return stops[stops.length - 1][1];
}

// ---- Frame buffer: 8 strips x 60 LEDs of RGB floats (0-255). l = 0 is the top (shoulders). ----
export class Frame {
  readonly data = new Float64Array(LED_COUNT * 3);

  set(s: number, l: number, c: RGB) {
    if (s >= 0 && s < S && l >= 0 && l < L) {
      const i = (s * L + l) * 3;
      this.data[i] = clamp(c[0]);
      this.data[i + 1] = clamp(c[1]);
      this.data[i + 2] = clamp(c[2]);
    }
  }
  add(s: number, l: number, c: RGB) {
    if (s >= 0 && s < S && l >= 0 && l < L) {
      const i = (s * L + l) * 3;
      const d = this.data;
      d[i] = clamp(d[i] + c[0]);
      d[i + 1] = clamp(d[i + 1] + c[1]);
      d[i + 2] = clamp(d[i + 2] + c[2]);
    }
  }
  get(s: number, l: number): RGB {
    const i = (s * L + l) * 3;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  fill(c: RGB) {
    const r = clamp(c[0]);
    const g = clamp(c[1]);
    const b = clamp(c[2]);
    const d = this.data;
    for (let i = 0; i < d.length; i += 3) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
  fade(k: number) {
    const d = this.data;
    for (let i = 0; i < d.length; i++) {
      const v = d[i] * k;
      d[i] = v < 0.01 ? 0 : v; // flush the invisible tail so values never go denormal
    }
  }
  clear() {
    this.data.fill(0);
  }
}

// ---- Output stage: brightness, then the firmware's per-strip power cap ----
export interface OutputStats {
  /** Average channel-sum / (strips * cap) after the cap. */
  load: number;
  /** Worst strip's channel-sum / cap before the cap (> 1 means it was capped). */
  rawPeak: number;
}

/**
 * Exactly the emulator's output(): floor(v * brightness / 255) per channel, then if a strip's
 * channel-sum exceeds 60*255 scale it by floor(cap*256/sum)/256 (integer, like the firmware).
 * Writes 8-bit RGB into `out` (length 8*60*3, strip-major) and returns load statistics.
 */
export function outputInto(
  frame: Frame,
  brightness: number,
  out: Uint8Array,
): OutputStats {
  const b = brightness < 0 ? 0 : brightness > 255 ? 255 : brightness;
  const src = frame.data;
  const perStrip = L * 3;
  let worst = 0;
  let total = 0;
  for (let s = 0; s < S; s++) {
    const base = s * perStrip;
    let raw = 0;
    for (let i = base; i < base + perStrip; i++) {
      const v = Math.floor((src[i] * b) / 255);
      out[i] = v;
      raw += v;
    }
    if (raw > worst) {
      worst = raw;
    }
    if (raw > MAX_CHANNEL_SUM_PER_STRIP) {
      const k = Math.floor((MAX_CHANNEL_SUM_PER_STRIP * 256) / raw);
      raw = 0;
      for (let i = base; i < base + perStrip; i++) {
        const v = (out[i] * k) >> 8;
        out[i] = v;
        raw += v;
      }
    }
    total += raw;
  }
  return {
    load: total / (S * MAX_CHANNEL_SUM_PER_STRIP),
    rawPeak: worst / MAX_CHANNEL_SUM_PER_STRIP,
  };
}

export function output(frame: Frame, brightness: number) {
  const out = new Uint8Array(LED_COUNT * 3);
  return { out, ...outputInto(frame, brightness, out) };
}

// ===================================================================================
// Spooky designs (ports of the emulator's DESIGNS; l = 0 top, l = 59 hem)
// ===================================================================================

// Per-animation scratch state. Each design owns its own shape, so it is deliberately loose.
type State = Record<string, any>;
type StepFn = (frame: Frame, st: State, t: number) => void;

const fireStep = (st: State, cooling: number, sparking: number) => {
  st.heat ??= Array.from({ length: S }, () => new Array(L).fill(0));
  for (const heat of st.heat as number[][]) {
    // classic Fire2012, index 0 = bottom of the flame
    for (let i = 0; i < L; i++) {
      heat[i] = Math.max(0, heat[i] - rand((cooling * 10) / L + 2));
    }
    for (let k = L - 1; k >= 2; k--) {
      heat[k] = (heat[k - 1] + heat[k - 2] * 2) / 3;
    }
    if (rand(255) < sparking) {
      const y = rand(7);
      heat[y] = Math.min(255, heat[y] + rnd(160, 255));
    }
  }
};
const drawFire = (frame: Frame, st: State, stops: Array<[number, RGB]>) => {
  for (let s = 0; s < S; s++) {
    for (let i = 0; i < L; i++) {
      frame.set(s, L - 1 - i, palette(stops, st.heat[s][i] / 255));
    }
  }
};

const thump = (x: number) => Math.exp(-((x / 0.06) ** 2));

const SPOOKY: Record<SpookyId, StepFn> = {
  bonfire(frame, st) {
    fireStep(st, 55, 120);
    drawFire(frame, st, [
      [0, [0, 0, 0]],
      [0.35, [200, 0, 0]],
      [0.7, [255, 110, 0]],
      [1, [255, 220, 90]],
    ]);
  },
  ghostfire(frame, st) {
    fireStep(st, 60, 110);
    drawFire(frame, st, [
      [0, [0, 0, 0]],
      [0.35, [0, 10, 160]],
      [0.7, [0, 170, 255]],
      [1, [200, 240, 255]],
    ]);
  },
  witchfire(frame, st) {
    fireStep(st, 50, 130);
    drawFire(frame, st, [
      [0, [0, 0, 0]],
      [0.3, [70, 0, 110]],
      [0.65, [40, 200, 0]],
      [1, [190, 255, 90]],
    ]);
  },
  inferno(frame, _st, t) {
    // A helix of fire spiralling up the cape; troughs stay deep crimson
    const fire: Array<[number, RGB]> = [
      [0, [45, 0, 0]],
      [0.35, [170, 0, 0]],
      [0.7, [255, 90, 0]],
      [1, [255, 210, 80]],
    ];
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const angle = (s / S) * 2 * Math.PI;
        const swirl = Math.sin(angle + l * 0.16 + t * 3.2);
        const swirl2 = Math.sin(angle * 2 - l * 0.07 + t * 1.7 + 1.3);
        const flicker = 0.85 + 0.15 * Math.sin(t * 23 + s * 7.1 + l * 1.3);
        const heat = 0.5 + 0.5 * (0.55 * swirl + 0.45 * swirl2);
        frame.set(s, l, palette(fire, heat ** 1.5 * flicker));
      }
    }
  },
  heartbeat(frame, _st, t) {
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const d = Math.hypot((s - 3.5) * 3, l - 12) / 60; // distance from the heart, in seconds of delay
        const ph = (((t * 1.05 - d) % 1) + 1) % 1;
        const e = thump(ph) + thump(ph - 1) + 0.65 * thump(ph - 0.28);
        frame.set(
          s,
          l,
          mix(
            [14, 0, 0],
            [255, 0, 10],
            Math.min(1, e) * Math.max(0.25, 1 - d * 1.2),
          ),
        );
      }
    }
  },
  ghost(frame, _st, t) {
    const breath = 0.5 - 0.5 * Math.cos((t * 2 * Math.PI) / 6);
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const wisp =
          0.5 +
          0.5 *
            Math.sin(l * 0.22 - t * 1.4 + s * 1.7) *
            Math.sin(l * 0.09 + t * 0.6 + s * 0.9);
        frame.set(s, l, scale([150, 200, 255], 0.05 + 0.55 * breath * wisp));
      }
    }
  },
  drip(frame, st) {
    st.drops ??= [];
    st.pool ??= new Array(S).fill(0);
    frame.fade(0.86);
    if (random() < 0.05) {
      st.drops.push({ s: rand(S), p: 0, v: 0, hang: rnd(0.4, 1.4) });
    }
    for (const d of st.drops as State[]) {
      if (d.hang > 0) {
        d.hang -= TICK;
        d.p = 2 * (1 - d.hang / 1.4);
      } else {
        d.v += 0.06;
        d.p += d.v;
      }
      for (let k = 0; k < 3; k++) {
        frame.add(d.s, Math.floor(d.p) - k, scale([200, 0, 0], 1 - k * 0.3));
      }
      if (d.p >= L - 1) {
        st.pool[d.s] = 1;
      }
    }
    st.drops = st.drops.filter((d: State) => d.p < L - 1);
    for (let s = 0; s < S; s++) {
      st.pool[s] = Math.max(0.15, st.pool[s] * 0.995);
      for (let k = 0; k < 4; k++) {
        frame.add(s, L - 1 - k, scale([120, 0, 0], st.pool[s] * (1 - k / 4)));
      }
      for (let k = 0; k < 2; k++) {
        frame.add(s, k, [40, 0, 0]);
      }
    }
  },
  ecto(frame, _st, t) {
    // Plasma tide: four interfering waves, one radiating from the middle of the back
    const goo: Array<[number, RGB]> = [
      [0, [30, 0, 50]],
      [0.4, [120, 0, 200]],
      [0.75, [40, 255, 80]],
      [1, [200, 255, 200]],
    ];
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const x = s * 0.9;
        const y = l * 0.12;
        const v =
          Math.sin(x + t * 1.3) +
          Math.sin(y * 1.5 - t * 2.1) +
          Math.sin((x + y) * 0.7 + t * 1.7) +
          Math.sin(Math.hypot(x - 3, y - 3.5) * 1.5 - t * 2);
        frame.set(s, l, palette(goo, ((v + 4) / 8) ** 1.3));
      }
    }
  },
  cauldron(frame, st) {
    st.b ??= [];
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const y = l / (L - 1);
        frame.set(s, l, mix([12, 0, 22], [0, 70, 5], y ** 2.2));
      }
    }
    if (random() < 0.18) {
      st.b.push({ s: rand(S), p: L - 1, v: rnd(0.25, 0.6), pop: rnd(5, 40) });
    }
    for (const b of st.b as State[]) {
      b.p -= b.v;
      const l = Math.floor(b.p);
      if (b.p > b.pop) {
        frame.add(b.s, l, [70, 255, 40]);
        frame.add(b.s, l + 1, [10, 90, 10]);
      } else {
        b.dead = (b.dead ?? 0) + 1;
        frame.add(b.s, l, scale([170, 60, 255], 1 - b.dead / 8));
      }
    }
    st.b = st.b.filter((b: State) => (b.dead ?? 0) < 8);
  },
  banshee(frame, _st, t) {
    // Shockwave rings racing outward from the heart over a swirling violet storm
    const ring = hsv(260 + 60 * Math.sin(t * 0.5), 0.45, 1);
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const d = Math.hypot((s - 3.5) * 3, l - 12);
        const crest =
          Math.max(0, Math.sin(d * 0.35 - t * 6)) ** 3 *
          Math.max(0.3, 1 - d / 80);
        const swirl = 0.5 + 0.5 * Math.sin(s * 0.8 - l * 0.1 + t * 1.5);
        frame.set(
          s,
          l,
          mix(mix([25, 0, 45], [70, 0, 130], swirl), ring, crest),
        );
      }
    }
  },
  glitch(frame, st, t) {
    st.black ??= 0;
    if (st.black > t) {
      frame.fill([0, 0, 0]);
      return;
    }
    if (random() < 0.004) {
      st.black = t + rnd(0.1, 0.4);
    }
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        frame.set(
          s,
          l,
          scale([40, 0, 70], 0.7 + 0.3 * Math.sin(l * 0.5 + t * 9 + s)),
        );
      }
    }
    const n = random() < 0.25 ? 1 + rand(3) : 0;
    for (let i = 0; i < n; i++) {
      const s = rand(S);
      const a = rand(L);
      const len = 3 + rand(14);
      const c: RGB = (
        [
          [255, 255, 255],
          [255, 0, 40],
          [0, 255, 230],
        ] as RGB[]
      )[rand(3)];
      for (let l = a; l < a + len; l++) {
        frame.set(s, l, c);
      }
    }
  },
  reaper(frame, _st, t) {
    frame.fade(0.9);
    const pos = (L - 1) * (0.5 - 0.5 * Math.cos(t * 1.1));
    for (let s = 0; s < S; s++) {
      for (let k = -2; k <= 2; k++) {
        frame.add(
          s,
          Math.round(pos) + k,
          scale([190, 140, 255], 1 - Math.abs(k) / 3),
        );
      }
    }
  },
  rain(frame, st) {
    st.d ??= Array.from({ length: S * 2 }, (_, i) => ({
      s: i % S,
      p: -rand(L),
      v: rnd(0.3, 0.9),
    }));
    frame.fade(0.88);
    for (const d of st.d as State[]) {
      d.p += d.v;
      if (d.p > L + 5) {
        d.p = -rand(20);
        d.v = rnd(0.3, 0.9);
      }
      frame.set(d.s, Math.floor(d.p), [170, 255, 170]);
      frame.add(d.s, Math.floor(d.p) - 1, [0, 140, 20]);
    }
  },
  pumpkin(frame, _st, t) {
    const cols = [hex(0xff5000), hex(0x6a00ff)];
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        frame.set(s, l, gradient(cols, (l + s * 5 - t * 18) / 40));
      }
    }
  },
  candycorn(frame, _st, t) {
    const cols = [hex(0xffd000), hex(0xff5a00), hex(0xfff0d0)];
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const x = ((((l - t * 9) / 7) % 3) + 3) % 3;
        const i = Math.floor(x);
        const f = x - i;
        frame.set(
          s,
          l,
          f < 0.8 ? cols[i] : mix(cols[i], cols[(i + 1) % 3], (f - 0.8) / 0.2),
        );
      }
    }
  },
  aurora(frame, _st, t) {
    for (let s = 0; s < S; s++) {
      for (let l = 0; l < L; l++) {
        const n =
          Math.sin(s * 0.7 + t * 0.5) +
          Math.sin(l * 0.09 - t * 0.8 + s * 0.3) +
          Math.sin((s + l * 0.2) * 0.5 + t * 0.3);
        const v = Math.max(0, Math.sin(l * 0.15 + t * 0.9 + s * 0.5 + n));
        frame.set(
          s,
          l,
          hsv(270 - 90 * (0.5 + n / 6), 0.9, 0.12 + 0.8 * v ** 2),
        );
      }
    }
  },
};

// ===================================================================================
// Classic animations (src/led/*.cpp)
// ===================================================================================

// Rainbow flow. The emulator advances the wheel by 5 per 20 ms tick (the firmware gates on
// 10 ms but its loop is slowed by 8 sequential strip.show() calls); kept as the emulator has it.
// The firmware advances the wheel once per loop, and a loop takes ~14.4 ms (8 strip writes),
// so ~1.4 steps per 20 ms tick. Measured from the spooky frame timings on the real cape.
export const RAINBOW_STEPS_PER_TICK = 1.4;
function wheel(p: number): RGB {
  p = 255 - p;
  if (p < 85) {
    return [255 - p * 3, 0, p * 3];
  }
  if (p < 170) {
    p -= 85;
    return [0, p * 3, 255 - p * 3];
  }
  p -= 170;
  return [p * 3, 255 - p * 3, 0];
}
const rainbowFlow: StepFn = (frame, st) => {
  st.j = ((st.j ?? 0) + RAINBOW_STEPS_PER_TICK) % 256;
  for (let s = 0; s < S; s++) {
    for (let k = 0; k < L; k++) {
      frame.set(s, L - 1 - k, wheel((Math.floor((k * 256) / L) + st.j) & 255));
    }
  }
};

// ColorUtils.cpp: interpolateColor truncates each channel to uint8.
function lerpColor(a: RGB, b: RGB, ratio: number): RGB {
  return [
    Math.floor(a[0] * (1 - ratio) + b[0] * ratio),
    Math.floor(a[1] * (1 - ratio) + b[1] * ratio),
    Math.floor(a[2] * (1 - ratio) + b[2] * ratio),
  ];
}
// ColorUtils.cpp interpolateColorBasedOnCount: 1, 2 or 3 colors across the strip (else black).
function colorByCount(colors: RGB[], index: number, total: number): RGB {
  const ratio = index / (total - 1);
  if (colors.length === 1) {
    return colors[0];
  }
  if (colors.length === 2) {
    return lerpColor(colors[0], colors[1], ratio);
  }
  if (colors.length === 3) {
    return index < Math.floor(total / 2)
      ? lerpColor(colors[0], colors[1], 2 * ratio)
      : lerpColor(colors[1], colors[2], 2 * (ratio - 0.5));
  }
  return [0, 0, 0];
}
// ColorUtils.cpp interpolateGradient: wraps around to the first color.
function gradientByPosition(colors: RGB[], position: number): RGB {
  const ext = [...colors, colors[0]];
  const segmentLength = 1 / (ext.length - 1);
  const left = Math.min(Math.floor(position / segmentLength), ext.length - 2);
  const local = (position - left * segmentLength) / segmentLength;
  return lerpColor(ext[left], ext[left + 1], local);
}
function parseColors(colors: string[]): RGB[] {
  // firmware: strtol(hex, NULL, 16) -> 0 on garbage
  return colors.map(c => hex(parseInt(c, 16) || 0));
}

// Firmware Flow/Emanate/Pulse only update every 50 ms. Run `update` once per elapsed 50 ms
// of animation time (first call immediately), independent of the 20 ms tick.
const CLASSIC_INTERVAL = 0.05;
function every(st: State, t: number, interval: number, update: () => void) {
  st.next ??= t;
  while (t + 1e-9 >= st.next) {
    update();
    st.next += interval;
  }
}

const solid =
  (colors: RGB[]): StepFn =>
  (frame, st) => {
    if (st.done) {
      return;
    }
    st.done = true;
    for (let l = 0; l < L; l++) {
      const c = colorByCount(colors, l, L);
      for (let s = 0; s < S; s++) {
        frame.set(s, l, c);
      }
    }
  };

const pulse =
  (colors: RGB[], getBrightness: () => number): StepFn =>
  (frame, st, t) => {
    st.b ??= 0.2;
    st.up ??= true;
    every(st, t, CLASSIC_INTERVAL, () => {
      // Pulse.cpp multiplies by currentMaxBrightness itself, on top of the strip brightness the
      // output stage applies, so at low brightness pulse is dimmer than other animations.
      const k = (st.b * getBrightness()) / 255;
      for (let l = 0; l < L; l++) {
        const c = colorByCount(colors, l, L);
        const px: RGB = [
          Math.floor(c[0] * k),
          Math.floor(c[1] * k),
          Math.floor(c[2] * k),
        ];
        for (let s = 0; s < S; s++) {
          frame.set(s, l, px);
        }
      }
      if (st.up) {
        st.b += 0.05;
        if (st.b >= 1) {
          st.b = 1;
          st.up = false;
        }
      } else {
        st.b -= 0.05;
        if (st.b <= 0.2) {
          st.b = 0.2;
          st.up = true;
        }
      }
    });
  };

const flow =
  (colors: RGB[]): StepFn =>
  (frame, st, t) => {
    if (colors.length < 2) {
      return; // main.cpp only runs flow with >= 2 colors
    }
    st.pos ??= 0;
    every(st, t, CLASSIC_INTERVAL, () => {
      for (let l = 0; l < L; l++) {
        const c = gradientByPosition(colors, ((L + st.pos - l) % L) / L);
        for (let s = 0; s < S; s++) {
          frame.set(s, l, c);
        }
      }
      st.pos = (st.pos + 1) % L;
    });
  };

const emanate =
  (colors: RGB[]): StepFn =>
  (frame, st, t) => {
    if (colors.length < 1) {
      return;
    }
    st.radius ??= 0;
    every(st, t, CLASSIC_INTERVAL, () => {
      for (let l = 0; l < L; l++) {
        const distance = Math.abs(L / 2 - l);
        const c = gradientByPosition(colors, ((distance + st.radius) % L) / L);
        for (let s = 0; s < S; s++) {
          frame.set(s, l, c);
        }
      }
      st.radius = (st.radius + 1) % L;
    });
  };

// ===================================================================================
// Live draw (brush)
// ===================================================================================
// Positions are normalized (x 0..1 across strips, y 0..1 down the LEDs), see protocol.ts:
//   sx = x * 7, ly = y * 59; every LED with d2 = ((s - sx) * 4)^2 + (l - ly)^2 < 25 gets
//   color * exp(-d2 / 4) added. Consecutive points of one finger are joined by stamping the
//   brush every 0.5 units (same metric) along the segment.

export interface BrushPoint {
  x: number;
  y: number;
}

export function stampBrush(frame: Frame, x: number, y: number, color: RGB) {
  const sx = x * (S - 1);
  const ly = y * (L - 1);
  const reachS = Math.sqrt(BRUSH_RADIUS_SQUARED) / BRUSH_STRIP_SCALE;
  const reachL = Math.sqrt(BRUSH_RADIUS_SQUARED);
  const s0 = Math.max(0, Math.floor(sx - reachS));
  const s1 = Math.min(S - 1, Math.ceil(sx + reachS));
  const l0 = Math.max(0, Math.floor(ly - reachL));
  const l1 = Math.min(L - 1, Math.ceil(ly + reachL));
  for (let s = s0; s <= s1; s++) {
    for (let l = l0; l <= l1; l++) {
      const d2 = ((s - sx) * BRUSH_STRIP_SCALE) ** 2 + (l - ly) ** 2;
      if (d2 < BRUSH_RADIUS_SQUARED) {
        frame.add(s, l, scale(color, Math.exp(-d2 / BRUSH_FALLOFF)));
      }
    }
  }
}

// Stamps the brush along from -> to, excluding `from` (it was stamped when it arrived) and
// including `to`, with spacing BRUSH_STAMP_SPACING in the brush's distance metric. Zero
// length segments (a finger that did not move) stamp nothing.
export function stampSegment(
  frame: Frame,
  from: BrushPoint,
  to: BrushPoint,
  color: RGB,
) {
  const ds = (to.x - from.x) * (S - 1) * BRUSH_STRIP_SCALE;
  const dl = (to.y - from.y) * (L - 1);
  const n = Math.ceil(Math.hypot(ds, dl) / BRUSH_STAMP_SPACING - 1e-9);
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    stampBrush(
      frame,
      from.x + (to.x - from.x) * f,
      from.y + (to.y - from.y) * f,
      color,
    );
  }
}

export type DrawEvent =
  | { type: 'point'; point: DrawPoint }
  | { type: 'up'; finger: number };

/** Applies one draw event; `last` tracks each finger's previous point. Pure apart from `frame`/`last`. */
export function applyDrawEvent(
  frame: Frame,
  last: Map<number, BrushPoint>,
  event: DrawEvent,
) {
  if (event.type === 'up') {
    last.delete(event.finger);
    return;
  }
  const { finger, color } = event.point;
  const x = Math.max(0, Math.min(1, event.point.x));
  const y = Math.max(0, Math.min(1, event.point.y));
  const rgb = hex(parseInt(color, 16) || 0);
  const prev = last.get(finger);
  if (prev) {
    stampSegment(frame, prev, { x, y }, rgb);
  } else {
    stampBrush(frame, x, y, rgb);
  }
  last.set(finger, { x, y });
}

// ===================================================================================
// Animator
// ===================================================================================

export interface CapeAnimator {
  readonly frame: Frame;
  /** Advance one 20 ms tick. `t` is seconds since this animator was created (tick * TICK). */
  step(t: number): void;
  /** Release subscriptions (draw mode). Safe to call more than once. */
  dispose(): void;
}

function stepAnimator(fn: StepFn): CapeAnimator {
  const frame = new Frame();
  const st: State = {};
  return {
    frame,
    step: t => fn(frame, st, t),
    dispose() {},
  };
}

function drawAnimator(): CapeAnimator {
  const frame = new Frame();
  const last = new Map<number, BrushPoint>();
  let queue: DrawEvent[] = [];
  const unsubscribe = subscribeDraw(event => queue.push(event));
  return {
    frame,
    step() {
      // Fade first, then stamp what arrived since the last tick at full strength.
      frame.fade(DRAW_FADE_PER_FRAME);
      const events = queue;
      queue = [];
      for (const event of events) {
        applyDrawEvent(frame, last, event);
      }
    },
    dispose: unsubscribe,
  };
}

/**
 * `getBrightness` (0-255) is only needed for `pulse`, which scales by the brightness itself
 * (see pulse above); the generic brightness is applied later by output().
 */
export function createAnimator(
  animation: CapeAnimation,
  getBrightness: () => number = () => 255,
): CapeAnimator {
  switch (animation.kind) {
    case 'spooky':
      return stepAnimator(SPOOKY[animation.id] ?? unknown);
    case 'rainbow_flow':
      return stepAnimator(rainbowFlow);
    case 'solid':
      return stepAnimator(solid(parseColors(animation.colors)));
    case 'pulse':
      return stepAnimator(pulse(parseColors(animation.colors), getBrightness));
    case 'flow':
      return stepAnimator(flow(parseColors(animation.colors)));
    case 'emanate':
      return stepAnimator(emanate(parseColors(animation.colors)));
    case 'draw':
      return drawAnimator();
    default:
      return stepAnimator(unknown);
  }
}

// Unknown animation: a dim, slow rainbow drifting down the cape. It tells you "the cape is
// playing something the app does not recognise" without being black (which looks like a
// disconnect) or loud (it is capped at ~20% brightness).
function unknown(frame: Frame, _st: State, t: number) {
  for (let s = 0; s < S; s++) {
    for (let l = 0; l < L; l++) {
      frame.set(s, l, hsv(l * 3 + s * 6 - t * 20, 1, 0.2));
    }
  }
}
