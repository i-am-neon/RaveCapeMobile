import { PermissionsAndroid, Platform } from 'react-native';

export default async function requestBLEPermissions(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 23) {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    ];

    // Location permissions are necessary for BLE functionality in Android 10 and below
    if (Platform.Version < 31) {
      permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);

      // For background location access (if your app needs to scan for BLE devices in the background)
      permissions.push(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
    }

    // Request all necessary permissions
    const results = await PermissionsAndroid.requestMultiple(permissions);

    // Check if all permissions have been granted
    const allPermissionsGranted = Object.values(results).every(result => result === PermissionsAndroid.RESULTS.GRANTED);
    if (!allPermissionsGranted) {
      console.error("Not all permissions were granted:", results);
      return false;
    }

    return true;
  }
  return true; // iOS or Android version < 23 (no runtime permission needed)
}
