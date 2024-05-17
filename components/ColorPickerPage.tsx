import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ColorPicker, { Panel3, Preview, Swatches } from 'reanimated-color-picker';

interface ColorPickerPageProps {
  title: string;
  onClose: () => void;
}

const ColorPickerPage: React.FC<ColorPickerPageProps> = ({ title, onClose }) => {
  const [colors, setColors] = useState<string[]>(['', '', '']);
  const [currentSlot, setCurrentSlot] = useState<number>(0);

  const onSelectColor = useCallback(({ hex }: { hex: string }) => {
    const newColors = [...colors];
    newColors[currentSlot] = hex;
    setColors(newColors);
    if (currentSlot < 2) {
      setCurrentSlot(currentSlot + 1);
    }
  }, [colors, currentSlot]);

  const handleBack = useCallback(() => {
    if (currentSlot > 0) {
      setCurrentSlot(currentSlot - 1);
    }
  }, [currentSlot]);

  const handleComplete = useCallback(() => {
    console.log(colors);
    onClose();
  }, [colors, onClose]);

  return (
    <View style={styles.modalContainer}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{title}</Text>
        <View style={styles.colorSlotsContainer}>
          {colors.map((color, index) => (
            <View key={index} style={styles.colorSlot}>
              <View
                style={[
                  styles.colorPlaceholder,
                  { backgroundColor: color || '#e5e7eb' },
                ]}
              />
              <Text style={styles.colorSlotText}>
                {index === 0 ? 'Required' : 'Optional'}
              </Text>
            </View>
          ))}
        </View>
        <ColorPicker style={styles.colorPicker} value='red' onComplete={onSelectColor}>
          <Panel3 centerChannel='saturation' style={styles.panel3} />
          <Swatches />
          <Preview hideText hideInitialColor />
        </ColorPicker>
        <View style={styles.buttonContainer}>
          {currentSlot > 0 && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.buttonText}>Back</Text>
            </TouchableOpacity>
          )}
          {currentSlot === 0 && (
            <TouchableOpacity onPress={handleComplete} style={styles.completeButton}>
              <Text style={styles.buttonText}>Complete</Text>
            </TouchableOpacity>
          )}
        </View>
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
  colorSlotsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  colorSlot: {
    alignItems: 'center',
  },
  colorPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 5,
  },
  colorSlotText: {
    color: '#ffffff',
    fontSize: 14,
  },
  colorPicker: {
    width: '100%',
    alignItems: 'center',
  },
  panel3: {
    width: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
  backButton: {
    padding: 10,
    backgroundColor: '#1e293b',
    borderRadius: 5,
    marginRight: 10,
  },
  completeButton: {
    padding: 10,
    backgroundColor: '#1e293b',
    borderRadius: 5,
  },
  buttonText: {
    color: '#ffffff',
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
