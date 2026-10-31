/**
 * @format
 */
import 'react-native';
import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ReactTestRenderer from 'react-test-renderer';
import { BackHandler } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { State } from 'react-native-gesture-handler';
import App from '../App';

jest.mock('../cape/CapeView', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: (props: any) => <View testID="cape-view" {...props} /> };
});
jest.mock('reanimated-color-picker', () => {
  const Stub = () => null;
  return { __esModule: true, default: Stub, Panel3: Stub, Preview: Stub, Swatches: Stub };
});
jest.mock('../requestBLEPermissions', () => ({
  __esModule: true,
  default: () => Promise.resolve(true),
}));

const mockStartScan = jest.fn();
const mockSendMessage = jest.fn();
let mockBle: any;
jest.mock('../providers/BLEProvider', () => ({
  useBLE: () => mockBle,
}));

const makeBle = (over: object = {}) => ({
  isScanning: false,
  connectedDevice: { id: 'x' },
  startScan: mockStartScan,
  sendMessage: mockSendMessage,
  sendFast: jest.fn(),
  currentAnimation: { kind: 'rainbow_flow' },
  brightness: 100,
  setBrightness: jest.fn(),
  ...over,
});

const render = async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  return tree;
};

const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findAll(n => (n.type as unknown) === 'Text').map(n => n.props.children);

describe('App shell', () => {
  beforeEach(() => {
    mockStartScan.mockClear();
    mockSendMessage.mockClear();
    mockBle = makeBle();
  });

  it('renders the cape full screen with the live animation and brightness', async () => {
    mockBle = makeBle({ currentAnimation: { kind: 'spooky', id: 'ghost' }, brightness: 42 });
    const tree = await render();
    const cape = tree.root.findByProps({ testID: 'cape-view' });
    expect(cape.props.animation).toEqual({ kind: 'spooky', id: 'ghost' });
    expect(cape.props.brightness).toBe(42);
    expect(cape.props.fog).toBeDefined();
  });

  it('starts a scan once permissions are granted', async () => {
    await render();
    expect(mockStartScan).toHaveBeenCalledTimes(1);
  });

  it('shows no overlay UI when connected', async () => {
    const tree = await render();
    expect(tree.root.findAllByProps({ testID: 'reconnect' })).toHaveLength(0);
  });

  it('when disconnected shows "tap to reconnect", which scans', async () => {
    mockBle = makeBle({ connectedDevice: null });
    const tree = await render();
    expect(texts(tree)).toContain('tap to reconnect');
    mockStartScan.mockClear();
    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: 'reconnect' }).props.onPress();
    });
    expect(mockStartScan).toHaveBeenCalledTimes(1);
  });

  it('shows "searching…" while scanning', async () => {
    mockBle = makeBle({ connectedDevice: null, isScanning: true });
    const tree = await render();
    expect(texts(tree)).toContain('searching…');
  });

  it('contains the three panes: presets, custom tiles, draw controls', async () => {
    const tree = await render();
    expect(tree.root.findAllByProps({ testID: 'halloween-ecto' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'custom-solid' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'custom-rainbow' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'draw-back' }).length).toBeGreaterThan(0);
  });

  it('tapping Rainbow in the Custom pane sends rainbow_flow', async () => {
    const tree = await render();
    ReactTestRenderer.act(() => {
      tree.root.findAllByProps({ testID: 'custom-rainbow' })[0].props.onPress();
    });
    expect(mockSendMessage).toHaveBeenCalledWith('rainbow_flow');
  });

  it('opening a color tile shows the editor; Apply sends name:hex', async () => {
    mockBle = makeBle({ currentAnimation: { kind: 'solid', colors: ['ff0000', '00ff00'] } });
    const tree = await render();
    ReactTestRenderer.act(() => {
      tree.root.findAllByProps({ testID: 'custom-solid' })[0].props.onPress();
    });
    ReactTestRenderer.act(() => {
      tree.root.findAllByProps({ testID: 'color-apply' })[0].props.onPress();
    });
    expect(mockSendMessage).toHaveBeenCalledWith('solid:ff0000,00ff00');
  });

  it('hardware back is swallowed at the top level', async () => {
    const listeners: Array<() => boolean> = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation(((_: string, cb: () => boolean) => {
      listeners.push(cb);
      return { remove: () => {} };
    }) as any);
    await render();
    expect(listeners.length).toBeGreaterThan(0);
    expect(listeners[listeners.length - 1]()).toBe(true);
    spy.mockRestore();
  });

  describe('gestures', () => {
    // Simulate a drag of (dx, dy) released with velocity (vx, vy) in dp/s.
    const drag = (testId: string, dx: number, dy: number, vx = 0, vy = 0) =>
      ReactTestRenderer.act(() => {
        fireGestureHandler(getByGestureTestId(testId), [
          { state: State.BEGAN, translationX: 0, translationY: 0 },
          { state: State.ACTIVE, translationX: 0, translationY: 0 },
          { translationX: dx / 2, translationY: dy / 2, velocityX: vx, velocityY: vy },
          { translationX: dx, translationY: dy, velocityX: vx, velocityY: vy },
          { state: State.END, translationX: dx, translationY: dy, velocityX: vx, velocityY: vy },
        ]);
      });

    it('side-pane drags run without sending anything to the cape', async () => {
      await render();
      drag('pane-center', 300, 0);
      drag('pane-left', -400, 0);
      drag('pane-center', -300, 0);
      drag('pane-right', 400, 0);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('dragging up opens Live draw (sends draw); the back button restores the animation', async () => {
      mockBle = makeBle({ currentAnimation: { kind: 'spooky', id: 'witchfire' } });
      const tree = await render();
      drag('pane-center', 0, -500);
      expect(mockSendMessage).toHaveBeenCalledWith('draw');
      mockSendMessage.mockClear();
      ReactTestRenderer.act(() => {
        tree.root.findByProps({ testID: 'draw-back' }).props.onPress();
      });
      expect(mockSendMessage).toHaveBeenCalledWith('witchfire');
    });

    it('a short slow drag up snaps back without entering draw', async () => {
      await render();
      drag('pane-center', 0, -60);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('a sideways drag does not open Live draw', async () => {
      await render();
      drag('pane-center', 200, -20);
      drag('pane-center', -200, -20);
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it('a fast flick up opens Live draw even after a short drag', async () => {
      await render();
      drag('pane-center', 0, -90, 0, -3000);
      expect(mockSendMessage).toHaveBeenCalledWith('draw');
    });
  });
});
