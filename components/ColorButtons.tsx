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

  return (
    <View style={styles.buttonGrid}>
      <Button onPress={sendRainbowFlow} title='Rainbow Flow' />
      <Button onPress={sendBlue} title='Blue' />
      <Button onPress={sendRed} title='Red' />
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
