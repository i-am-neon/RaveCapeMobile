// Live cape renderer: simulates the cape on the JS thread at 50 ticks/s, records one SkPicture
// per tick (the 8 x 60 LED colors as a tiny image, stretched over the screen with smooth
// filtering), and hands it to Skia through a Reanimated shared
// value. Skia replays the picture - plus the blur/fog image filters - on the UI thread, so
// React never re-renders per frame and fog changes (driven by a gesture shared value) animate
// without touching JS at all.
//
// Why not 480 <Circle/> elements: that is 480 React elements reconciled 50x/s on the JS thread.
// Why not simulate on the UI thread (useFrameCallback): the designs are ordinary classes /
// closures; making them worklets would tie the pure model to Reanimated and break its tests.
// JS cost per tick is measured and logged in dev ([CapeView] ... every ~5 s).

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import {
  AlphaType,
  Blur,
  ColorType,
  FilterMode,
  MipmapMode,
  Canvas,
  ColorMatrix,
  Fill,
  Group,
  Paint,
  Picture,
  Skia,
} from '@shopify/react-native-skia';
import type { SkPicture } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { LED_COUNT, L, S, TICK, createAnimator, outputInto } from './model';
import { toCapeMessage } from './protocol';
import type { CapeAnimation } from './protocol';

// ---- Look: an abstract field, not LEDs. Each LED fills its cell of an 8 x 60 grid covering
// the whole screen; a heavy blur melts the cells into big washes of color like the diffused
// cape, and a wider glow on top adds bloom. Shown at full display brightness (the cape's
// brightness setting is for the LEDs, not the phone). ----
const FIELD_SIGMA_PER_COLUMN = 0.55; // blur, as a fraction of one strip column's width
const FIELD_GAIN = 1.25;
const GLOW_SIGMA_PER_COLUMN = 1.6; // wide bloom
const GLOW_GAIN = 0.55;
const DISPLAY_BRIGHTNESS = 255;

// ---- Fog (frosted glass panes): extra blur and dimming at fog = 1 ----
const FOG_BLUR = 32; // extra Gaussian sigma in dp
const FOG_DIM = 0.5; // opacity lost at fog = 1

const MAX_CATCH_UP_TICKS = 5; // after a stall, don't fast-forward more than this
const LOG_INTERVAL_MS = 5000;

// Scales RGB, leaves alpha. The layers are opaque (black fill inside), so this brightens.
const gainMatrix = (gain: number) => [
  gain, 0, 0, 0, 0,
  0, gain, 0, 0, 0,
  0, 0, gain, 0, 0,
  0, 0, 0, 1, 0,
];
const FIELD_MATRIX = gainMatrix(FIELD_GAIN);
const GLOW_MATRIX = gainMatrix(GLOW_GAIN);

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

function emptyPicture(): SkPicture {
  const recorder = Skia.PictureRecorder();
  recorder.beginRecording();
  return recorder.finishRecordingAsPicture();
}

const styles = StyleSheet.create({
  canvas: { flex: 1, backgroundColor: '#000' },
});

export interface CapeViewProps {
  animation: CapeAnimation;
  /** 0-255, same scale as the firmware's brightness: message. */
  brightness: number;
  /** 0..1 frosted-glass amount. A SharedValue animates on the UI thread with no re-renders. */
  fog?: SharedValue<number> | number;
  style?: StyleProp<ViewStyle>;
}

