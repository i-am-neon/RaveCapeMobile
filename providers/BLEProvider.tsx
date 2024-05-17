import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';
import { BleManager, Device } from 'react-native-ble-plx';
import base64 from 'react-native-base64';

// Constants
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const MESSAGE_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

// Define the context value types
interface BLEContextType {
  isScanning: boolean;
  connectedDevice: Device | null;
  startScan: () => void;
  sendMessage: (message: string) => void;
  currentAnimation?: string;
  currentColors?: string[];
}

// Creating the context
const BLEContext = createContext<BLEContextType | null>(null);

// Provider component props type
interface BLEProviderProps {
  children: ReactNode;
}

// Provider component
export const BLEProvider = ({ children }: BLEProviderProps) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string>();
  const [currentColors, setCurrentColors] = useState<string[]>([]);
  const manager = useMemo(() => new BleManager(), []);

  const connectDevice = useCallback((device: Device) => {
    console.log('connecting to Device:', device.name);

    device
      .connect()
      .then(() => {
        setConnectedDevice(device);
        return device.discoverAllServicesAndCharacteristics();
      })
      .then(() => {
        //  Set what to do when DC is detected
        manager.onDeviceDisconnected(device.id, () => {
          console.log('Device DC');
          setConnectedDevice(null);
        });

        //Read inital values

        //Message
        device
          .readCharacteristicForService(SERVICE_UUID, MESSAGE_UUID)
          .then(valenc => {
            // setMessage(base64.decode(valenc?.value));
            console.log('Message:', base64.decode(valenc?.value ?? '') || 'No message found');
          });

        //Message
        device.monitorCharacteristicForService(
          SERVICE_UUID,
          MESSAGE_UUID,
          (error, characteristic) => {
            if (characteristic?.value != null) {
              // setMessage(base64.decode(characteristic?.value));
              console.log('Message update received: ', base64.decode(characteristic?.value));
              console.log(
                'Message update received: ',
                base64.decode(characteristic?.value),
              );
            }
          },
          'messagetransaction',
        );

        //BoxValue
        device.monitorCharacteristicForService(
          SERVICE_UUID,
          MESSAGE_UUID,
          (error, characteristic) => {
            if (characteristic?.value != null) {
              // setBoxValue(StringToBool(base64.decode(characteristic?.value)));
              console.log('Box Value update received: ', base64.decode(characteristic?.value));
              console.log(
                'Box Value update received: ',
                base64.decode(characteristic?.value),
              );
            }
          },
          'boxtransaction',
        );

        console.log('Connection established');
      });
  }, [manager, setConnectedDevice]);

  const startScan = useCallback(() => {
    setIsScanning(true);
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        setIsScanning(false);
        return;
      }

      if (device && device.name === 'RaveCapeController') {
        console.log(`Found and connecting to device: ${device.name}`);
        manager.stopDeviceScan();
        connectDevice(device);
        setIsScanning(false);
      }
    });
  }, [connectDevice, manager]);

  const sendMessage = useCallback((message: string) => {
    console.log('⏳ sending message :>> ', message);
    manager.writeCharacteristicWithResponseForDevice(
      connectedDevice?.id ?? '',
      SERVICE_UUID,
      MESSAGE_UUID,
      base64.encode(message.toString()),
    ).then(characteristic => {
      console.log('✅ message successfully sent:', base64.decode(characteristic.value ?? ''));
      const animation = message.split(':')[0];
      const colors = message.split(':')[1].split(',');
      setCurrentAnimation(animation);
      setCurrentColors(colors);
    }).catch(error => {
      console.error('Error sending message:', error);
    });
  }, [connectedDevice?.id, manager]);

  useEffect(() => {
    return () => manager.stopDeviceScan();
  }, [manager]);

  const contextValue: BLEContextType = {
    isScanning,
    connectedDevice,
    startScan,
    sendMessage,
    currentAnimation,
    currentColors,
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
