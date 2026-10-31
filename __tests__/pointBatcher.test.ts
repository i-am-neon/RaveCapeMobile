import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createPointBatcher, DRAW_SEND_INTERVAL_MS } from '../logic/pointBatcher';
import { DrawPoint, toPointsMessage } from '../cape/protocol';

const pt = (finger: number, x: number): DrawPoint => ({ finger, x, y: 0.5, color: 'ff0000' });

describe('point batcher', () => {
  let sendPoints: jest.Mock<(p: DrawPoint[]) => void>;
  let sendUp: jest.Mock<(f: number) => void>;
  let batcher: ReturnType<typeof createPointBatcher>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000_000);
    sendPoints = jest.fn();
    sendUp = jest.fn();
    batcher = createPointBatcher({ sendPoints, sendUp });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends the first point right away (next tick)', () => {
    batcher.push(pt(0, 0.1));
    jest.advanceTimersByTime(0);
    expect(sendPoints).toHaveBeenCalledTimes(1);
    expect(sendPoints).toHaveBeenCalledWith([pt(0, 0.1)]);
  });

  it('never sends more than 30 messages in any one-second window, however fast points arrive', () => {
    const times: number[] = [];
    sendPoints.mockImplementation(() => { times.push(Date.now()); });
    // 3 seconds of touch events at 240 Hz from 4 fingers
    for (let t = 0; t < 3000; t += 1000 / 240) {
      for (let f = 0; f < 4; f++) {
        batcher.push(pt(f, (t % 1000) / 1000));
      }
      jest.advanceTimersByTime(1000 / 240);
    }
    jest.advanceTimersByTime(100);
    expect(times.length).toBeGreaterThanOrEqual(80);
    for (let i = 0; i + 30 < times.length; i++) {
      expect(times[i + 30] - times[i]).toBeGreaterThanOrEqual(1000);
    }
  });

  it('keeps >= interval between consecutive sends', () => {
    const times: number[] = [];
    sendPoints.mockImplementation(() => { times.push(Date.now()); });
    for (let i = 0; i < 200; i++) {
      batcher.push(pt(0, i / 200));
      jest.advanceTimersByTime(5);
    }
    jest.advanceTimersByTime(100);
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(Math.floor(DRAW_SEND_INTERVAL_MS));
    }
  });

  it('coalesces fingers pushed in the same tick even when a send is due', () => {
    batcher.push(pt(0, 0.1));
    batcher.push(pt(1, 0.2));
    jest.advanceTimersByTime(0);
    expect(sendPoints).toHaveBeenCalledTimes(1);
    expect(sendPoints).toHaveBeenCalledWith([pt(0, 0.1), pt(1, 0.2)]);
  });

  it('puts all active fingers in one message, latest point per finger', () => {
    batcher.push(pt(0, 0.1)); // goes out next tick
    jest.advanceTimersByTime(0);
    sendPoints.mockClear();
    batcher.push(pt(2, 0.2));
    batcher.push(pt(0, 0.3));
    batcher.push(pt(0, 0.4)); // supersedes 0.3
    batcher.push(pt(1, 0.5));
    expect(sendPoints).not.toHaveBeenCalled();
    jest.advanceTimersByTime(40);
    expect(sendPoints).toHaveBeenCalledTimes(1);
    expect(sendPoints).toHaveBeenCalledWith([pt(0, 0.4), pt(1, 0.5), pt(2, 0.2)]);
    expect(toPointsMessage(sendPoints.mock.calls[0][0])).toBe(
      'p:0,400,500,ff0000;1,500,500,ff0000;2,200,500,ff0000',
    );
  });

  it('sends nothing while idle', () => {
    batcher.push(pt(0, 0.1));
    jest.advanceTimersByTime(0);
    sendPoints.mockClear();
    jest.advanceTimersByTime(500);
    expect(sendPoints).not.toHaveBeenCalled();
  });

  it('sends finger-up immediately and drops that finger\'s unsent point', () => {
    batcher.push(pt(0, 0.1));
    jest.advanceTimersByTime(0);
    sendPoints.mockClear();
    batcher.push(pt(0, 0.2));
    batcher.push(pt(1, 0.3));
    batcher.up(0);
    expect(sendUp).toHaveBeenCalledWith(0);
    jest.advanceTimersByTime(40);
    expect(sendPoints).toHaveBeenCalledTimes(1);
    expect(sendPoints).toHaveBeenCalledWith([pt(1, 0.3)]);
  });

  it('cancel drops pending points and timers', () => {
    batcher.push(pt(0, 0.1));
    jest.advanceTimersByTime(0);
    sendPoints.mockClear();
    batcher.push(pt(0, 0.2));
    batcher.cancel();
    jest.advanceTimersByTime(500);
    expect(sendPoints).not.toHaveBeenCalled();
  });
});
