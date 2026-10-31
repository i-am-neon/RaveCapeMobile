import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useBLE } from '../providers/BLEProvider';
import { MAX_BRIGHTNESS } from '../logic/bleState';
import { ACCENT, TEXT_DIM } from './theme';

// Shared by both side panes: the value lives in BLEProvider, which also debounces the send.
const BrightnessSlider = () => {
  const { brightness, setBrightness } = useBLE();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>☀</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={MAX_BRIGHTNESS}
        step={1}
        value={brightness}
        onValueChange={setBrightness}
        minimumTrackTintColor={ACCENT}
        maximumTrackTintColor="rgba(255,255,255,0.25)"
        thumbTintColor="#ffffff"
        accessibilityLabel="Brightness"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  icon: {
    color: TEXT_DIM,
    fontSize: 20,
    marginRight: 8,
  },
  slider: {
    flex: 1,
    height: 48,
  },
});

export default BrightnessSlider;
