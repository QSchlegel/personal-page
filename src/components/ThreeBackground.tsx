"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Points } from "three";

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function ParticleField({ paused, lightMode }: { paused: boolean; lightMode: boolean }) {
  const pointsRef = useRef<Points | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });

  const positions = useMemo(() => {
    const count = 1400;
    const values = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const stride = index * 3;
      values[stride] = (pseudoRandom(index + 1) - 0.5) * 12;
      values[stride + 1] = (pseudoRandom(index + 1001) - 0.5) * 8;
      values[stride + 2] = (pseudoRandom(index + 2001) - 0.5) * 10;
    }

    return values;
  }, []);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      setPointer({ x, y });
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  useFrame((_state, delta) => {
    if (paused || !pointsRef.current) {
      return;
    }

    pointsRef.current.rotation.y += delta * 0.03;
    pointsRef.current.rotation.x += delta * 0.008;

    pointsRef.current.position.x += (pointer.x * 0.5 - pointsRef.current.position.x) * 0.03;
    pointsRef.current.position.y += (-pointer.y * 0.2 - pointsRef.current.position.y) * 0.03;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={lightMode ? "#1c64c0" : "#76d8ff"}
        size={lightMode ? 0.028 : 0.024}
        sizeAttenuation
        transparent
        opacity={lightMode ? 0.82 : 0.55}
        depthWrite={false}
      />
    </points>
  );
}

export function ThreeBackground() {
  const [isPaused, setIsPaused] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onVisibility = () => {
      setIsPaused(document.visibilityState !== "visible" || reducedMotion.matches);
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

  return (
    <div aria-hidden className="scene-background">
      <Canvas camera={{ position: [0, 0, 5], fov: 68 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.7} />
        <ParticleField paused={isPaused} lightMode={isLightMode} />
      </Canvas>
    </div>
  );
}
