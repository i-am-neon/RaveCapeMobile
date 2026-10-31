import { describe, it, expect } from '@jest/globals';
import {
  advanceStroke, colorAtDistance, hexToRgb, normalizeHex, rgbToHex, startStroke,
} from '../logic/strokeColor';

describe('normalizeHex', () => {
  it('accepts 6 and 8 digit hex with or without #', () => {
    expect(normalizeHex('#FF8800')).toBe('ff8800');
    expect(normalizeHex('ff8800')).toBe('ff8800');
    expect(normalizeHex('#ff8800cc')).toBe('ff8800');
  });
  it('rejects garbage', () => {
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#fff')).toBeNull();
  });
  it('round-trips rgb', () => {
    expect(rgbToHex(hexToRgb('12ab9f'))).toBe('12ab9f');
  });
});

describe('colorAtDistance', () => {
  it('is constant for a single color', () => {
    for (const d of [0, 10, 12345.6]) {
      expect(colorAtDistance(['ff0000'], d, 100)).toBe('ff0000');
    }
  });

  it('starts on the first color and returns to it after one cycle', () => {
    const colors = ['ff0000', '00ff00', '0000ff'];
    expect(colorAtDistance(colors, 0, 100)).toBe('ff0000');
    expect(colorAtDistance(colors, 100, 100)).toBe('ff0000');
    expect(colorAtDistance(colors, 250, 100)).toBe(colorAtDistance(colors, 50, 100));
  });

  it('hits each color at its 1/n of the cycle', () => {
    const colors = ['ff0000', '00ff00', '0000ff'];
    expect(colorAtDistance(colors, 100 / 3, 100)).toBe('00ff00');
    expect(colorAtDistance(colors, 200 / 3, 100)).toBe('0000ff');
  });

  it('blends smoothly between neighbours', () => {
    expect(colorAtDistance(['ff0000', '0000ff'], 25, 100)).toBe('800080');
    // wraps from the last color back to the first
    expect(colorAtDistance(['ff0000', '0000ff'], 75, 100)).toBe('800080');
  });

  it('changes in small steps (no jumps)', () => {
    const colors = ['ff6a00', '8a2be2', '39ff14'];
    let prev = hexToRgb(colorAtDistance(colors, 0, 1000));
    for (let d = 1; d <= 1000; d++) {
      const cur = hexToRgb(colorAtDistance(colors, d, 1000));
      expect(Math.max(...cur.map((v, i) => Math.abs(v - prev[i])))).toBeLessThanOrEqual(2);
      prev = cur;
    }
  });

  it('survives bad input', () => {
    expect(colorAtDistance([], 5, 100)).toBe('ffffff');
    expect(colorAtDistance(['nope', 'ff0000'], 5, 100)).toBe('ff0000');
    expect(colorAtDistance(['ff0000', '00ff00'], 5, 0)).toBe('ff0000');
    expect(colorAtDistance(['ff0000', '00ff00'], NaN, 100)).toBe('ff0000');
  });
});

describe('stroke distance', () => {
  it('accumulates path length', () => {
    let s = startStroke(0, 0);
    s = advanceStroke(s, 3, 4);
    s = advanceStroke(s, 3, 10);
    expect(s.distance).toBeCloseTo(11);
  });
});
