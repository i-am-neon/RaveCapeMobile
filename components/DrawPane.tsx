import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ColorPicker, { Panel3, Preview } from 'reanimated-color-picker';
import { CapeAnimation, toCapeMessage, toFingerUpMessage, toPointsMessage } from '../cape/protocol';
import { useBLE } from '../providers/BLEProvider';
import { createPointBatcher } from '../logic/pointBatcher';
import { createDrawSession } from '../logic/drawSession';
import { normalizeHex } from '../logic/strokeColor';
import { HALLOWEEN_PALETTE } from './palette';
import { ACCENT, GLASS_EDGE, GLASS_TINT, TEXT, TEXT_DIM } from './theme';

const MAX_COLORS = 3;
const FALLBACK_MESSAGE = 'rainbow_flow';

interface DrawPaneProps {
  active: boolean; // pane is (becoming) open
  onBack: () => void;
}

// Live draw: touches draw on the cape (up to 4 fingers) with a fading trail. Minimal and
// translucent so the crisp cape stays visible.
const DrawPane = ({ active, onBack }: DrawPaneProps) => {
  const insets = useSafeAreaInsets();
  const { sendMessage, sendFast, currentAnimation } = useBLE();
  const [slots, setSlots] = useState<string[]>(['ff6a00']); // 1-3 colors
  const [activeSlot, setActiveSlot] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerColor, setPickerColor] = useState('ff6a00');

  // Latest values for handlers that outlive a render.
  const colorsRef = useRef(slots);
  colorsRef.current = slots;
  const sizeRef = useRef({ width: 0, height: 0 });
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;
  const sendFastRef = useRef(sendFast);
  sendFastRef.current = sendFast;
  const animationRef = useRef<CapeAnimation>(currentAnimation);
  animationRef.current = currentAnimation;

  const batcher = useMemo(() => createPointBatcher({
    sendPoints: points => sendFastRef.current(toPointsMessage(points)),
    sendUp: finger => sendMessageRef.current(toFingerUpMessage(finger)),
  }), []);
  const session = useMemo(() => createDrawSession({
    getColors: () => colorsRef.current,
    getSize: () => sizeRef.current,
    batcher,
  }), [batcher]);

  // Entering the pane switches the cape to draw mode; leaving restores what was playing.
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const before = animationRef.current;
    sendMessageRef.current('draw');
    return () => {
      session.endAll();
      batcher.cancel();
      const restore = before.kind === 'draw' || before.kind === 'unknown' ? null : toCapeMessage(before);
      sendMessageRef.current(restore ?? FALLBACK_MESSAGE);
    };
  }, [active, session, batcher]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    sizeRef.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
  }, []);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    if (!active) {
      return;
    }
    e.nativeEvent.changedTouches.forEach(t => session.start(String(t.identifier), t.locationX, t.locationY));
  }, [active, session]);
  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    e.nativeEvent.touches.forEach(t => session.move(String(t.identifier), t.locationX, t.locationY));
  }, [session]);
  const onTouchEnd = useCallback((e: GestureResponderEvent) => {
    session.syncActive(e.nativeEvent.touches.map(t => String(t.identifier)));
  }, [session]);

  const setSlotColor = useCallback((index: number, color: string) => {
    setSlots(prev => {
      const next = [...prev];
      next[index] = color;
      return next;
    });
  }, []);

  const pickSwatch = useCallback((color: string) => {
    setSlotColor(activeSlot, color);
  }, [activeSlot, setSlotColor]);

  const removeSlot = useCallback((index: number) => {
    setSlots(prev => prev.filter((_, i) => i !== index));
    setActiveSlot(0);
  }, []);

  const addSlot = useCallback(() => {
    setSlots(prev => [...prev, prev[prev.length - 1]]);
    setActiveSlot(slots.length);
  }, [slots.length]);

  const applyPicker = useCallback(() => {
    setSlotColor(activeSlot, pickerColor);
    setPickerOpen(false);
  }, [activeSlot, pickerColor, setSlotColor]);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View
        testID="draw-surface"
        style={StyleSheet.absoluteFill}
        onLayout={onLayout}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      />

      <View style={[styles.top, { top: insets.top + 12 }]} pointerEvents="box-none">
        <Pressable
          testID="draw-back"
          accessibilityRole="button"
          accessibilityLabel="Back to cape"
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          {/* A chevron drawn from two rounded strokes: crisper than any font glyph */}
          <View style={styles.chevron}>
            <View style={[styles.chevronStroke, styles.chevronLeft]} />
            <View style={[styles.chevronStroke, styles.chevronRight]} />
          </View>
        </Pressable>
      </View>

      <View style={[styles.bottom, { bottom: insets.bottom + 12 }]}>
        <View style={styles.slotRow}>
          {slots.map((color, index) => (
            <View key={index} style={styles.slotWrap}>
              <Pressable
                testID={`draw-slot-${index}`}
                accessibilityLabel={`Stroke color ${index + 1}`}
                onPress={() => setActiveSlot(index)}
                style={[styles.slot, { backgroundColor: `#${color}` }, index === activeSlot && styles.slotActive]}
              />
              {index > 0 && (
                <Pressable
                  testID={`draw-slot-remove-${index}`}
                  accessibilityLabel={`Remove color ${index + 1}`}
                  hitSlop={8}
                  onPress={() => removeSlot(index)}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              )}
            </View>
          ))}
          {slots.length < MAX_COLORS && (
            <Pressable
              testID="draw-add-slot"
              accessibilityLabel="Add a color"
              onPress={addSlot}
              style={[styles.slot, styles.addSlot]}
            >
              <Text style={styles.addText}>+</Text>
            </Pressable>
          )}
        </View>
        <View style={styles.palette}>
          {HALLOWEEN_PALETTE.map(color => (
            <Pressable
              key={color}
              testID={`draw-swatch-${color}`}
              accessibilityLabel={`Pick #${color}`}
              onPress={() => pickSwatch(color)}
              style={[styles.swatch, { backgroundColor: `#${color}` }]}
            />
          ))}
          <Pressable
            testID="draw-custom-color"
            accessibilityLabel="Pick a custom color"
            onPress={() => {
              setPickerColor(slots[activeSlot] ?? 'ff6a00');
              setPickerOpen(true);
            }}
            style={[styles.swatch, styles.customSwatch]}
          >
            <Text style={styles.customText}>🎨</Text>
          </Pressable>
        </View>
      </View>

      {pickerOpen && (
        <View style={styles.scrim}>
          <View style={styles.pickerCard}>
            <ColorPicker
              style={styles.picker}
              value={`#${pickerColor}`}
              onComplete={({ hex }) => {
                const clean = normalizeHex(hex);
                if (clean) {
                  setPickerColor(clean);
                }
              }}
            >
              <Panel3 centerChannel="hsl-saturation" style={styles.panel} />
              <Preview hideText hideInitialColor style={styles.preview} />
            </ColorPicker>
            <View style={styles.pickerButtons}>
              <Pressable onPress={() => setPickerOpen(false)} style={styles.pickerButton}>
                <Text style={styles.pickerButtonText}>Cancel</Text>
              </Pressable>
              <Pressable testID="draw-picker-apply" onPress={applyPicker} style={[styles.pickerButton, styles.pickerApply]}>
                <Text style={styles.pickerButtonText}>Use color</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  top: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  back: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  backPressed: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    transform: [{ scale: 0.94 }],
  },
  chevron: {
    width: 20,
    height: 12,
    marginTop: 3,
  },
  chevronStroke: {
    position: 'absolute',
    top: 4,
    width: 13,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  chevronLeft: {
    left: 0,
    transform: [{ rotate: '38deg' }],
  },
  chevronRight: {
    right: 0,
    transform: [{ rotate: '-38deg' }],
  },
  bottom: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: GLASS_TINT,
    borderWidth: 1,
    borderColor: GLASS_EDGE,
    alignItems: 'center',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  slotWrap: {
    marginHorizontal: 8,
  },
  slot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  slotActive: {
    borderColor: ACCENT,
    borderWidth: 3,
  },
  addSlot: {
    marginHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  addText: {
    color: TEXT_DIM,
    fontSize: 24,
    lineHeight: 28,
  },
  remove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    color: TEXT,
    fontSize: 11,
  },
  palette: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    margin: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  customSwatch: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customText: {
    fontSize: 18,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCard: {
    width: '85%',
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(8,10,20,0.92)',
    borderWidth: 1,
    borderColor: GLASS_EDGE,
    alignItems: 'center',
  },
  picker: {
    width: '100%',
    alignItems: 'center',
  },
  panel: {
    width: '100%',
  },
  preview: {
    marginTop: 14,
  },
  pickerButtons: {
    flexDirection: 'row',
    marginTop: 16,
  },
  pickerButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  pickerApply: {
    backgroundColor: 'rgba(249,115,22,0.4)',
  },
  pickerButtonText: {
    color: TEXT,
    fontSize: 16,
  },
});

export default DrawPane;
