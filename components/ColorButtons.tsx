import React, { useCallback } from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { useBLE } from '../providers/BLEProvider';

const ColorButtons = () => {
  const { sendMessage } = useBLE();

  const sendRainbowFlow = useCallback(async () => {
    await sendMessage('rainbow_flow');
  }, [sendMessage]);

  const sendBlue = useCallback(async () => {
    await sendMessage('blue');
  }, [sendMessage]);

  const sendRed = useCallback(async () => {
    await sendMessage('red');
  }, [sendMessage]);

  const pulseOneColor = useCallback(async () => {
    await sendMessage('pulse_one_color:00FF00');
  }, [sendMessage]);

  const emanateOneColor = useCallback(async () => {
    await sendMessage('emanate_one_color:FF0000');
  }, [sendMessage]);

  const emanateMultColors = useCallback(async () => {
    await sendMessage('emanate:FF0000,00FF00');
  }, [sendMessage]);

  const flowOneColor = useCallback(async () => {
    await sendMessage('flow_one_color:00FF00');
  }, [sendMessage]);

  const testRainbow = useCallback(async () => {
    await sendMessage('flow:FF0000,00FF00,0000FF');
  }, [sendMessage]);

  const gradientRedToYellow = useCallback(async () => {
    await sendMessage('solid:FF0000,FFFF00');
  }, [sendMessage]);

  const gradientBlueToRedToGreen = useCallback(async () => {
    await sendMessage('solid:0000FF,FF0000,00FF00');
  }, [sendMessage]);

  const gradientBlueToTealToBrown = useCallback(async () => {
    await sendMessage('solid:0000FF,008080,A52A2A');
  }, [sendMessage]);

  const pulseSunset = useCallback(async () => {
    await sendMessage('pulse:833ab4,fd1d1d,fcb045');
  }, [sendMessage]);

  return (
    <View style={styles.buttonGrid}>
      <Button onPress={sendRainbowFlow} title='Rainbow Flow' />
      <Button onPress={sendBlue} title='Blue' />
      <Button onPress={sendRed} title='Red' />
      <Button onPress={pulseOneColor} title='Pulse One Color' />
      <Button onPress={emanateOneColor} title='Emanate One Color' />
      <Button onPress={emanateMultColors} title='Emanate Mult Colors' />
      <Button onPress={flowOneColor} title='Flow One Color' />
      <Button onPress={testRainbow} title='🌈' />
      <Button onPress={gradientRedToYellow} title='Gradient Red to Yellow' />
      <Button onPress={gradientBlueToRedToGreen} title='Gradient Blue to Red to Green' />
      <Button onPress={gradientBlueToTealToBrown} title='Gradient Blue to Teal to Brown' />
      <Button onPress={pulseSunset} title='PULSE 🌅' />
    </View>
  );
};

const styles = StyleSheet.create({
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%', // Ensure the grid takes full container width
  }
});

export default ColorButtons;
