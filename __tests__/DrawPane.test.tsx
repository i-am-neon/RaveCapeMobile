import React from 'react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ReactTestRenderer from 'react-test-renderer';
import DrawPane from '../components/DrawPane';

jest.mock('reanimated-color-picker', () => {
  const Stub = () => null;
  return { __esModule: true, default: Stub, Panel3: Stub, Preview: Stub, Swatches: Stub };
});

const mockSendMessage = jest.fn<(m: string) => void>();
const mockSendFast = jest.fn<(m: string) => void>();
let mockAnimation: unknown = { kind: 'spooky', id: 'ghost' };
jest.mock('../providers/BLEProvider', () => ({
  useBLE: () => ({
    sendMessage: mockSendMessage,
    sendFast: mockSendFast,
    currentAnimation: mockAnimation,
  }),
}));

const touch = (identifier: number, x: number, y: number) => ({
  identifier, locationX: x, locationY: y,
});
const ev = (touches: any[], changed = touches) => ({
  nativeEvent: { touches, changedTouches: changed },
});

describe('DrawPane', () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  const onBack = jest.fn();

  const render = (active: boolean) => {
    ReactTestRenderer.act(() => {
      tree.update(<DrawPane active={active} onBack={onBack} />);
    });
  };
  const surface = () => tree.root.findByProps({ testID: 'draw-surface' });
  const fire = (name: string, event: unknown) =>
    ReactTestRenderer.act(() => {
      surface().props[name](event);
    });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(9_000_000);
    mockSendMessage.mockClear();
    mockSendFast.mockClear();
    onBack.mockClear();
    mockAnimation = { kind: 'spooky', id: 'ghost' };
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(<DrawPane active={false} onBack={onBack} />);
    });
    ReactTestRenderer.act(() => {
      surface().props.onLayout({ nativeEvent: { layout: { width: 400, height: 800 } } });
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends draw when the pane opens and restores the previous animation on leaving', () => {
    render(true);
    expect(mockSendMessage).toHaveBeenCalledWith('draw');
    mockSendMessage.mockClear();
    mockAnimation = { kind: 'draw' }; // the cape confirmed draw mode
    render(false);
    expect(mockSendMessage).toHaveBeenLastCalledWith('ghost');
  });

  it('restores a color animation with its colors', () => {
    mockAnimation = { kind: 'pulse', colors: ['ff0000', '00ff00'] };
    render(true);
    render(false);
    expect(mockSendMessage).toHaveBeenLastCalledWith('pulse:ff0000,00ff00');
  });

  it('falls back to rainbow if nothing restorable was playing', () => {
    mockAnimation = { kind: 'unknown' };
    render(true);
    render(false);
    expect(mockSendMessage).toHaveBeenLastCalledWith('rainbow_flow');
  });

  it('does not draw while the pane is closed', () => {
    fire('onTouchStart', ev([touch(1, 200, 400)]));
    expect(mockSendFast).not.toHaveBeenCalled();
  });

  it('sends two fingers in one points message and finger-up as u:N', () => {
    render(true);
    mockSendMessage.mockClear();
    fire('onTouchStart', ev([touch(7, 100, 400)]));
    fire('onTouchStart', ev([touch(7, 100, 400), touch(8, 300, 400)], [touch(8, 300, 400)]));
    mockSendFast.mockClear();
    jest.advanceTimersByTime(100);
    fire('onTouchMove', ev([touch(7, 110, 420), touch(8, 290, 420)]));
    jest.advanceTimersByTime(100);
    const last = mockSendFast.mock.calls[mockSendFast.mock.calls.length - 1][0];
    expect(last).toMatch(/^p:0,\d+,\d+,ff6a00;1,\d+,\d+,ff6a00$/);

    fire('onTouchEnd', ev([touch(8, 290, 420)], [touch(7, 110, 420)]));
    expect(mockSendMessage).toHaveBeenCalledWith('u:0');
  });

  it('lifts fingers still down when leaving the pane', () => {
    render(true);
    fire('onTouchStart', ev([touch(3, 100, 400)]));
    mockSendMessage.mockClear();
    render(false);
    expect(mockSendMessage.mock.calls.map(c => c[0])).toEqual(['u:0', 'ghost']);
  });

  it('the back button calls onBack', () => {
    render(true);
    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: 'draw-back' }).props.onPress();
    });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('picks colors: a second slot makes strokes cycle through both', () => {
    render(true);
    const press = (id: string) =>
      ReactTestRenderer.act(() => {
        tree.root.findByProps({ testID: id }).props.onPress();
      });
    press('draw-add-slot'); // slot 2 (copies slot 1), now active
    press('draw-swatch-0066ff');
    mockSendFast.mockClear();
    fire('onTouchStart', ev([touch(1, 200, 100)]));
    jest.advanceTimersByTime(0);
    expect(mockSendFast.mock.calls[0][0]).toMatch(/,ff6a00$/);
    jest.advanceTimersByTime(100);
    fire('onTouchMove', ev([touch(1, 200, 100 + 0.46 * 800)])); // half a cape height
    jest.advanceTimersByTime(100);
    const last = mockSendFast.mock.calls[mockSendFast.mock.calls.length - 1][0];
    expect(last).toMatch(/,0066ff$/);
  });
});
