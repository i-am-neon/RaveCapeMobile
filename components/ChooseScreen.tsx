import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, Modal, Dimensions } from 'react-native';
import ColorPickerPage from './ColorPickerPage';
import BrightnessSlider from './BrightnessSlider';

interface Item {
  id: string;
  title: string;
  image: any;
}

const items: Item[] = [
  { id: '1', title: 'Solid', image: require('../assets/rave_cape_icon_original.png') },
  { id: '2', title: 'Pulse', image: require('../assets/rave_cape_icon_original.png') },
  { id: '3', title: 'Flow', image: require('../assets/rave_cape_icon_original.png') },
  { id: '4', title: 'Emanate', image: require('../assets/rave_cape_icon_original.png') },
  // { id: '5', title: 'Item 5', image: require('../assets/rave_cape_icon_original.png') },
  // { id: '6', title: 'Item 6', image: require('../assets/rave_cape_icon_original.png') },
  // Add more items as needed
];

const { width } = Dimensions.get('window');
const numColumns = 2;
const itemSize = width / numColumns - 20;

const ChooseScreen = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedTitle, setSelectedTitle] = useState('');

  const openModal = useCallback((title: string) => {
    setSelectedTitle(title);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setSelectedTitle('');
  }, []);

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity style={styles.item} onPress={() => openModal(item.title)}>
      <Image source={item.image} style={styles.image} />
      <Text style={styles.itemText}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image
          source={require('../assets/rave_cape_icon_original.png')}
          style={styles.imageAvatar}
        />
      </View>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={styles.grid}
      />
      <BrightnessSlider />
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <ColorPickerPage title={selectedTitle} onClose={closeModal} />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 10,
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
    marginLeft: 'auto',
    marginRight: 'auto',
    marginTop: 25,
    marginBottom: 50,
  },
  imageAvatar: {
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  grid: {
    justifyContent: 'center',
  },
  item: {
    flex: 1,
    margin: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: itemSize,
    height: itemSize,
    backgroundColor: '#1e293b',
    borderRadius: 10,
  },
  image: {
    width: '80%',
    height: '60%',
    resizeMode: 'contain',
  },
  itemText: {
    marginTop: 8,
    textAlign: 'center',
    color: '#ffffff',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
});

export default ChooseScreen;
