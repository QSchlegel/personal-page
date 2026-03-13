"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Points } from "three";

interface CardParticlesProps {
  /** Number of particles (default 60) */
  count?: number;
  /** Particle color (default cyan) */
  color?: string;
  /** Base speed multiplier (default 1) */
  speed?: number;
  /** Seed offset for deterministic randomness */
  seed?: number;
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function Particles({
  count,
  color,
  speed,
  seed,
}: Required<CardParticlesProps>) {
  const pointsRef = useRef<Points | null>(null);

  const positions = useMemo(() => {
    const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const stride = i * 3;
      values[stride] = (pseudoRandom(i + seed) - 0.5) * 6;
      values[stride + 1] = (pseudoRandom(i + seed + 1000) - 0.5) * 4;
      values[stride + 2] = (pseudoRandom(i + seed + 2000) - 0.5) * 3;
    }
    return values;
  }, [count, seed]);

  useFrame((_state, delta) => {
    if (!pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.03 * speed;
    pointsRef.current.rotation.x += delta * 0.01 * speed;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={0.025}
        sizeAttenuation
        transparent
        opacity={0.4}
        depthWrite={false}
      />
    </points>
  );
}

export function CardParticles({
  count = 60,
  color = "#6ec8ff",
  speed = 1,
  seed = 0,
}: CardParticlesProps) {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mq.matches);
    const handler = () => setIsReducedMotion(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (isReducedMotion) return null;

  return (
    <div className="card-particles" aria-hidden>
      <Canvas
        camera={{ position: [0, 0, 4], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: false, powerPreference: "low-power" }}
      >
        <Particles count={count} color={color} speed={speed} seed={seed} />
      </Canvas>
    </div>
  );
}
