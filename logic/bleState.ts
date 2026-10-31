import { CapeAnimation, parseCapeMessage, SHUFFLE, SHUFFLE_PREFIX } from '../cape/protocol';

// The slider's full range. Full brightness is safe for the power banks because the firmware
// caps every strip at the power of the rainbow at full brightness, whatever the slider says.
export const MAX_BRIGHTNESS = 255;
export const DEFAULT_ANIMATION: CapeAnimation = { kind: 'rainbow_flow' };

export function clampBrightness(value: number): number {
  if (!Number.isFinite(value)) {
    return MAX_BRIGHTNESS;
  }
  return Math.max(0, Math.min(MAX_BRIGHTNESS, Math.floor(value)));
}

export interface CapeState {
  animation: CapeAnimation;
  brightness: number;
  shuffling: boolean; // the cape is picking a new preset every minute by itself
}

// New state after a message was sent to / is stored on the cape.
// - brightness:N updates brightness only
// - animation messages update the animation only
// - when `fromRead` (the characteristic's stored value on connect), garbage such as the
//   firmware's initial greeting is ignored, and p:/u: means the cape is in draw mode.
// - shuffle starts shuffling; shuffle>X (a pick notified or stored by the cape) means
//   shuffling and playing X; any other animation message stops shuffling, as on the cape.
export function applyMessage(state: CapeState, message: string, fromRead = false): CapeState {
  if (message === SHUFFLE) {
    return { ...state, shuffling: true };
  }
  if (message.startsWith(SHUFFLE_PREFIX)) {
    const picked = parseCapeMessage(message);
    return picked === null ? state : { ...state, animation: picked, shuffling: true };
  }
  if (message.startsWith('brightness:')) {
    const value = Number(message.slice('brightness:'.length));
    return Number.isNaN(value) ? state : { ...state, brightness: clampBrightness(value) };
  }
  if (message.startsWith('p:') || message.startsWith('u:')) {
    // Live-draw points also stop the cape's shuffle
    if (fromRead) {
      return { ...state, animation: { kind: 'draw' }, shuffling: false };
    }
    return state.shuffling ? { ...state, shuffling: false } : state;
  }
  const animation = parseCapeMessage(message);
  if (animation === null || (fromRead && animation.kind === 'unknown')) {
    return state;
  }
  return { ...state, animation, shuffling: false };
}
