import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useBLE } from './providers/BLEProvider';
import requestBLEPermissions from './requestBLEPermissions';
import Shell from './components/Shell';

const App = () => {
  const { startScan } = useBLE();

  useEffect(() => {
    async function setup() {
      const hasPermissions = await requestBLEPermissions();
      if (hasPermissions) {
        startScan();
      } else {
        console.warn('Bluetooth permissions not granted');
      }
    }
    setup();
  }, [startScan]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaProvider>
        <Shell />
      </SafeAreaProvider>
    </>
  );
};

export default App;
