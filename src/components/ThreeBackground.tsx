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
}: ParticleLayerProps) {
  const pointsRef = useRef<Points | null>(null);

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

    pointsRef.current.rotation.y += delta * 0.018 * speed;
    pointsRef.current.rotation.x += delta * 0.006 * speed;
    pointsRef.current.rotation.z += delta * 0.004 * speed;

    pointsRef.current.position.x += (pointer.x * pointerScale - pointsRef.current.position.x) * 0.02;
    pointsRef.current.position.y += (-pointer.y * pointerScale * 0.36 - pointsRef.current.position.y) * 0.02;
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

  return (
    <div aria-hidden className={`scene-background scene-background-${profile}`}>
      <Canvas camera={{ position: [0, 0, 5], fov: 68 }} dpr={profile === "bold" ? [1, 1.55] : [1, 1.35]}>
        <ambientLight intensity={0.74} />

        <ParticleLayer
          count={density.farCount}
          spread={[22, 14, 20]}
          color={colors.far}
          size={0.02 * density.sizeScale}
          opacity={0.26 * density.opacityScale}
          speed={0.7 * density.speedScale}
          pointer={pointer}
          pointerScale={density.pointerScale * 0.9}
          paused={isPaused}
          seedOffset={1700}
        />
        <ParticleLayer
          count={density.midCount}
          spread={[16, 10, 14]}
          color={colors.mid}
          size={0.024 * density.sizeScale}
          opacity={0.39 * density.opacityScale}
          speed={0.95 * density.speedScale}
          pointer={pointer}
          pointerScale={density.pointerScale}
          paused={isPaused}
          seedOffset={2900}
        />
        <ParticleLayer
          count={density.nearCount}
          spread={[12, 8, 10]}
          color={colors.near}
          size={0.028 * density.sizeScale}
          opacity={0.56 * density.opacityScale}
          speed={1.18 * density.speedScale}
          pointer={pointer}
          pointerScale={density.pointerScale * 1.08}
          paused={isPaused}
          seedOffset={4100}
        />
      </Canvas>
    </div>
  );
}
