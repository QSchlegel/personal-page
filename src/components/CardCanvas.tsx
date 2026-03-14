"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { Mesh } from "three";

type CardVariant = "icosahedron" | "octahedron" | "torus";

interface CardCanvasProps {
  variant?: CardVariant;
  className?: string;
}

function WireframeShape({ variant, paused, color }: { variant: CardVariant; paused: boolean; color: string }) {
  const meshRef = useRef<Mesh | null>(null);

  useFrame((_state, delta) => {
    if (paused || !meshRef.current) {
      return;
    }

    meshRef.current.rotation.y += delta * 0.15;
    meshRef.current.rotation.x += delta * 0.08;
  });

  const geometry =
    variant === "torus" ? (
      <torusGeometry args={[1, 0.35, 12, 24]} />
    ) : variant === "octahedron" ? (
      <octahedronGeometry args={[1.1, 1]} />
    ) : (
      <icosahedronGeometry args={[1.1, 1]} />
    );

  return (
    <mesh ref={meshRef}>
      {geometry}
      <meshBasicMaterial wireframe color={color} opacity={0.07} transparent depthWrite={false} />
    </mesh>
  );
}

export function CardCanvas({ variant = "icosahedron", className }: CardCanvasProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);

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
    const onModeChange = () => setIsLightMode(lightMode.matches);
    onModeChange();
    lightMode.addEventListener("change", onModeChange);
    return () => lightMode.removeEventListener("change", onModeChange);
  }, []);

  if (isReducedMotion) {
    return null;
  }

  const wireColor = isLightMode ? "#3d6a8a" : "#6ec8ff";

  return (
    <div aria-hidden className={className ? `card-canvas ${className}` : "card-canvas"}>
      <Canvas camera={{ position: [0, 0, 3.2], fov: 50 }} dpr={[1, 1.5]}>
        <WireframeShape variant={variant} paused={isPaused} color={wireColor} />
      </Canvas>
    </div>
  );
}
