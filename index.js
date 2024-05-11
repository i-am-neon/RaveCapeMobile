/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import { BLEProvider } from './providers/BLEProvider';
import { name as appName } from './app.json';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// A new functional component that wraps App with BLEProvider
const AppRoot = () => {
  return (
    <BLEProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <App />
      </GestureHandlerRootView>
    </BLEProvider>
  );
};

AppRegistry.registerComponent(appName, () => AppRoot);
