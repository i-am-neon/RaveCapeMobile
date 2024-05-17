import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useBLE } from '../providers/BLEProvider';

interface BrightnessSliderProps {
  initialBrightness?: number;
}

const BrightnessSlider: React.FC<BrightnessSliderProps> = ({ initialBrightness = 255 }) => {
  const [brightness, setBrightness] = useState(initialBrightness);
  const { sendMessage } = useBLE();
  const debounceRef = useRef<NodeJS.Timeout>(); // Using NodeJS.Timeout type for compatibility with setTimeout in TypeScript

  const handleValueChange = useCallback((value: number) => {
    setBrightness(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    // Set the timeout to send the message after 500ms of no changes
    debounceRef.current = setTimeout(() => {
      sendMessage(`brightness:${Math.floor(value)}`);
    }, 100);
  }, [sendMessage]);

  // Clean up the timeout on component unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* <Text style={styles.label}>Adjust Brightness</Text> */}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={255}
        step={1}
        value={brightness}
        onValueChange={handleValueChange}
        minimumTrackTintColor="#475569"
        maximumTrackTintColor="#334155"
      />
      {/* <Text style={styles.value}>{`Brightness: ${Math.floor(brightness)}`}</Text> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    padding: 20,
  },
  label: {
    fontSize: 16,
    color: '#000',
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  value: {
    fontSize: 14,
    color: '#000',
    marginTop: 10,
    textAlign: 'center',
  },
});

export default BrightnessSlider;
