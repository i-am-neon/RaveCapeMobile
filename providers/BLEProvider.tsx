import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import base64 from 'react-native-base64';
import { CapeAnimation } from '../cape/protocol';
import {
  applyMessage,
  CapeState,
  clampBrightness,
  DEFAULT_ANIMATION,
  MAX_BRIGHTNESS,
} from '../logic/bleState';

// Constants
const RECONNECT_DELAY_MS = 1000;
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const MESSAGE_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const DEVICE_NAME = 'RaveCapeController';
// Ask for a bigger ATT MTU so a 4-finger live-draw message fits in one write.
const REQUESTED_MTU = 185;
const DEFAULT_MTU = 23;
const BRIGHTNESS_DEBOUNCE_MS = 100;
// A fast write that hasn't completed after this long is considered lost.
const FAST_WRITE_TIMEOUT_MS = 1000;

// Define the context value types
interface BLEContextType {
  isScanning: boolean;
  connectedDevice: Device | null;
  startScan: () => void;
  // Reliable write (with response). Updates currentAnimation once the cape accepted it.
  sendMessage: (message: string) => void;
  // Low-latency write for live-draw points. Dropped if the previous fast write is still
  // in flight; never queues.
  sendFast: (message: string) => void;
  currentAnimation: CapeAnimation;
  shuffling: boolean; // the cape is moving to a new preset every minute by itself
  brightness: number; // 0..MAX_BRIGHTNESS
  setBrightness: (value: number) => void;
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
  const [capeState, setCapeState] = useState<CapeState>({
    animation: DEFAULT_ANIMATION,
    brightness: MAX_BRIGHTNESS,
    shuffling: false,
  });
  const manager = useMemo(() => new BleManager(), []);

  // Refs so the send functions keep a stable identity (live draw calls them constantly).
  const deviceRef = useRef<Device | null>(null);
  const disconnectSub = useRef<Subscription | null>(null);
  const fastStartedAt = useRef<number | null>(null);
  const fastNoResponseWorks = useRef(true);
  const brightnessTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The scanner can report the cape more than once before stopDeviceScan takes effect; a
  // second connect() cancels the first and both fail, so only one attempt runs at a time.
  const connecting = useRef(false);
  // Set once startScan exists; lets a dropped connection start a new scan by itself.
  const startScanRef = useRef<(() => void) | null>(null);

  const connectDevice = useCallback((device: Device) => {
    if (connecting.current || deviceRef.current) {
      return;
    }
    connecting.current = true;
    console.log('connecting to Device:', device.name);

    device
      .connect({ requestMTU: REQUESTED_MTU })
      .then(connected => {
        deviceRef.current = connected;
        fastStartedAt.current = null;
        fastNoResponseWorks.current = true;
        setConnectedDevice(connected);
        return connected.discoverAllServicesAndCharacteristics();
      })
      .then(ready => {
        deviceRef.current = ready;
        // Set what to do when DC is detected
        disconnectSub.current?.remove();
        disconnectSub.current = manager.onDeviceDisconnected(ready.id, () => {
          console.log('Device DC');
          deviceRef.current = null;
          fastStartedAt.current = null;
          setConnectedDevice(null);
          // Walked out of range or the cape restarted: look for it again automatically
          setTimeout(() => startScanRef.current?.(), RECONNECT_DELAY_MS);
        });

        // The characteristic holds the last message the cape received: use it to
        // initialize what's playing (and brightness).
        return ready
          .readCharacteristicForService(SERVICE_UUID, MESSAGE_UUID)
          .then(characteristic => {
            const message = base64.decode(characteristic.value ?? '');
            if (message) {
              setCapeState(prev => applyMessage(prev, message, true));
            }
          })
          .catch(error => {
            console.warn('Could not read initial message:', error);
          })
          .then(() => {
            // While shuffling, the cape notifies each new pick so the screen follows it.
            // Without notifications the app still works, so never fail the connection here.
            try {
              ready.monitorCharacteristicForService(SERVICE_UUID, MESSAGE_UUID, (error, characteristic) => {
                const message = characteristic?.value ? base64.decode(characteristic.value) : '';
                if (!error && message) {
                  setCapeState(prev => applyMessage(prev, message, true));
                }
              });
            } catch (error) {
              console.warn('Could not subscribe to cape notifications:', error);
            }
          });
      })
      .then(() => {
        console.log('Connection established');
      })
      .catch(error => {
        console.warn('Connection failed:', error);
        deviceRef.current = null;
        setConnectedDevice(null);
      })
      .finally(() => {
        connecting.current = false;
      });
  }, [manager]);

