import React from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import { useBLE } from '../providers/BLEProvider';

const MainScreen = () => {
  const { currentAnimation, currentColors } = useBLE();
  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={require('../assets/rave_cape_icon_original.png')}
          style={styles.image}
        />
      </View>
      <Text style={styles.text}>Main Screen</Text>
      <Text style={styles.text}>{currentAnimation}</Text>
      <Text style={styles.text}>{currentColors}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a', // Change this color to your desired background color
  },
  imageContainer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#475569',
  },
  image: {
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  text: {
    marginTop: 16,
    textAlign: 'center',
    color: '#ffffff',
  },
});

export default MainScreen;
