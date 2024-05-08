import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import useBLEDevice from './useBLEDevice'; // Custom hook for BLE device management
import requestBLEPermissions from './requestBLEPermissions';
import BouncyCheckbox from "react-native-bouncy-checkbox";

const App = () => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const { startScan, sendBoxValue, sendMessage } = useBLEDevice(setIsConnected, setIsScanning);
  const [boxvalue, setBoxValue] = useState(false);

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
        {isScanning ? "Scanning for devices..." : isConnected ? "Connected to ESP32" : "Not connected"}
      </Text>
      <BouncyCheckbox
        onPress={() => {
          sendBoxValue(!boxvalue);
          setBoxValue(!boxvalue);
        }}
      />
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
