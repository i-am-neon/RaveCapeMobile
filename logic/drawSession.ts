import { DrawPoint, emitDraw } from '../cape/protocol';
import { touchToCape } from '../cape/geometry';
import { advanceStroke, colorAtDistance, startStroke, StrokeState } from './strokeColor';
import type { PointBatcher } from './pointBatcher';

export const MAX_FINGERS = 4;
// One full trip through the chosen colors takes about the height of the cape
// (the cape occupies 92% of the view height, see cape/geometry.ts).
export const CYCLE_HEIGHT_FRACTION = 0.92;

interface Finger {
  finger: number;
  stroke: StrokeState;
}

export interface DrawSessionOptions {
  getColors: () => string[]; // 1-3 hex colors, read live so palette changes apply at once
  getSize: () => { width: number; height: number };
  batcher: Pick<PointBatcher, 'push' | 'up'>;
  emit?: typeof emitDraw;
}

// Turns raw multi-touch input into draw points: assigns finger slots (max 4), colors each
// point by distance traveled in the stroke, mirrors it on screen and hands it to the
// BLE batcher.
export function createDrawSession({ getColors, getSize, batcher, emit = emitDraw }: DrawSessionOptions) {
  const fingers = new Map<string, Finger>();

  const addPoint = (entry: Finger, x: number, y: number) => {
    const { width, height } = getSize();
    if (width <= 0 || height <= 0) {
      return;
    }
    entry.stroke = advanceStroke(entry.stroke, x, y);
    const cape = touchToCape(x, y, width, height);
    const point: DrawPoint = {
      finger: entry.finger,
      x: cape.x,
      y: cape.y,
      color: colorAtDistance(getColors(), entry.stroke.distance, CYCLE_HEIGHT_FRACTION * height),
    };
    emit({ type: 'point', point });
    batcher.push(point);
  };

  const release = (id: string) => {
    const entry = fingers.get(id);
    if (!entry) {
      return;
    }
    fingers.delete(id);
    emit({ type: 'up', finger: entry.finger });
    batcher.up(entry.finger);
  };

  return {
    start(id: string, x: number, y: number) {
      if (fingers.has(id)) {
        this.move(id, x, y);
        return;
      }
      const used = new Set(Array.from(fingers.values()).map(f => f.finger));
      let slot = 0;
      while (used.has(slot)) {
        slot++;
      }
      if (slot >= MAX_FINGERS) {
        return; // 5th+ finger ignored
      }
      const entry: Finger = { finger: slot, stroke: startStroke(x, y) };
      fingers.set(id, entry);
      addPoint(entry, x, y);
    },
    move(id: string, x: number, y: number) {
      const entry = fingers.get(id);
      if (!entry || (entry.stroke.lastX === x && entry.stroke.lastY === y)) {
        return;
      }
      addPoint(entry, x, y);
    },
    // End every finger whose touch id is not in `activeIds` (robust to missed touch-ends).
    syncActive(activeIds: string[]) {
      const alive = new Set(activeIds);
      Array.from(fingers.keys()).forEach(id => {
        if (!alive.has(id)) {
          release(id);
        }
      });
    },
    endAll() {
      Array.from(fingers.keys()).forEach(release);
    },
    activeCount: () => fingers.size,
  };
}

export type DrawSession = ReturnType<typeof createDrawSession>;
