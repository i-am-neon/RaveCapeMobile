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
    await sendMessage('emanate_one_color:0x00FF00');
  }, [sendMessage]);

  const flowOneColor = useCallback(async () => {
    await sendMessage('flow_one_color:0x00FF00');
  }, [sendMessage]);

  return (
    <View style={styles.buttonGrid}>
      <Button onPress={sendRainbowFlow} title='Rainbow Flow' />
      <Button onPress={sendBlue} title='Blue' />
      <Button onPress={sendRed} title='Red' />
      <Button onPress={pulseOneColor} title='Pulse One Color' />
      <Button onPress={emanateOneColor} title='Emanate One Color' />
      <Button onPress={flowOneColor} title='Flow One Color' />
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
