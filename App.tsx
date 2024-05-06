import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import useBLEDevice from './useBLEDevice'; // Assume this is your custom hook from earlier
import requestBLEPermissions from './requestBLEPermissions';

const App = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);
  const [characteristicValue, setCharacteristicValue] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const { startScan, stopScan, isScanning } = useBLEDevice();

  useEffect(() => {
    async function setup() {
      const hasPermissions = await requestBLEPermissions();
      if (!hasPermissions) {
        console.error('Permissions not granted');
        // Handle lack of permissions, e.g., notify the user or disable features
      }
    }
    setup();
  }, []);

  useEffect(() => {
    // Assume a function that handles discovered devices and updates state
    const handleDeviceDiscovered = (device: any) => {
      if (!devices.some((d) => d.id === device.id)) {
        setDevices([...devices, device]);
      }
    };

    // Add event listeners for BLE events here
    // For example, your BLE code might emit events that you can subscribe to

    return () => {
      stopScan();
      // Remove event listeners when the component unmounts
    };
  }, [stopScan, devices]);

  const connectToDevice = (device: any) => {
    // Assume a function that initiates a connection to a device
    console.log('Connecting to device', device.name);
    setConnectedDevice(device);
    // Retrieve and set the initial characteristic value
    setCharacteristicValue('Initial Value from Device'); // Placeholder
  };

  const updateCharacteristicValue = () => {
    console.log('Updating characteristic value to:', inputValue);
    // Code to write to the characteristic
    setCharacteristicValue(inputValue);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>BLE Device Scanner</Text>
      {isScanning ? (
        <Button title="Stop Scanning" onPress={stopScan} />
      ) : (
        <Button title="Start Scanning" onPress={startScan} />
      )}
      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.listItem} onPress={() => connectToDevice(item)}>
            <Text>{item.name || 'Unnamed device'}</Text>
          </TouchableOpacity>
        )}
      />
      {connectedDevice && (
        <View>
          <Text>Connected to: {connectedDevice.name}</Text>
          <Text>Characteristic Value: {characteristicValue}</Text>
          <TextInput
            style={styles.input}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="New Value"
          />
          <Button title="Update Value" onPress={updateCharacteristicValue} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  listItem: {
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginVertical: 10,
    paddingHorizontal: 10,
  },
});

export default App;
