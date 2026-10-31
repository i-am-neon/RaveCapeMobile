import type { DrawPoint } from '../cape/protocol';

// Batches live-draw points for BLE (points from one touch event are coalesced). At most one points message per `intervalMs` (default
// ~30 Hz); it carries the latest point of every finger that moved since the last send.
// Finger-up messages are rare and important, so they go out immediately and drop that
// finger's unsent point.
export interface PointBatcherOptions {
  sendPoints: (points: DrawPoint[]) => void;
  sendUp: (finger: number) => void;
  intervalMs?: number;
  now?: () => number;
}

export interface PointBatcher {
  push: (point: DrawPoint) => void;
  up: (finger: number) => void;
  // Drop everything pending (leaving the draw pane).
  cancel: () => void;
}

// 34 ms (~29.4 Hz): any one-second window holds at most 30 sends.
export const DRAW_SEND_INTERVAL_MS = 34;

export function createPointBatcher({
  sendPoints,
  sendUp,
  intervalMs = DRAW_SEND_INTERVAL_MS,
  now = Date.now,
}: PointBatcherOptions): PointBatcher {
  const pending = new Map<number, DrawPoint>();
  let lastSent = -Infinity;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = () => {
    clearTimer();
    if (pending.size === 0) {
      return;
    }
    const points = Array.from(pending.values()).sort((a, b) => a.finger - b.finger);
    pending.clear();
    lastSent = now();
    sendPoints(points);
  };

  const schedule = () => {
    if (timer !== null) {
      return;
    }
    // Even when a send is due now, defer to the next tick so every finger reported by
    // the same touch event lands in the same message.
    timer = setTimeout(flush, Math.max(0, lastSent + intervalMs - now()));
  };

  return {
    push(point) {
      pending.set(point.finger, point);
      schedule();
    },
    up(finger) {
      pending.delete(finger);
      if (pending.size === 0) {
        clearTimer();
      }
      sendUp(finger);
    },
    cancel() {
      pending.clear();
      clearTimer();
    },
  };
}
