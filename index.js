/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import App from './App';
import { BLEProvider } from './providers/BLEProvider';
import { name as appName } from './app.json';

// A new functional component that wraps App with BLEProvider
const AppRoot = () => {
  return (
    <BLEProvider>
      <App />
    </BLEProvider>
  );
};

AppRegistry.registerComponent(appName, () => AppRoot);
