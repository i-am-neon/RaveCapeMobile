import { describe, it, expect } from '@jest/globals';
import { buildColorMessage } from '../logic/colorMessage';

describe('buildColorMessage', () => {
  it('formats name:hex,hex without # and skips empty slots', () => {
    expect(buildColorMessage('solid', ['#FF0000', '', ''])).toBe('solid:ff0000');
    expect(buildColorMessage('pulse', ['#ff0000', '#00ff00', ''])).toBe('pulse:ff0000,00ff00');
    expect(buildColorMessage('emanate', ['ff0000', '00ff00', '0000ff'])).toBe('emanate:ff0000,00ff00,0000ff');
  });
  it('drops alpha', () => {
    expect(buildColorMessage('flow', ['#ff0000cc'])).toBe('flow:ff0000');
  });
  it('needs at least one valid color', () => {
    expect(buildColorMessage('solid', ['', '', ''])).toBeNull();
    expect(buildColorMessage('solid', ['nope'])).toBeNull();
  });
  it('round-trips through the cape protocol', () => {
    const { parseCapeMessage } = require('../cape/protocol');
    expect(parseCapeMessage(buildColorMessage('flow', ['#AA00FF', '#00FFAA'])!)).toEqual({
      kind: 'flow', colors: ['aa00ff', '00ffaa'],
    });
  });
});
