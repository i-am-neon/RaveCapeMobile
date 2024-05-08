import React, { createContext, useContext, useState, ReactNode, Context } from 'react';
import useBLEDevice from './useBLEDevice';
import { Device } from 'react-native-ble-plx';

// Define the context value types
interface BLEContextType {
  isScanning: boolean;
  connectedDevice: Device | null;
  startScan: () => void;
  sendBoxValue: (value: boolean) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
}

// Creating the context
const BLEContext: Context<BLEContextType | null> = createContext<BLEContextType | null>(null);

// Provider component props type
interface BLEProviderProps {
  children: ReactNode;
}

// Provider component
export const BLEProvider = ({ children }: BLEProviderProps) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);

  const bleServices = useBLEDevice(setConnectedDevice, setIsScanning, connectedDevice);

  // Ensuring the provided values match the expected types
  const contextValue: BLEContextType = {
    isScanning,
    connectedDevice,
    ...bleServices
  };

  return (
    <BLEContext.Provider value={contextValue}>
      {children}
    </BLEContext.Provider>
  );
};

// Hook to use the BLE context
export const useBLE = (): BLEContextType => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error("useBLE must be used within a BLEProvider");
  }
  return context;
};
