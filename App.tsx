import React, { useCallback, useEffect } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useBLE } from './providers/BLEProvider';
import requestBLEPermissions from './requestBLEPermissions';

const App = () => {
  const { connectedDevice, isScanning, sendMessage, startScan } = useBLE();

  const sendRainbow = useCallback(async () => {
    await sendMessage('rainbow');
  }, [sendMessage]);

  const sendBlue = useCallback(async () => {
    await sendMessage('blue');
  }, [sendMessage]);

  const sendRed = useCallback(async () => {
    await sendMessage('red');
  }, [sendMessage]);

  useEffect(() => {
    async function setup() {
      const hasPermissions = await requestBLEPermissions(); // Assumes this function is defined elsewhere
      if (hasPermissions) {
        startScan();
      } else {
        console.error('Permissions not granted');
        // Handle lack of permissions, e.g., notify the user or disable features
      }
    }
    setup();
  }, [startScan]);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {isScanning ? "Scanning for devices..." : connectedDevice ? "Connected to ESP32" : "Not connected"}
      </Text>
      <Button onPress={sendRainbow} title='Rainbow' />
      <Button onPress={sendBlue} title='Blue' />
      <Button onPress={sendRed} title='Red' />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
  },
});

export default App;
