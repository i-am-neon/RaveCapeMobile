import React from 'react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ReactTestRenderer from 'react-test-renderer';
import CustomPane from '../components/CustomPane';

const mockSendMessage = jest.fn<(m: string) => void>();
let mockShuffling = false;
let mockCurrentAnimation: unknown = { kind: 'rainbow_flow' };
jest.mock('../providers/BLEProvider', () => ({
  useBLE: () => ({
    sendMessage: mockSendMessage,
    currentAnimation: mockCurrentAnimation,
    shuffling: mockShuffling,
  }),
}));

const render = () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<CustomPane onEditingChange={() => {}} />);
  });
  return tree;
};

const selected = (tree: ReactTestRenderer.ReactTestRenderer, testID: string) =>
  tree.root.findByProps({ testID }).props.accessibilityState.selected;

describe('custom pane shuffle', () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
    mockShuffling = false;
    mockCurrentAnimation = { kind: 'rainbow_flow' };
  });

  it('the shuffle tile tells the cape to shuffle', () => {
    const tree = render();
    ReactTestRenderer.act(() => tree.root.findByProps({ testID: 'custom-shuffle' }).props.onPress());
    expect(mockSendMessage).toHaveBeenCalledWith('shuffle');
  });

  it('highlights shuffle, not the rainbow, while the cape shuffles onto the rainbow', () => {
    mockShuffling = true;
    const tree = render();
    expect(selected(tree, 'custom-shuffle')).toBe(true);
    const rainbowStyle = JSON.stringify(
      tree.root.findByProps({ testID: 'custom-rainbow' }).props.style({ pressed: false }),
    );
    const shuffleStyle = JSON.stringify(
      tree.root.findByProps({ testID: 'custom-shuffle' }).props.style({ pressed: false }),
    );
    expect(rainbowStyle).not.toEqual(shuffleStyle);
  });

  it('rainbow still works on its own', () => {
    const tree = render();
    expect(selected(tree, 'custom-shuffle')).toBe(false);
    ReactTestRenderer.act(() => tree.root.findByProps({ testID: 'custom-rainbow' }).props.onPress());
    expect(mockSendMessage).toHaveBeenCalledWith('rainbow_flow');
  });
});
