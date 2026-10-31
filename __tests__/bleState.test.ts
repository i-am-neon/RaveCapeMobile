import { describe, it, expect } from '@jest/globals';
import { applyMessage, clampBrightness, DEFAULT_ANIMATION, MAX_BRIGHTNESS } from '../logic/bleState';

const initial = { animation: DEFAULT_ANIMATION, brightness: MAX_BRIGHTNESS, shuffling: false };

describe('clampBrightness', () => {
  it('clamps to 0..255 and floors', () => {
    expect(MAX_BRIGHTNESS).toBe(255);
    expect(clampBrightness(-5)).toBe(0);
    expect(clampBrightness(0)).toBe(0);
    expect(clampBrightness(77.9)).toBe(77);
    expect(clampBrightness(153)).toBe(153);
    expect(clampBrightness(255)).toBe(255);
    expect(clampBrightness(300)).toBe(255);
    expect(clampBrightness(Infinity)).toBe(255);
    expect(clampBrightness(NaN)).toBe(255);
  });
});

describe('applyMessage', () => {
  it('boots into rainbow', () => {
    expect(initial.animation).toEqual({ kind: 'rainbow_flow' });
  });
  it('tracks presets, color animations, rainbow and draw', () => {
    expect(applyMessage(initial, 'ghost').animation).toEqual({ kind: 'spooky', id: 'ghost' });
    expect(applyMessage(initial, 'pulse:FF0000,00ff00').animation).toEqual({
      kind: 'pulse', colors: ['ff0000', '00ff00'],
    });
    expect(applyMessage(initial, 'draw').animation).toEqual({ kind: 'draw' });
    const spooky = applyMessage(initial, 'reaper');
    expect(applyMessage(spooky, 'rainbow_flow').animation).toEqual({ kind: 'rainbow_flow' });
  });
  it('brightness messages only change brightness (clamped)', () => {
    const spooky = applyMessage(initial, 'reaper');
    const dim = applyMessage(spooky, 'brightness:40');
    expect(dim.brightness).toBe(40);
    expect(dim.animation).toEqual({ kind: 'spooky', id: 'reaper' });
    expect(applyMessage(dim, 'brightness:999').brightness).toBe(255);
    expect(applyMessage(dim, 'brightness:-3').brightness).toBe(0);
    expect(applyMessage(dim, 'brightness:abc')).toBe(dim);
  });
  it('draw points and finger-ups leave the animation alone when sent', () => {
    const spooky = applyMessage(initial, 'reaper');
    expect(applyMessage(spooky, 'p:0,500,500,ff0000')).toBe(spooky);
    expect(applyMessage(spooky, 'u:0')).toBe(spooky);
  });
  it('unknown messages are tracked when sent', () => {
    expect(applyMessage(initial, 'mystery').animation).toEqual({ kind: 'unknown' });
  });
  describe('shuffle', () => {
    it('the shuffle command starts shuffling without changing what is shown yet', () => {
      const state = applyMessage(initial, 'shuffle');
      expect(state.shuffling).toBe(true);
      expect(state.animation).toEqual(initial.animation);
    });
    it('a pick from the cape shows that preset and keeps shuffling', () => {
      const state = applyMessage(initial, 'shuffle>pulse:833ab4,fd1d1d,fcb045', true);
      expect(state.shuffling).toBe(true);
      expect(state.animation).toEqual({ kind: 'pulse', colors: ['833ab4', 'fd1d1d', 'fcb045'] });
      expect(applyMessage(initial, 'shuffle>bonfire', true).animation).toEqual({ kind: 'spooky', id: 'bonfire' });
    });
    it('brightness keeps shuffling; choosing anything else stops it', () => {
      const shuffling = applyMessage(initial, 'shuffle>bonfire', true);
      expect(applyMessage(shuffling, 'brightness:80').shuffling).toBe(true);
      expect(applyMessage(shuffling, 'reaper').shuffling).toBe(false);
      expect(applyMessage(shuffling, 'rainbow_flow').shuffling).toBe(false);
      expect(applyMessage(shuffling, 'draw').shuffling).toBe(false);
      expect(applyMessage(shuffling, 'p:0,1,2,ff0000').shuffling).toBe(false);
    });
  });
  describe('when read from the cape on connect', () => {
    it('ignores the firmware greeting', () => {
      expect(applyMessage(initial, 'Hello From RaveCapeController!', true)).toBe(initial);
    });
    it('picks up the last animation', () => {
      expect(applyMessage(initial, 'solid:ff8800', true).animation).toEqual({
        kind: 'solid', colors: ['ff8800'],
      });
    });
    it('treats stored draw points as draw mode', () => {
      expect(applyMessage(initial, 'p:0,1,2,ff0000', true).animation).toEqual({ kind: 'draw' });
    });
    it('picks up brightness', () => {
      expect(applyMessage(initial, 'brightness:90', true).brightness).toBe(90);
    });
  });
});
