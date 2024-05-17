import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, Image, TouchableOpacity, Modal, Dimensions } from 'react-native';

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

  const openModal = (title: string) => {
    setSelectedTitle(title);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedTitle('');
  };

  const renderItem = ({ item }: { item: Item }) => (
    <TouchableOpacity style={styles.item} onPress={() => openModal(item.title)}>
      <Image source={item.image} style={styles.image} />
      <Text style={styles.itemText}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        contentContainerStyle={styles.grid}
      />
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedTitle}</Text>
            <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
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
  modalContent: {
    width: 300,
    padding: 20,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 20,
  },
  closeButton: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#1e293b',
    borderRadius: 5,
  },
  closeButtonText: {
    color: '#ffffff',
  },
});

export default ChooseScreen;