  const startScan = useCallback(() => {
    setIsScanning(true);
    // Android may still hold a link to the cape from an app instance that died; reuse it
    // instead of scanning for an advertisement that may never come.
    manager
      .connectedDevices([SERVICE_UUID])
      .then(devices => {
        const cape = devices.find(d => d.name === DEVICE_NAME) ?? devices[0];
        if (cape) {
          console.log('Reusing existing link to the cape');
          manager.stopDeviceScan();
          connectDevice(cape);
          setIsScanning(false);
        }
      })
      .catch(() => {});
    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.warn('Scan error:', error);
        setIsScanning(false);
        return;
      }

      if (device && device.name === DEVICE_NAME) {
        console.log(`Found and connecting to device: ${device.name}`);
        manager.stopDeviceScan();
        connectDevice(device);
        setIsScanning(false);
      }
    });
  }, [connectDevice, manager]);
  startScanRef.current = startScan;

  const sendMessage = useCallback((message: string) => {
    const device = deviceRef.current;
    if (!device) {
      return;
    }
    manager
      .writeCharacteristicWithResponseForDevice(
        device.id,
        SERVICE_UUID,
        MESSAGE_UUID,
        base64.encode(message),
      )
      .then(() => {
        // Brightness is owned by the slider (it may already be ahead of this write).
        if (!message.startsWith('brightness:')) {
          setCapeState(prev => applyMessage(prev, message));
        }
      })
      .catch(error => {
        console.warn('Error sending message:', error);
      });
  }, [manager]);

  const sendFast = useCallback((message: string) => {
    const device = deviceRef.current;
    if (!device) {
      return;
    }
    const startedAt = fastStartedAt.current;
    if (startedAt !== null && Date.now() - startedAt < FAST_WRITE_TIMEOUT_MS) {
      return; // previous fast write still in flight: drop, latest points win
    }
    fastStartedAt.current = Date.now();
    const encoded = base64.encode(message);
    // A write without response can't be fragmented: it must fit in one ATT packet.
    const fitsMtu = message.length <= (device.mtu ?? DEFAULT_MTU) - 3;
    const noResponse = fastNoResponseWorks.current && fitsMtu;
    const write = noResponse
      ? manager.writeCharacteristicWithoutResponseForDevice(device.id, SERVICE_UUID, MESSAGE_UUID, encoded)
      : manager.writeCharacteristicWithResponseForDevice(device.id, SERVICE_UUID, MESSAGE_UUID, encoded);
    write
      .catch(error => {
        if (noResponse) {
          fastNoResponseWorks.current = false; // fall back to acknowledged writes
        }
        console.warn('Error sending fast message:', error);
      })
      .then(() => {
        fastStartedAt.current = null;
      });
  }, [manager]);

  const setBrightness = useCallback((value: number) => {
    const next = clampBrightness(value);
    setCapeState(prev => (prev.brightness === next ? prev : { ...prev, brightness: next }));
    if (brightnessTimer.current) {
      clearTimeout(brightnessTimer.current);
    }
    brightnessTimer.current = setTimeout(() => {
      brightnessTimer.current = null;
      sendMessage(`brightness:${next}`);
    }, BRIGHTNESS_DEBOUNCE_MS);
  }, [sendMessage]);

  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
      disconnectSub.current?.remove();
      if (brightnessTimer.current) {
        clearTimeout(brightnessTimer.current);
      }
    };
  }, [manager]);

  const contextValue = useMemo<BLEContextType>(() => ({
    isScanning,
    connectedDevice,
    startScan,
    sendMessage,
    sendFast,
    currentAnimation: capeState.animation,
    shuffling: capeState.shuffling,
    brightness: capeState.brightness,
    setBrightness,
  }), [isScanning, connectedDevice, startScan, sendMessage, sendFast, capeState, setBrightness]);

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
    throw new Error('useBLE must be used within a BLEProvider');
  }
  return context;
};
