import { useCallback, useMemo, useState } from 'react';
import { Dimensions, LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {
  ACTIVATE_DISTANCE,
  Axis,
  decidePane,
  horizontalPosition,
  lockAxis,
  Pane,
  paneFromProgress,
  targetProgress,
  verticalPosition,
} from '../logic/paneGesture';

const SPRING = { damping: 28, stiffness: 260, mass: 1, overshootClamping: true };

// Owns the pane state. Two shared values drive everything on the UI thread:
//   x in [-1, 1]: +1 = Halloween pane open (from the left), -1 = Custom pane (from the right)
//   y in [0, 1]:  1 = Live draw pane open (from the bottom)
export function usePaneController(customGestureEnabled: boolean) {
  const window = Dimensions.get('window');
  const width = useSharedValue(window.width);
  const height = useSharedValue(window.height);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const axis = useSharedValue<Axis>('none');
  const from = useSharedValue<Pane>('center');
  const [openPane, setOpenPane] = useState<Pane>('center');

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    height.value = e.nativeEvent.layout.height;
  }, [width, height]);

  // Glass fog for the cape: grows with the side panes; Live draw keeps the cape crisp.
  const fog = useDerivedValue(() => Math.min(1, Math.abs(x.value)));

  // Programmatic open/close (back button, hardware back).
  const goTo = useCallback((pane: Pane) => {
    const t = targetProgress(pane);
    x.value = withSpring(t.x, SPRING);
    y.value = withSpring(t.y, SPRING);
    setOpenPane(pane);
  }, [x, y]);

  const gestures = useMemo(() => {
    const begin = () => {
      'worklet';
      cancelAnimation(x);
      cancelAnimation(y);
      startX.value = x.value;
      startY.value = y.value;
      axis.value = 'none';
      from.value = paneFromProgress(x.value, y.value);
    };

    const settle = (vx: number, vy: number) => {
      'worklet';
      const vxs = axis.value === 'h' ? vx / width.value : 0; // screens per second
      const vys = axis.value === 'v' ? vy / height.value : 0;
      const target = decidePane({
        from: from.value,
        axis: axis.value,
        x: x.value,
        y: y.value,
        vx: vxs,
        vy: vys,
      });
      const t = targetProgress(target);
      x.value = withSpring(t.x, { ...SPRING, velocity: vxs });
      y.value = withSpring(t.y, { ...SPRING, velocity: -vys });
      runOnJS(setOpenPane)(target);
    };

    // From center: follow the finger along whichever axis it moved on first. Disabled
    // while Live draw is open: every touch there draws, and only its back button leaves.
    const center = Gesture.Pan()
      .withTestId('pane-center')
      .enabled(openPane !== 'draw')
      .activeOffsetX([-ACTIVATE_DISTANCE, ACTIVATE_DISTANCE])
      .activeOffsetY([-ACTIVATE_DISTANCE, ACTIVATE_DISTANCE])
      .onStart(begin)
      .onUpdate(e => {
        if (axis.value === 'none') {
          axis.value = lockAxis(e.translationX, e.translationY);
        }
        if (axis.value === 'h') {
          x.value = horizontalPosition(startX.value, e.translationX, width.value);
        } else if (axis.value === 'v') {
          y.value = verticalPosition(startY.value, e.translationY, height.value);
        }
      })
      .onEnd(e => settle(e.velocityX, e.velocityY));

    // Open side panes: horizontal drags close them; vertical drags fail the gesture so
    // the pane's own scrolling keeps working.
    const closePan = (testId: string, lo: number, hi: number) =>
      Gesture.Pan()
        .withTestId(testId)
        .activeOffsetX([-ACTIVATE_DISTANCE, ACTIVATE_DISTANCE])
        .failOffsetY([-ACTIVATE_DISTANCE * 1.4, ACTIVATE_DISTANCE * 1.4])
        .onStart(() => {
          begin();
          axis.value = 'h';
        })
        .onUpdate(e => {
          x.value = horizontalPosition(startX.value, e.translationX, width.value, lo, hi);
        })
        .onEnd(e => settle(e.velocityX, e.velocityY));

    return {
      center,
      left: closePan('pane-left', 0, 1),
      right: closePan('pane-right', -1, 0).enabled(customGestureEnabled),
    };
  }, [x, y, startX, startY, axis, from, width, height, customGestureEnabled, openPane]);

  const halloweenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (Math.max(0, Math.min(1, x.value)) - 1) * width.value }],
  }));
  const customStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (1 - Math.max(0, Math.min(1, -x.value))) * width.value }],
  }));
  const drawStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - Math.max(0, Math.min(1, y.value))) * height.value }],
  }));

  return { openPane, goTo, fog, onLayout, gestures, halloweenStyle, customStyle, drawStyle };
}
