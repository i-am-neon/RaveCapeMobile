import { useCallback, useEffect, useMemo } from 'react';
import base64 from 'react-native-base64';
import { BleManager, Device } from 'react-native-ble-plx';

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';

const MESSAGE_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export default function useBLEDevice(setConnectedDevice: (device: Device | null) => void, setIsScanning: (scanning: boolean) => void, connectedDevice: Device | null) {
  const manager = useMemo(() => new BleManager(), []);

  async function sendBoxValue(value: boolean) {
    console.log('sending box value :>> ', value);
    manager.writeCharacteristicWithResponseForDevice(
      connectedDevice?.id ?? '',
      SERVICE_UUID,
      MESSAGE_UUID,
      base64.encode(value.toString()),
    ).then(characteristic => {
      console.log('Boxvalue changed to :', base64.decode(characteristic.value ?? ''));
    }).catch(error => {
      console.error('Error writing characteristic:', error);
    });
  }

  async function sendMessage(message: string) {
    console.log('⏳ sending message :>> ', message);
    manager.writeCharacteristicWithResponseForDevice(
      connectedDevice?.id ?? '',
      SERVICE_UUID,
      MESSAGE_UUID,
      base64.encode(message.toString()),
    ).then(characteristic => {
      console.log('✅ message successfully sent:', base64.decode(characteristic.value ?? ''));
    }).catch(error => {
      console.error('Error sending message:', error);
    });
  }

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

        //BoxValue
        device
          .readCharacteristicForService(SERVICE_UUID, MESSAGE_UUID)
          .then(valenc => {
            // setBoxValue(StringToBool(base64.decode(valenc?.value)));
            console.log(
              'Box Value:',
              (base64.decode(valenc?.value ?? '')) ||
              'No box value found',
            );
          });

        //monitor values and tell what to do when receiving an update

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
        setIsScanning(false);
        setConnectedDevice(device);
        // Additional connection logic can go here if needed
        connectDevice(device);
      }
    });
  }, [setIsScanning, manager, setConnectedDevice, connectDevice]);


  useEffect(() => {
    return () => {
      manager.stopDeviceScan();
    };
  }, [manager]);

  return { startScan, sendBoxValue, sendMessage };
}
