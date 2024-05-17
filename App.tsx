import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StyleSheet, SafeAreaView } from 'react-native';
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
      const hasPermissions = await requestBLEPermissions();
      if (hasPermissions) {
        startScan();
      } else {
        console.error('Permissions not granted');
      }
    }
    setup();
  }, [startScan]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* <NavigationContainer>
        <Tab.Navigator screenOptions={{ tabBarStyle: { display: 'none' } }}>
          <Tab.Screen name="ScreenOne" component={MainScreen} />
          <Tab.Screen name="Choose" component={ChooseScreen} />
        </Tab.Navigator>
      </NavigationContainer> */}
      <ChooseScreen />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
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