export default function CapeView({
  animation,
  brightness,
  fog = 0,
  style,
}: CapeViewProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize(prev =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  // Latest props, read by the render loop without restarting it.
  const brightnessRef = useRef(brightness);
  brightnessRef.current = brightness;
  const animationRef = useRef(animation);
  animationRef.current = animation;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  // The animation object identity may change every parent render; its message is the identity.
  const animationKey = toCapeMessage(animation) ?? 'unknown';
  const ready = size.width > 0 && size.height > 0;

  const initialPicture = useMemo(emptyPicture, []);
  const picture = useSharedValue<SkPicture>(initialPicture);

  useEffect(() => {
    if (!ready) {
      return;
    }
    const animator = createAnimator(
      animationRef.current,
      () => brightnessRef.current,
    );
    const out = new Uint8Array(LED_COUNT * 3);
    const recorder = Skia.PictureRecorder();
    // One pixel per LED: column = strip, row = LED. Drawing it as an image is a single call
    // into Skia per frame, where 480 drawRects would be ~1000 JS-to-native calls.
    const pixels = new Uint8Array(LED_COUNT * 4);
    const imageInfo = {
      width: S,
      height: L,
      colorType: ColorType.RGBA_8888,
      alphaType: AlphaType.Opaque,
    };
    const imageRect = Skia.XYWHRect(0, 0, S, L);

    let screenRect = Skia.XYWHRect(0, 0, 0, 0);
    const layout = () => {
      const { width, height } = sizeRef.current;
      if (width !== screenRect.width || height !== screenRect.height) {
        screenRect = Skia.XYWHRect(0, 0, width, height);
      }
    };

    let tick = 0;
    let last = now();
    let accumulated = 0;
    let raf = 0;
    let frames = 0;
    let spent = 0;
    let lastLog = last;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t0 = now();
      accumulated += Math.min(t0 - last, MAX_CATCH_UP_TICKS * TICK * 1000);
      last = t0;
      const steps = Math.floor(accumulated / (TICK * 1000));
      if (steps < 1) {
        return;
      }
      accumulated -= steps * TICK * 1000;
      layout();

      for (let i = 0; i < steps; i++) {
        animator.step(tick++ * TICK);
      }
      outputInto(animator.frame, DISPLAY_BRIGHTNESS, out);

      for (let st = 0; st < S; st++) {
        for (let l = 0; l < L; l++) {
          const from = (st * L + l) * 3;
          const to = (l * S + st) * 4;
          pixels[to] = out[from];
          pixels[to + 1] = out[from + 1];
          pixels[to + 2] = out[from + 2];
          pixels[to + 3] = 255;
        }
      }
      const image = Skia.Image.MakeImage(imageInfo, Skia.Data.fromBytes(pixels), S * 4);
      const canvas = recorder.beginRecording();
      if (image) {
        canvas.drawImageRectOptions(image, imageRect, screenRect, FilterMode.Linear, MipmapMode.None);
      }
      picture.value = recorder.finishRecordingAsPicture();

      if (__DEV__) {
        spent += now() - t0;
        frames++;
        if (t0 - lastLog >= LOG_INTERVAL_MS) {
          console.log(
            `[CapeView] ${animationKey}: avg simulate+record ${(
              spent / frames
            ).toFixed(2)} ms/frame ` +
              `over ${frames} frames (${(
                (frames * 1000) /
                (t0 - lastLog)
              ).toFixed(1)} fps, budget ${TICK * 1000} ms)`,
          );
          frames = 0;
          spent = 0;
          lastLog = t0;
        }
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      animator.dispose();
    };
  }, [ready, animationKey, picture]);

  // ---- Fog: number or shared value -> one shared value the UI thread can read ----
  const fogLocal = useSharedValue(typeof fog === 'number' ? fog : 0);
  useEffect(() => {
    if (typeof fog === 'number') {
      fogLocal.value = fog;
    }
  }, [fog, fogLocal]);
  const fogSource = typeof fog === 'number' ? fogLocal : fog;
  const fogBlur = useDerivedValue(
    () => Math.max(0, Math.min(1, fogSource.value)) * FOG_BLUR,
  );
  const fogOpacity = useDerivedValue(
    () => 1 - FOG_DIM * Math.max(0, Math.min(1, fogSource.value)),
  );

  const column = size.width / S;
  const fieldSigma = Math.max(1, column * FIELD_SIGMA_PER_COLUMN);
  const glowSigma = Math.max(1, column * GLOW_SIGMA_PER_COLUMN);

  return (
    <Canvas style={[styles.canvas, style]} onLayout={onLayout}>
      <Fill color="black" />
      {/* Fog layer: blur + dim everything below as one unit */}
      <Group
        layer={
          <Paint opacity={fogOpacity}>
            <Blur blur={fogBlur} mode="clamp" />
          </Paint>
        }>
        <Fill color="black" />
        {/* The color field: cells melted together; clamp keeps the screen edges bright */}
        <Group
          layer={
            <Paint blendMode="plus">
              <Blur blur={fieldSigma} mode="clamp" />
              <ColorMatrix matrix={FIELD_MATRIX} />
            </Paint>
          }>
          <Fill color="black" />
          <Picture picture={picture} />
        </Group>
        {/* Wide bloom on top */}
        <Group
          layer={
            <Paint blendMode="plus">
              <Blur blur={glowSigma} mode="clamp" />
              <ColorMatrix matrix={GLOW_MATRIX} />
            </Paint>
          }>
          <Fill color="black" />
          <Picture picture={picture} />
        </Group>
      </Group>
    </Canvas>
  );
}
