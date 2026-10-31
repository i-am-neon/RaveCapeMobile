import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ColorPicker, { Panel3, Preview, Swatches } from 'reanimated-color-picker';
import { ColorAnimation } from '../cape/protocol';
import { useBLE } from '../providers/BLEProvider';
import { buildColorMessage } from '../logic/colorMessage';
import { normalizeHex } from '../logic/strokeColor';
import { HALLOWEEN_PALETTE } from './palette';
import { ACCENT, TEXT, TEXT_DIM, TILE_BG, TILE_BORDER } from './theme';

interface ColorPickerPageProps {
  animation: ColorAnimation;
  title: string;
  initialColors?: string[];
  onClose: () => void;
}

// Inline editor shown inside the Custom pane: 1 required + 2 optional colors, then
// Apply sends `name:hex,hex`.
const ColorPickerPage: React.FC<ColorPickerPageProps> = ({ animation, title, initialColors, onClose }) => {
  const [colors, setColors] = useState<string[]>(() => {
    const start = (initialColors ?? []).slice(0, 3);
    return [start[0] ?? '', start[1] ?? '', start[2] ?? ''];
  });
  const [currentSlot, setCurrentSlot] = useState<number>(0);
  const { sendMessage } = useBLE();

  const onSelectColor = useCallback(({ hex }: { hex: string }) => {
    const clean = normalizeHex(hex);
    if (!clean) {
      return;
    }
    const wasEmpty = colors[currentSlot] === '';
    setColors(prev => prev.map((c, i) => (i === currentSlot ? clean : c)));
    // Filling an empty slot moves on to the next one; re-picking a filled slot stays put.
    if (wasEmpty && currentSlot < 2) {
      setCurrentSlot(currentSlot + 1);
    }
  }, [colors, currentSlot]);

  const clearSlot = useCallback((index: number) => {
    setColors(prev => prev.map((c, i) => (i === index ? '' : c)));
    setCurrentSlot(index);
  }, []);

  const message = buildColorMessage(animation, colors);

  const handleApply = useCallback(() => {
    if (message) {
      sendMessage(message);
      onClose();
    }
  }, [message, onClose, sendMessage]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.slots}>
        {colors.map((color, index) => {
          const dotColor = color ? `#${color}` : 'transparent';
          return (
          <View key={index} style={styles.slotWrap}>
            <TouchableOpacity
              testID={`slot-${index}`}
              accessibilityLabel={`Color ${index + 1}`}
              onPress={() => setCurrentSlot(index)}
              style={[styles.slot, index === currentSlot && styles.slotActive]}
            >
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
            </TouchableOpacity>
            <Text style={styles.slotText}>{index === 0 ? 'Required' : 'Optional'}</Text>
            {index > 0 && color !== '' && (
              <TouchableOpacity
                accessibilityLabel={`Clear color ${index + 1}`}
                hitSlop={10}
                onPress={() => clearSlot(index)}
                style={styles.clear}
              >
                <Text style={styles.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          );
        })}
      </View>
      <ColorPicker style={styles.picker} value="#ff6a00" onComplete={onSelectColor}>
        <Panel3 centerChannel="hsl-saturation" style={styles.panel} />
        <Swatches
          style={styles.swatches}
          colors={HALLOWEEN_PALETTE.map(c => `#${c}`)}
        />
        <Preview hideText hideInitialColor />
      </ColorPicker>
      <View style={styles.buttons}>
        <TouchableOpacity testID="color-cancel" onPress={onClose} style={styles.button}>
          <Text style={styles.buttonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="color-apply"
          onPress={handleApply}
          disabled={!message}
          style={[styles.button, styles.apply, !message && styles.disabled]}
        >
          <Text style={styles.buttonText}>Apply</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: TEXT,
    marginBottom: 12,
  },
  slots: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 12,
  },
  slotWrap: {
    alignItems: 'center',
  },
  slot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: TILE_BORDER,
    backgroundColor: TILE_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotActive: {
    borderColor: ACCENT,
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  slotText: {
    color: TEXT_DIM,
    fontSize: 12,
    marginTop: 4,
  },
  clear: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: TEXT,
    fontSize: 11,
  },
  picker: {
    width: '85%',
    alignItems: 'center',
  },
  panel: {
    width: '100%',
  },
  swatches: {
    marginTop: 14,
    marginBottom: 14,
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginHorizontal: 8,
    borderRadius: 14,
    backgroundColor: TILE_BG,
    borderWidth: 1,
    borderColor: TILE_BORDER,
  },
  apply: {
    backgroundColor: 'rgba(249,115,22,0.35)',
    borderColor: ACCENT,
  },
  disabled: {
    opacity: 0.35,
  },
  buttonText: {
    color: TEXT,
    fontSize: 16,
  },
});

export default ColorPickerPage;
