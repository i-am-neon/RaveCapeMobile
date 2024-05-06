import { BleManager } from 'react-native-ble-plx';
import { useCallback, useEffect, useState, useMemo } from 'react';

export default function useBLEDevice() {
  const manager = useMemo(() => new BleManager(), []);

  const [isScanning, setIsScanning] = useState(false);

  const startScan = useCallback(() => {
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error(error);
        return;
      }

      if (device) {
        console.log(`Found device: ${device.name}`);
        // Optionally stop scanning when a specific device is found
        // if (device.name === 'YourESP32DeviceName') manager.stopDeviceScan();
      }
    });
    setIsScanning(true);
  }, [manager]);

  const stopScan = useCallback(() => {
    manager.stopDeviceScan();
    setIsScanning(false);
  }, [manager]);

  useEffect(() => {
    return () => {
      stopScan(); // Clean up function
    };
  }, [stopScan]);

  return { startScan, stopScan, isScanning };
}
