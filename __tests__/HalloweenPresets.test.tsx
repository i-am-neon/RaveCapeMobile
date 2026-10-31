import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ReactTestRenderer from 'react-test-renderer';
import HalloweenPresets from '../components/HalloweenPresets';
import { halloweenPresets } from '../components/halloweenPresetData';

const mockSendMessage = jest.fn<(m: string) => void>();
let mockCurrentAnimation: unknown = { kind: 'rainbow_flow' };
jest.mock('../providers/BLEProvider', () => ({
  useBLE: () => ({ sendMessage: mockSendMessage, currentAnimation: mockCurrentAnimation }),
}));

const EXPECTED_IDS = [
  'bonfire', 'ghostfire', 'witchfire', 'inferno', 'heartbeat', 'ghost',
  'drip', 'ecto', 'cauldron', 'banshee', 'glitch', 'reaper', 'rain',
  'pumpkin', 'candycorn', 'aurora',
];

const render = () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<HalloweenPresets />);
  });
  return tree;
};

const tileStyle = (tree: ReactTestRenderer.ReactTestRenderer, id: string) => {
  const node = tree.root.findByProps({ testID: `halloween-${id}` });
  const style = typeof node.props.style === 'function'
    ? node.props.style({ pressed: false })
    : node.props.style;
  return JSON.stringify(style);
};

describe('halloween presets', () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
    mockCurrentAnimation = { kind: 'rainbow_flow' };
  });

  it('has exactly the 16 expected ids, in order, with no duplicates', () => {
    const ids = halloweenPresets.map((p) => p.id);
    expect(ids).toEqual(EXPECTED_IDS);
    expect(new Set(ids).size).toBe(16);
    halloweenPresets.forEach((p) => {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.emoji.length).toBeGreaterThan(0);
    });
  });

  it.each(EXPECTED_IDS)('pressing %s sends exactly its id', (id) => {
    const tree = render();
    ReactTestRenderer.act(() => {
      tree.root.findByProps({ testID: `halloween-${id}` }).props.onPress();
    });
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockSendMessage).toHaveBeenCalledWith(id);
  });

  it('highlights only the preset that is currently playing', () => {
    const tree = render();
    const idle = tileStyle(tree, 'ecto');
    mockCurrentAnimation = { kind: 'spooky', id: 'ecto' };
    ReactTestRenderer.act(() => {
      tree.update(<HalloweenPresets />);
    });
    const active = tileStyle(tree, 'ecto');
    expect(active).not.toEqual(idle);
    expect(tileStyle(tree, 'pumpkin')).toEqual(idle);
    mockCurrentAnimation = { kind: 'spooky', id: 'pumpkin' };
    ReactTestRenderer.act(() => {
      tree.update(<HalloweenPresets />);
    });
    expect(tileStyle(tree, 'ecto')).toEqual(idle);
    expect(tileStyle(tree, 'pumpkin')).toEqual(active);
  });

  it('highlights nothing while a non-preset animation plays', () => {
    const tree = render();
    const idle = tileStyle(tree, 'ecto');
    halloweenPresets.forEach((p) => expect(tileStyle(tree, p.id)).toEqual(idle));
  });
});
