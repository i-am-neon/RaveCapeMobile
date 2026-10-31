import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createDrawSession } from '../logic/drawSession';
import { createPointBatcher } from '../logic/pointBatcher';
import { DrawPoint, toPointsMessage } from '../cape/protocol';
import { touchToCape } from '../cape/geometry';

const W = 400;
const H = 800;

describe('draw session', () => {
  let colors: string[];
  let emitted: any[];
  let sentPoints: string[];
  let sentUps: number[];
  let session: ReturnType<typeof createDrawSession>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(5_000_000);
    colors = ['ff0000'];
    emitted = [];
    sentPoints = [];
    sentUps = [];
    const batcher = createPointBatcher({
      sendPoints: (p: DrawPoint[]) => sentPoints.push(toPointsMessage(p)),
      sendUp: (f: number) => sentUps.push(f),
    });
    session = createDrawSession({
      getColors: () => colors,
      getSize: () => ({ width: W, height: H }),
      batcher,
      emit: e => emitted.push(e),
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('maps touches to cape coordinates and mirrors every point immediately', () => {
    session.start('a', 200, 400);
    session.move('a', 220, 440);
    expect(emitted).toHaveLength(2);
    const expected = touchToCape(220, 440, W, H);
    expect(emitted[1].type).toBe('point');
    expect(emitted[1].point.x).toBeCloseTo(expected.x);
    expect(emitted[1].point.y).toBeCloseTo(expected.y);
    expect(emitted[1].point.finger).toBe(0);
    expect(emitted[1].point.color).toBe('ff0000');
  });

  it('cycles colors by distance traveled, one cycle per cape height', () => {
    colors = ['ff0000', '0000ff'];
    const cycle = 0.92 * H;
    session.start('a', 200, 100);
    session.move('a', 200, 100 + cycle / 2); // half a cycle down
    session.move('a', 200, 100 + cycle); // full cycle
    const [first, half, full] = emitted.map(e => e.point.color);
    expect(first).toBe('ff0000');
    expect(half).toBe('0000ff');
    expect(full).toBe('ff0000');
  });

  it('assigns up to 4 fingers, ignores the 5th, and reuses freed slots', () => {
    ['a', 'b', 'c', 'd', 'e'].forEach((id, i) => session.start(id, 50 + i * 20, 300));
    expect(emitted.map(e => e.point.finger)).toEqual([0, 1, 2, 3]);
    expect(session.activeCount()).toBe(4);
    session.syncActive(['a', 'c', 'd']); // b lifted
    expect(emitted[emitted.length - 1]).toEqual({ type: 'up', finger: 1 });
    session.start('f', 100, 300);
    expect(emitted[emitted.length - 1].point.finger).toBe(1);
  });

  it('batches all moving fingers into one BLE message', () => {
    session.start('a', 100, 300);
    session.start('b', 300, 300);
    sentPoints.length = 0;
    jest.advanceTimersByTime(100);
    session.move('a', 110, 310);
    session.move('b', 290, 310);
    jest.advanceTimersByTime(100);
    const messages = sentPoints.filter(m => m.split(';').length === 2);
    expect(messages.length).toBeGreaterThanOrEqual(1);
    expect(messages[messages.length - 1]).toMatch(/^p:0,\d+,\d+,ff0000;1,\d+,\d+,ff0000$/);
  });

  it('finger up emits u and sends u:<finger>; stationary moves are ignored', () => {
    session.start('a', 100, 300);
    session.move('a', 100, 300);
    expect(emitted).toHaveLength(1);
    session.syncActive([]);
    expect(emitted[emitted.length - 1]).toEqual({ type: 'up', finger: 0 });
    expect(sentUps).toEqual([0]);
  });

  it('endAll lifts every finger', () => {
    session.start('a', 100, 300);
    session.start('b', 200, 300);
    session.endAll();
    expect(sentUps.sort()).toEqual([0, 1]);
    expect(session.activeCount()).toBe(0);
  });
});
