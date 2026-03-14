"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Points } from "three";

import type { MotionProfile } from "@/config/routes";

interface DensityProfile {
  nearCount: number;
  midCount: number;
  farCount: number;
  sizeScale: number;
  opacityScale: number;
  pointerScale: number;
  speedScale: number;
}

interface ParticleLayerProps {
  count: number;
  spread: [number, number, number];
  color: string;
  size: number;
  opacity: number;
  speed: number;
  pointer: { x: number; y: number };
  pointerScale: number;
  paused: boolean;
  seedOffset: number;
  driftAmplitude?: number;
  driftFrequency?: number;
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getDensityProfile(profile: MotionProfile, width: number, reducedMotion: boolean): DensityProfile {
  const desktop = width >= 1180;
  const tablet = width >= 760;

  const base =
    profile === "bold"
      ? {
          nearCount: 2200,
          midCount: 1400,
          farCount: 850,
          sizeScale: 1,
          opacityScale: 1,
          pointerScale: 0.82,
          speedScale: 1,
        }
      : {
          nearCount: 1300,
          midCount: 860,
          farCount: 520,
          sizeScale: 0.92,
          opacityScale: 0.92,
          pointerScale: 0.55,
          speedScale: 0.72,
        };

  const viewportFactor = desktop ? 1 : tablet ? 0.72 : 0.48;
  const reductionFactor = reducedMotion ? 0.24 : 1;
  const factor = viewportFactor * reductionFactor;

  return {
    nearCount: Math.round(base.nearCount * factor),
    midCount: Math.round(base.midCount * factor),
    farCount: Math.round(base.farCount * factor),
    sizeScale: reducedMotion ? base.sizeScale * 0.85 : base.sizeScale,
    opacityScale: reducedMotion ? base.opacityScale * 0.86 : base.opacityScale,
    pointerScale: reducedMotion ? 0 : base.pointerScale,
    speedScale: reducedMotion ? 0.08 : base.speedScale,
  };
}

function ParticleLayer({
  count,
  spread,
  color,
  size,
  opacity,
  speed,
  pointer,
  pointerScale,
  paused,
  seedOffset,
  driftAmplitude = 0,
  driftFrequency = 0,
}: ParticleLayerProps) {
  const pointsRef = useRef<Points | null>(null);
  const elapsed = useRef(0);

  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const stride = index * 3;
      const seed = index + seedOffset;
      values[stride] = (pseudoRandom(seed + 1) - 0.5) * spread[0];
      values[stride + 1] = (pseudoRandom(seed + 1001) - 0.5) * spread[1];
      values[stride + 2] = (pseudoRandom(seed + 2001) - 0.5) * spread[2];
    }

    return values;
  }, [count, seedOffset, spread]);

  useFrame((_state, delta) => {
    if (paused || !pointsRef.current) {
      return;
    }

    elapsed.current += delta;

    pointsRef.current.rotation.y += delta * 0.018 * speed;
    pointsRef.current.rotation.x += delta * 0.006 * speed;
    pointsRef.current.rotation.z += delta * 0.004 * speed;

    const driftX = Math.sin(elapsed.current * driftFrequency) * driftAmplitude;
    const driftY = Math.cos(elapsed.current * driftFrequency * 0.7) * driftAmplitude * 0.5;
    const driftZ = Math.sin(elapsed.current * driftFrequency * 0.4 + 1.2) * driftAmplitude * 0.8;

    pointsRef.current.position.x += (pointer.x * pointerScale + driftX - pointsRef.current.position.x) * 0.02;
    pointsRef.current.position.y += (-pointer.y * pointerScale * 0.36 + driftY - pointsRef.current.position.y) * 0.02;
    pointsRef.current.position.z += (driftZ - pointsRef.current.position.z) * 0.015;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
      />
    </points>
  );
}

export function ThreeBackground({ profile }: { profile: MotionProfile }) {
  const [isPaused, setIsPaused] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onVisibility = () => {
      const shouldPause = document.visibilityState !== "visible" || reducedMotion.matches;
      setIsPaused(shouldPause);
      setIsReducedMotion(reducedMotion.matches);
    };

    onVisibility();

    document.addEventListener("visibilitychange", onVisibility);
    reducedMotion.addEventListener("change", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", onVisibility);
    };
  }, []);

  useEffect(() => {
    const lightMode = window.matchMedia("(prefers-color-scheme: light)");

    const onModeChange = () => {
      setIsLightMode(lightMode.matches);
    };

    onModeChange();
    lightMode.addEventListener("change", onModeChange);

    return () => {
      lightMode.removeEventListener("change", onModeChange);
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
    };

    onResize();
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (isReducedMotion) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      const x = clamp((event.clientX / window.innerWidth) * 2 - 1, -1, 1);
      const y = clamp((event.clientY / window.innerHeight) * 2 - 1, -1, 1);
      setPointer({ x, y });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [isReducedMotion]);

  const density = useMemo(
    () => getDensityProfile(profile, viewportWidth, isReducedMotion),
    [profile, viewportWidth, isReducedMotion],
  );

  const colors = isLightMode
    ? {
        near: "#6b7f96",
        mid: "#8f9eb0",
        far: "#b3bcc8",
      }
    : {
        near: "#98aec3",
        mid: "#71879f",
        far: "#5b6f86",
      };

  const fogColor = isLightMode ? "#e8ecf0" : "#0d1117";

  return (
    <div aria-hidden className={`scene-background scene-background-${profile}`}>
      <Canvas camera={{ position: [0, 0, 8], fov: 75 }} dpr={profile === "bold" ? [1, 1.55] : [1, 1.35]}>
        <fog attach="fog" args={[fogColor, 18, 52]} />
        <ambientLight intensity={0.74} />

        <ParticleLayer
          count={density.farCount}
          spread={[38, 24, 36]}
          color={colors.far}
          size={0.03 * density.sizeScale}
          opacity={0.22 * density.opacityScale}
          speed={0.5 * density.speedScale}
          pointer={pointer}
          pointerScale={density.pointerScale * 0.6}
          paused={isPaused}
          seedOffset={1700}
          driftAmplitude={1.8}
          driftFrequency={0.12}
        />
        <ParticleLayer
          count={density.midCount}
          spread={[28, 18, 26]}
          color={colors.mid}
          size={0.032 * density.sizeScale}
          opacity={0.36 * density.opacityScale}
          speed={0.8 * density.speedScale}
          pointer={pointer}
          pointerScale={density.pointerScale * 0.85}
          paused={isPaused}
          seedOffset={2900}
          driftAmplitude={1.2}
          driftFrequency={0.18}
        />
        <ParticleLayer
          count={density.nearCount}
          spread={[18, 12, 18]}
          color={colors.near}
          size={0.035 * density.sizeScale}
          opacity={0.52 * density.opacityScale}
          speed={1.05 * density.speedScale}
          pointer={pointer}
          pointerScale={density.pointerScale * 1.15}
          paused={isPaused}
          seedOffset={4100}
          driftAmplitude={0.6}
          driftFrequency={0.25}
        />
      </Canvas>
    </div>
  );
}
