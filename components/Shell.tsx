import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import CapeView from '../cape/CapeView';
import { useBLE } from '../providers/BLEProvider';
import BrightnessSlider from './BrightnessSlider';
import CustomPane from './CustomPane';
import DrawPane from './DrawPane';
import GlassPane from './GlassPane';
import HalloweenPresets from './HalloweenPresets';
import { usePaneController } from './usePaneController';

// The whole app: the cape emulation fills the screen; panes slide over it.
//   drag right -> Halloween (from the left)    drag left -> Custom (from the right)
//   drag up    -> Live draw (from the bottom, closed with its back button)
const Shell = () => {
  const { currentAnimation, brightness, connectedDevice, isScanning, startScan } = useBLE();
  const [customEditing, setCustomEditing] = useState(false);
  const {
    openPane, goTo, fog, onLayout, gestures, halloweenStyle, customStyle, drawStyle,
  } = usePaneController(!customEditing);

  // Hardware/gesture back closes the open pane. At the top level it is swallowed, so an
  // accidental edge swipe while opening Halloween can't quit the app mid-party.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openPane !== 'center') {
        goTo('center');
      }
      return true;
    });
    return () => sub.remove();
  }, [openPane, goTo]);

  const closeDraw = useCallback(() => goTo('center'), [goTo]);

  const connected = connectedDevice !== null;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <GestureDetector gesture={gestures.center}>
        <View style={StyleSheet.absoluteFill}>
          <CapeView
            animation={currentAnimation}
            brightness={brightness}
            fog={fog}
            style={StyleSheet.absoluteFill}
          />
          {!connected && (
            <Pressable
              testID="reconnect"
              accessibilityRole="button"
              accessibilityLabel={isScanning ? 'Searching for cape' : 'Tap to reconnect'}
              disabled={isScanning}
              onPress={startScan}
              style={styles.disconnected}
            >
              <Text style={styles.disconnectedText}>{isScanning ? 'searching…' : 'tap to reconnect'}</Text>
            </Pressable>
          )}
        </View>
      </GestureDetector>

      <Animated.View style={[styles.pane, halloweenStyle]}>
        <GlassPane side="left" gesture={gestures.left} footer={<BrightnessSlider />}>
          <HalloweenPresets />
        </GlassPane>
      </Animated.View>

      <Animated.View style={[styles.pane, customStyle]}>
        <GlassPane side="right" gesture={gestures.right} footer={<BrightnessSlider />}>
          <CustomPane onEditingChange={setCustomEditing} />
        </GlassPane>
      </Animated.View>

      <Animated.View style={[styles.pane, drawStyle]} pointerEvents={openPane === 'draw' ? 'auto' : 'box-none'}>
        <DrawPane active={openPane === 'draw'} onBack={closeDraw} />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  pane: {
    ...StyleSheet.absoluteFillObject,
  },
  disconnected: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disconnectedText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default Shell;
