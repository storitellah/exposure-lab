/**
 * Live viewfinder: renders the current scene with the resolved exposure
 * settings, computes the histogram, and supports touch-to-focus.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { renderScene, computeHistogram, invalidateSceneCache, type HistogramData, type Quality } from '../scenes/renderer';
import { sceneById } from '../scenes/scenes';
import type { ExposureSettings } from '../engine/settings';
import type { SensorFormat } from '../engine/optics';
import type { NoiseProfile } from '../engine/noise';

export interface SceneCanvasProps {
  sceneId: string;
  settings: ExposureSettings;
  sensor: SensorFormat;
  noiseProfile: NoiseProfile;
  quality: Quality;
  vignetting?: 'low' | 'medium' | 'high';
  onHistogram?: (h: HistogramData) => void;
  onFocusTap?: (x: number, y: number, estimatedDistM: number) => void;
  ariaLabel: string;
}

export function SceneCanvas(props: SceneCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [focusVisible, setFocusVisible] = useState(false);
  const scene = useMemo(() => sceneById(props.sceneId), [props.sceneId]);
  const histTimer = useRef<number | null>(null);
  const { onHistogram } = props;

  useEffect(() => () => invalidateSceneCache(), [props.sceneId]);

  /*
   * Rendering is scheduled on an animation frame rather than run inline.
   * Dragging a slider fires many changes per frame; coalescing them keeps
   * the main thread free and means at most one render is drawn per frame.
   * The histogram is computed a moment later so it never delays the image.
   */
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderScene(canvas, {
        scene,
        settings: props.settings,
        sensor: props.sensor,
        noiseProfile: props.noiseProfile,
        quality: props.quality,
        vignetting: props.vignetting ?? 'low',
      });
      if (onHistogram) {
        if (histTimer.current !== null) window.clearTimeout(histTimer.current);
        histTimer.current = window.setTimeout(() => {
          if (canvasRef.current) onHistogram(computeHistogram(canvasRef.current));
        }, 120);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      if (histTimer.current !== null) window.clearTimeout(histTimer.current);
    };
  }, [scene, props.settings, props.sensor, props.noiseProfile, props.quality, props.vignetting, onHistogram]);

  const handleTap = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !props.onFocusTap) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    // Estimate the tapped layer's distance: nearest layer whose vertical band
    // matches; fall back to the subject distance.
    const est = y > 0.65 ? Math.min(...scene.layers.map((l) => l.distanceM))
      : y < 0.3 ? Math.max(...scene.layers.map((l) => l.distanceM))
        : scene.subjectDistM;
    props.onFocusTap(x, y, est);
    setFocusVisible(true);
    window.setTimeout(() => setFocusVisible(false), 1600);
  };

  return (
    <div className="viewfinder">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={props.ariaLabel}
        onClick={(e) => handleTap(e.clientX, e.clientY)}
      />
      {focusVisible && (
        <span
          className="focus-ring"
          style={{
            left: `${props.settings.focusPoint.x * 100}%`,
            top: `${props.settings.focusPoint.y * 100}%`,
          }}
        />
      )}
    </div>
  );
}
