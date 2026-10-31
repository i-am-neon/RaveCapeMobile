import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { ColorAnimation, SHUFFLE } from '../cape/protocol';
import { useBLE } from '../providers/BLEProvider';
import { COLOR_ANIMATIONS } from '../logic/colorMessage';
import ColorPickerPage from './ColorPickerPage';
import { ACCENT, TEXT, TILE_ACTIVE_BG, TILE_BG, TILE_BORDER } from './theme';

const GLYPHS: Record<ColorAnimation, string> = {
  solid: '■',
  pulse: '◉',
  flow: '≋',
  emanate: '◎',
};

interface CustomPaneProps {
  // The editor has draggable color panels, so the pane's close-drag is paused while open.
  onEditingChange: (editing: boolean) => void;
}

// Top half of the old app: Solid / Pulse / Flow / Emanate + rainbow, as glass tiles.
const CustomPane = ({ onEditingChange }: CustomPaneProps) => {
  const { sendMessage, currentAnimation, shuffling } = useBLE();
  const [editing, setEditing] = useState<ColorAnimation | null>(null);

  const setEditingBoth = useCallback(
    (value: ColorAnimation | null) => {
      setEditing(value);
      onEditingChange(value !== null);
    },
    [onEditingChange],
  );

  if (editing) {
    const title = COLOR_ANIMATIONS.find(a => a.name === editing)?.title ?? '';
    return (
      <ColorPickerPage
        animation={editing}
        title={title}
        initialColors={
          currentAnimation.kind === editing
            ? currentAnimation.colors
            : undefined
        }
        onClose={() => setEditingBoth(null)}
      />
    );
  }

  const rainbowActive = currentAnimation.kind === 'rainbow_flow';

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Custom</Text>
      <View style={styles.grid}>
        {COLOR_ANIMATIONS.map(({ name, title }) => {
          const active = currentAnimation.kind === name;
          const colors =
            currentAnimation.kind === name ? currentAnimation.colors : [];
          return (
            <View key={name} style={styles.cell}>
              <Pressable
                testID={`custom-${name}`}
                accessibilityRole="button"
                accessibilityLabel={title}
                accessibilityState={{ selected: active }}
                onPress={() => setEditingBoth(name)}
                style={({ pressed }) => [
                  styles.tile,
                  active && styles.tileActive,
                  pressed && styles.tilePressed,
                ]}>
                <Text style={styles.glyph}>{GLYPHS[name]}</Text>
                <Text style={styles.label}>{title}</Text>
                <View style={styles.dots}>
                  {colors.map((c, i) => (
                    <View
                      key={i}
                      style={[styles.dot, { backgroundColor: `#${c}` }]}
                    />
                  ))}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View style={styles.row}>
        <Pressable
          testID="custom-rainbow"
          accessibilityRole="button"
          accessibilityLabel="Rainbow"
          accessibilityState={{ selected: rainbowActive }}
          onPress={() => sendMessage('rainbow_flow')}
          style={({ pressed }) => [
            styles.tile,
            styles.rainbow,
            rainbowActive && !shuffling && styles.tileActive,
            pressed && styles.tilePressed,
          ]}>
          <Text style={styles.rainbowText}>🌈</Text>
        </Pressable>
        <Pressable
          testID="custom-shuffle"
          accessibilityRole="button"
          accessibilityLabel="Shuffle presets every minute"
          accessibilityState={{ selected: shuffling }}
          onPress={() => sendMessage(SHUFFLE)}
          style={({ pressed }) => [
            styles.tile,
            styles.rainbow,
            shuffling && styles.tileActive,
            pressed && styles.tilePressed,
          ]}>
          <Text style={styles.rainbowText}>🔀</Text>
          <Text style={styles.label}>
            {shuffling ? 'Shuffling · 1 min' : 'Shuffle'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  heading: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 8,
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    padding: 6,
  },
  tile: {
    minHeight: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TILE_BG,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: TILE_BORDER,
  },
  tileActive: {
    backgroundColor: TILE_ACTIVE_BG,
    borderColor: ACCENT,
  },
  tilePressed: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ scale: 0.97 }],
  },
  glyph: {
    color: TEXT,
    fontSize: 30,
  },
  label: {
    color: TEXT,
    fontSize: 16,
    marginTop: 4,
  },
  dots: {
    flexDirection: 'row',
    height: 14,
    marginTop: 6,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  row: {
    flexDirection: 'row',
  },
  rainbow: {
    flex: 1,
    minHeight: 84,
    marginHorizontal: 6,
    marginTop: 6,
  },
  rainbowText: {
    fontSize: 38,
  },
});

export default CustomPane;
