import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Button, StyleSheet, Text, View } from 'react-native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import BrightnessSlider from './components/BrightnessSlider';
import ColorButtons from './components/ColorButtons';
import { useBLE } from './providers/BLEProvider';
import requestBLEPermissions from './requestBLEPermissions';
import ColorChooser from './components/ColorChooser';
import MainScreen from './components/MainScreen';
import ChooseScreen from './components/ChooseScreen';

const Tab = createMaterialTopTabNavigator();

const App = () => {
  const { connectedDevice, isScanning, startScan } = useBLE();

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
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: { display: 'none' }, // Hide the tab bar
        }}>
        <Tab.Screen name="ScreenOne" component={MainScreen} />
        <Tab.Screen name="Choose" component={ChooseScreen} />
        {/* <View style={styles.container}>
          <Text style={styles.header}>
            {isScanning ? "Scanning for devices..." : connectedDevice ? "Connected to ESP32" : "Not connected"}
          </Text>
          {!connectedDevice && !isScanning && <Button title="Scan" onPress={startScan} disabled={isScanning} />}
          <ColorButtons />
          <BrightnessSlider />
          <ColorChooser />
        </View> */}
      </Tab.Navigator>
    </NavigationContainer>
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
