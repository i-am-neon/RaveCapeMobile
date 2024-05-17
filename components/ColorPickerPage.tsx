import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ColorPicker, { Panel3, Preview, Swatches } from 'reanimated-color-picker';

interface ColorPickerPageProps {
  title: string;
  onClose: () => void;
}

const ColorPickerPage: React.FC<ColorPickerPageProps> = ({ title, onClose }) => {
  const onSelectColor = ({ hex }: { hex: string }) => {
    console.log(hex);
  };

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{title}</Text>
        <ColorPicker style={styles.colorPicker} value='red' onComplete={onSelectColor}>
          <Panel3 centerChannel='saturation' style={styles.panel3} />
          <Swatches />
          <Preview hideText hideInitialColor />
        </ColorPicker>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '90%',
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
  colorPicker: {
    width: '100%',
    alignItems: 'center',
  },
  panel3: {
    width: '100%', // Adjust to take full width
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
