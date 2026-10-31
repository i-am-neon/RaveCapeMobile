import React from 'react';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ReactTestRenderer from 'react-test-renderer';
import base64 from 'react-native-base64';

const mockManager: any = {};
const mockDevice: any = {};
jest.mock('react-native-ble-plx', () => ({
  BleManager: function BleManager() {
    return mockManager;
  },
}));

import { BLEProvider, useBLE } from '../providers/BLEProvider';

let ble!: ReturnType<typeof useBLE>;
const Probe = () => {
  ble = useBLE();
  return null;
};

const flush = () => ReactTestRenderer.act(async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
});

const decoded = (call: unknown[]) => base64.decode(call[3] as string);

describe('BLEProvider', () => {
  let scanCallback: (e: unknown, d: unknown) => void;
  let disconnectCallback: () => void;
  let stored: string;
  let resolveFast: (() => void) | null;
  let linked: unknown[];
  let notify: (message: string) => void;

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.useFakeTimers();
    stored = 'Hello From RaveCapeController!';
    resolveFast = null;
    linked = [];
    Object.assign(mockDevice, {
      id: 'dev1',
      name: 'RaveCapeController',
      mtu: 185,
      connect: jest.fn(() => Promise.resolve(mockDevice)),
      discoverAllServicesAndCharacteristics: jest.fn(() => Promise.resolve(mockDevice)),
      readCharacteristicForService: jest.fn(() => Promise.resolve({ value: base64.encode(stored) })),
      monitorCharacteristicForService: jest.fn((_s: string, _c: string, cb: any) => {
        notify = (message: string) => cb(null, { value: base64.encode(message) });
        return { remove: jest.fn() };
      }),
    });
    Object.assign(mockManager, {
      startDeviceScan: jest.fn((_s: unknown, _o: unknown, cb: any) => { scanCallback = cb; }),
      stopDeviceScan: jest.fn(),
      connectedDevices: jest.fn(() => Promise.resolve(linked)),
      onDeviceDisconnected: jest.fn((_id: string, cb: () => void) => {
        disconnectCallback = cb;
        return { remove: jest.fn() };
      }),
      writeCharacteristicWithResponseForDevice: jest.fn(() => Promise.resolve({})),
      writeCharacteristicWithoutResponseForDevice: jest.fn(
        () => new Promise<void>(res => { resolveFast = res; }),
      ),
    });
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<BLEProvider><Probe /></BLEProvider>);
    });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const connect = async () => {
    ReactTestRenderer.act(() => ble.startScan());
    ReactTestRenderer.act(() => scanCallback(null, mockDevice));
    await flush();
    await flush();
  };

  it('boots into rainbow at max brightness and scans for RaveCapeController only', async () => {
    expect(ble.currentAnimation).toEqual({ kind: 'rainbow_flow' });
    expect(ble.brightness).toBe(255);
    ReactTestRenderer.act(() => ble.startScan());
    expect(ble.isScanning).toBe(true);
    ReactTestRenderer.act(() => scanCallback(null, { name: 'Other', id: 'z' }));
    expect(mockDevice.connect).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => scanCallback(null, mockDevice));
    expect(mockManager.stopDeviceScan).toHaveBeenCalled();
    expect(mockDevice.connect).toHaveBeenCalledTimes(1);
    await flush();
    await flush();
  });

  it('reuses a link Android already holds to the cape instead of waiting for a scan', async () => {
    linked = [mockDevice];
    ReactTestRenderer.act(() => ble.startScan());
    await flush();
    await flush();
    expect(mockDevice.connect).toHaveBeenCalledTimes(1);
    expect(ble.connectedDevice).toBe(mockDevice);
    expect(ble.isScanning).toBe(false);
  });

  it('connects once when the scanner reports the cape twice', async () => {
    ReactTestRenderer.act(() => ble.startScan());
    ReactTestRenderer.act(() => {
      scanCallback(null, mockDevice);
      scanCallback(null, mockDevice);
    });
    await flush();
    await flush();
    expect(mockDevice.connect).toHaveBeenCalledTimes(1);
    expect(ble.connectedDevice).toBe(mockDevice);
  });

  it('can connect again after a failed attempt', async () => {
    (mockDevice.connect as jest.Mock).mockImplementationOnce(() => Promise.reject(new Error('cancelled')));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await connect();
    expect(ble.connectedDevice).toBeNull();
    await connect();
    expect(mockDevice.connect).toHaveBeenCalledTimes(2);
    expect(ble.connectedDevice).toBe(mockDevice);
  });

  it('follows the cape\'s shuffle picks from notifications', async () => {
    await connect();
    ReactTestRenderer.act(() => notify('shuffle>inferno'));
    expect(ble.shuffling).toBe(true);
    expect(ble.currentAnimation).toEqual({ kind: 'spooky', id: 'inferno' });
  });

  it('stays connected if notifications cannot be set up', async () => {
    (mockDevice as any).monitorCharacteristicForService = jest.fn(() => { throw new Error('no CCCD'); });
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await connect();
    expect(ble.connectedDevice).toBe(mockDevice);
  });

  it('initializes currentAnimation from the characteristic on connect', async () => {
    stored = 'ghostfire';
    await connect();
    expect(ble.connectedDevice).toBe(mockDevice);
    expect(ble.currentAnimation).toEqual({ kind: 'spooky', id: 'ghostfire' });
  });

  it('keeps the default when the characteristic holds the firmware greeting', async () => {
    await connect();
    expect(ble.currentAnimation).toEqual({ kind: 'rainbow_flow' });
  });

  it('starts scanning again by itself a second after the device drops', async () => {
    await connect();
    (mockManager.startDeviceScan as jest.Mock).mockClear();
    ReactTestRenderer.act(() => disconnectCallback());
    expect(ble.connectedDevice).toBeNull();
    expect(mockManager.startDeviceScan).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => { jest.advanceTimersByTime(1000); });
    expect(mockManager.startDeviceScan).toHaveBeenCalledTimes(1);
    expect(ble.isScanning).toBe(true);
    await flush();
  });

  it('goes back to disconnected when the device drops', async () => {
    await connect();
    ReactTestRenderer.act(() => disconnectCallback());
    expect(ble.connectedDevice).toBeNull();
  });

  it('sendMessage writes with response and updates currentAnimation on success', async () => {
    await connect();
    ReactTestRenderer.act(() => ble.sendMessage('pulse:ff0000,0000ff'));
    expect(decoded(mockManager.writeCharacteristicWithResponseForDevice.mock.calls[0])).toBe('pulse:ff0000,0000ff');
    expect(ble.currentAnimation).toEqual({ kind: 'rainbow_flow' }); // not until the write succeeds
    await flush();
    expect(ble.currentAnimation).toEqual({ kind: 'pulse', colors: ['ff0000', '0000ff'] });
  });

  it('does not change the animation when the write fails', async () => {
    await connect();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockManager.writeCharacteristicWithResponseForDevice.mockImplementationOnce(() => Promise.reject(new Error('x')));
    ReactTestRenderer.act(() => ble.sendMessage('reaper'));
    await flush();
    expect(ble.currentAnimation).toEqual({ kind: 'rainbow_flow' });
  });

  it('does nothing when not connected', () => {
    ble.sendMessage('reaper');
    ble.sendFast('p:0,1,2,ff0000');
    expect(mockManager.writeCharacteristicWithResponseForDevice).not.toHaveBeenCalled();
    expect(mockManager.writeCharacteristicWithoutResponseForDevice).not.toHaveBeenCalled();
  });

  it('sendFast writes without response and drops while one is in flight', async () => {
    await connect();
    ReactTestRenderer.act(() => ble.sendFast('p:0,1,2,ff0000'));
    ReactTestRenderer.act(() => ble.sendFast('p:0,3,4,ff0000'));
    ReactTestRenderer.act(() => ble.sendFast('p:0,5,6,ff0000'));
    expect(mockManager.writeCharacteristicWithoutResponseForDevice).toHaveBeenCalledTimes(1);
    expect(decoded(mockManager.writeCharacteristicWithoutResponseForDevice.mock.calls[0])).toBe('p:0,1,2,ff0000');
    await ReactTestRenderer.act(async () => {
      resolveFast!();
      await Promise.resolve();
      await Promise.resolve();
    });
    ReactTestRenderer.act(() => ble.sendFast('p:0,7,8,ff0000'));
    expect(mockManager.writeCharacteristicWithoutResponseForDevice).toHaveBeenCalledTimes(2);
  });

  it('a stuck fast write is abandoned after a second', async () => {
    await connect();
    ReactTestRenderer.act(() => ble.sendFast('p:0,1,2,ff0000'));
    jest.advanceTimersByTime(1500);
    ReactTestRenderer.act(() => ble.sendFast('p:0,3,4,ff0000'));
    expect(mockManager.writeCharacteristicWithoutResponseForDevice).toHaveBeenCalledTimes(2);
  });

  it('falls back to an acknowledged write if the message does not fit the MTU', async () => {
    mockDevice.mtu = 23;
    await connect();
    ReactTestRenderer.act(() => ble.sendFast('p:' + '0,500,500,ff0000;'.repeat(4)));
    expect(mockManager.writeCharacteristicWithoutResponseForDevice).not.toHaveBeenCalled();
    expect(mockManager.writeCharacteristicWithResponseForDevice).toHaveBeenCalledTimes(1);
  });

  it('brightness is clamped, applied at once and sent once, debounced', async () => {
    await connect();
    ReactTestRenderer.act(() => ble.setBrightness(50));
    ReactTestRenderer.act(() => ble.setBrightness(60));
    ReactTestRenderer.act(() => ble.setBrightness(9999));
    expect(ble.brightness).toBe(255);
    expect(mockManager.writeCharacteristicWithResponseForDevice).not.toHaveBeenCalled();
    ReactTestRenderer.act(() => ble.setBrightness(-20));
    expect(ble.brightness).toBe(0);
    ReactTestRenderer.act(() => { jest.advanceTimersByTime(150); });
    expect(mockManager.writeCharacteristicWithResponseForDevice).toHaveBeenCalledTimes(1);
    expect(decoded(mockManager.writeCharacteristicWithResponseForDevice.mock.calls[0])).toBe('brightness:0');
    await flush();
    expect(ble.brightness).toBe(0);
    expect(ble.currentAnimation).toEqual({ kind: 'rainbow_flow' });
  });
});
