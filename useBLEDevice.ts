import { BleManager } from 'react-native-ble-plx';
import { useCallback, useEffect, useMemo } from 'react';

export default function useBLEDevice(setConnected: (connected: boolean) => void, setIsScanning: (scanning: boolean) => void) {
  const manager = useMemo(() => new BleManager(), []);

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
        setIsScanning(false);
        setConnected(true);
        // Additional connection logic can go here if needed
      }
    });
  }, [manager, setIsScanning, setConnected]);

  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
    };
  }, [manager]);

  return { startScan };
}
