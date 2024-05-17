import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ColorPickerPageProps {
  title: string;
  onClose: () => void;
}

const ColorPickerPage: React.FC<ColorPickerPageProps> = ({ title, onClose }) => {
  return (
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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

export default ColorPickerPage;
