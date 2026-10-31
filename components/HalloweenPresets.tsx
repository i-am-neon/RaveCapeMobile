import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useBLE } from '../providers/BLEProvider';
import { halloweenPresets } from './halloweenPresetData';
import { ACCENT, TEXT, TILE_ACTIVE_BG, TILE_BG, TILE_BORDER } from './theme';

// The 16 Halloween presets as glass tiles. The one that is playing (from the cape's
// current animation) is highlighted.
const HalloweenPresets = () => {
  const { sendMessage, currentAnimation } = useBLE();
  const activeId = currentAnimation.kind === 'spooky' ? currentAnimation.id : null;

  const handlePress = useCallback((id: string) => {
    sendMessage(id);
  }, [sendMessage]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>🎃 Halloween</Text>
      <View style={styles.grid}>
        {halloweenPresets.map((preset) => {
          const active = preset.id === activeId;
          return (
            <View key={preset.id} style={styles.cell}>
              <Pressable
                testID={`halloween-${preset.id}`}
                accessibilityRole="button"
                accessibilityLabel={preset.label}
                accessibilityState={{ selected: active }}
                onPress={() => handlePress(preset.id)}
                style={({ pressed }) => [
                  styles.tile,
                  active && styles.tileActive,
                  pressed && styles.tilePressed,
                ]}
              >
                <Text style={styles.emoji}>{preset.emoji}</Text>
                <Text style={styles.label} numberOfLines={1}>{preset.label}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    width: '25%',
    padding: 4,
  },
  tile: {
    minHeight: 84,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TILE_BG,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: TILE_BORDER,
  },
  tileActive: {
    backgroundColor: TILE_ACTIVE_BG,
    borderColor: ACCENT,
  },
  tilePressed: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ scale: 0.95 }],
  },
  emoji: {
    fontSize: 28,
    textAlign: 'center',
  },
  label: {
    marginTop: 3,
    color: TEXT,
    fontSize: 11,
    textAlign: 'center',
  },
});

export default HalloweenPresets;
