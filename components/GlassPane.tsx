import React, { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GLASS_EDGE, GLASS_TINT } from './theme';

interface GlassPaneProps {
  // Which screen edge the pane slides in from; the highlight sits on its inner edge.
  side: 'left' | 'right';
  // Drag-to-close gesture. It wraps only `children`, so the `footer` (the brightness
  // slider) never fights with it.
  gesture: ComponentProps<typeof GestureDetector>['gesture'];
  footer?: ReactNode;
  children: ReactNode;
}

// A dark, foggy sheet of glass: the (blurred) cape shows through the translucent tint.
// The app draws behind the system bars, so the pane pads itself clear of them.
const GlassPane = ({ side, gesture, footer, children }: GlassPaneProps) => {
  const insets = useSafeAreaInsets();
  return (
  <View
    style={[
      styles.pane,
      { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
      side === 'left' ? styles.edgeRight : styles.edgeLeft,
    ]}
  >
    <GestureDetector gesture={gesture}>
      <View style={styles.content}>{children}</View>
    </GestureDetector>
    {footer}
    <View
      pointerEvents="none"
      style={[styles.grabber, side === 'left' ? styles.grabberRight : styles.grabberLeft]}
    />
  </View>
  );
};

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    backgroundColor: GLASS_TINT,
  },
  edgeRight: {
    borderRightWidth: 1,
    borderRightColor: GLASS_EDGE,
  },
  edgeLeft: {
    borderLeftWidth: 1,
    borderLeftColor: GLASS_EDGE,
  },
  content: {
    flex: 1,
  },
  grabber: {
    position: 'absolute',
    top: '45%',
    width: 4,
    height: 56,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  grabberRight: {
    right: 6,
  },
  grabberLeft: {
    left: 6,
  },
});

export default GlassPane;
