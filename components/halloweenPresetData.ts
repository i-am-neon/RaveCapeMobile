export interface HalloweenPreset {
  id: string;
  label: string;
  emoji: string;
}

// ids are sent verbatim to the cape firmware; they must match it exactly.
export const halloweenPresets: HalloweenPreset[] = [
  { id: 'bonfire', label: 'Bonfire', emoji: '🔥' },
  { id: 'ghostfire', label: 'Ghost fire', emoji: '💙' },
  { id: 'witchfire', label: 'Witch fire', emoji: '🧪' },
  { id: 'inferno', label: 'Inferno', emoji: '😈' },
  { id: 'heartbeat', label: 'Heartbeat', emoji: '❤️' },
  { id: 'ghost', label: 'Ghost breath', emoji: '👻' },
  { id: 'drip', label: 'Blood drip', emoji: '🩸' },
  { id: 'ecto', label: 'Ectoplasm', emoji: '🧟' },
  { id: 'cauldron', label: 'Cauldron', emoji: '🫧' },
  { id: 'banshee', label: 'Banshee', emoji: '😱' },
  { id: 'glitch', label: 'Glitch', emoji: '📺' },
  { id: 'reaper', label: 'Reaper', emoji: '💀' },
  { id: 'rain', label: 'Digital rain', emoji: '💚' },
  { id: 'pumpkin', label: 'Pumpkin', emoji: '🎃' },
  { id: 'candycorn', label: 'Candy corn', emoji: '🍬' },
  { id: 'aurora', label: 'Spectral veil', emoji: '🌌' },
];
