"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

/* Depth layout: users far back (neg-Z), DBs up front (pos-Z) */
const LB_POS: [number, number, number] = [0, 0, -1.8];

const SERVER_POSITIONS: [number, number, number][] = [
  [-2.0, 0, 0.4],
  [0, 0, 0.4],
  [2.0, 0, 0.4],
];

const DB_PRIMARY: [number, number, number] = [-1.0, 0, 2.2];
const DB_REPLICA: [number, number, number] = [1.0, 0, 2.2];

const USER_Z = -4.2;
const USER_SPREAD = 3.2;
const USER_COUNT = 5;

/* ------------------------------------------------------------------ */
/*  Deterministic pseudo-random                                        */
/* ------------------------------------------------------------------ */

function seededRandom(seed: number): number {
  const v = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/* ------------------------------------------------------------------ */
/*  Rounded-rect shape helper                                          */
/* ------------------------------------------------------------------ */

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/* ------------------------------------------------------------------ */
/*  Glow ring around load balancer                                     */
/* ------------------------------------------------------------------ */

function GlowRing({ color, paused }: { color: string; paused: boolean }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_s, delta) => {
    if (paused || !ref.current) return;
    ref.current.rotation.z -= delta * 0.6;
  });

  return (
    <mesh ref={ref} position={[LB_POS[0], 0.01, LB_POS[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.38, 0.44, 32]} />
      <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Node (server / DB / LB box)                                        */
/* ------------------------------------------------------------------ */

interface NodeProps {
  position: [number, number, number];
  width: number;
  height: number;
  label: string;
  color: string;
  accentColor: string;
  fontSize?: number;
}

function Node({ position, width, height, label, color, accentColor, fontSize = 0.13 }: NodeProps) {
  const shape = useMemo(() => roundedRectShape(width, height, 0.08), [width, height]);

  const textCanvas = useMemo(() => {
    const c = document.createElement("canvas");
    const s = 256;
    c.width = s;
    c.height = s;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = accentColor;
    ctx.font = `bold ${Math.round(s * 0.18)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, s / 2, s / 2);
    return c;
  }, [label, accentColor]);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(textCanvas);
    t.needsUpdate = true;
    return t;
  }, [textCanvas]);

  return (
    <group position={position}>
      {/* outline – flat on ground (XZ plane) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} />
      </mesh>
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.ShapeGeometry(shape)]} />
        <lineBasicMaterial color={color} transparent opacity={0.55} />
      </lineSegments>
      {/* label – billboard sprite stays readable */}
      <sprite scale={[fontSize * 5, fontSize * 5, 1]} position={[0, 0.35, 0]}>
        <spriteMaterial map={texture} transparent />
      </sprite>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Static connection lines                                            */
/* ------------------------------------------------------------------ */

function ConnectionLine({ from, to, color }: { from: [number, number, number]; to: [number, number, number]; color: string }) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([...from, ...to], 3));
    return g;
  }, [from, to]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.18} />
    </lineSegments>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated traffic particles                                         */
/* ------------------------------------------------------------------ */

interface TrafficRoute {
  from: [number, number, number];
  to: [number, number, number];
  delay: number;
  speed: number;
}

function TrafficParticles({
  routes,
  color,
  paused,
}: {
  routes: TrafficRoute[];
  color: string;
  paused: boolean;
}) {
  const count = routes.length;
  const ref = useRef<THREE.Points>(null);

  const offsets = useMemo(() => routes.map((r) => r.delay), [routes]);
  const speeds = useMemo(() => routes.map((r) => r.speed), [routes]);
  const initialPositions = useMemo(() => new Float32Array(count * 3), [count]);
  const sizes = useMemo(() => {
    const s = new Float32Array(count);
    s.fill(0.045);
    return s;
  }, [count]);

  const clockRef = useRef(0);

  useFrame((_state, delta) => {
    if (paused || !ref.current) return;
    clockRef.current += delta;
    const t = clockRef.current;
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const pos = attr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const route = routes[i];
      const progress = ((t * speeds[i] + offsets[i]) % 1 + 1) % 1;

      pos[i * 3] = route.from[0] + (route.to[0] - route.from[0]) * progress;
      pos[i * 3 + 1] = route.from[1] + (route.to[1] - route.from[1]) * progress;
      pos[i * 3 + 2] = route.from[2] + (route.to[2] - route.from[2]) * progress;
    }

    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[initialPositions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.06} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Health pulse (tiny dot that blinks per server)                     */
/* ------------------------------------------------------------------ */

function HealthPulse({
  position,
  color,
  paused,
  seed,
}: {
  position: [number, number, number];
  color: string;
  paused: boolean;
  seed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const offset = seededRandom(seed) * Math.PI * 2;

  useFrame(({ clock }) => {
    if (paused || !ref.current) return;
    const pulse = 0.4 + 0.6 * ((Math.sin(clock.getElapsedTime() * 2.5 + offset) + 1) / 2);
    (ref.current.material as THREE.MeshBasicMaterial).opacity = pulse * 0.7;
  });

  return (
    <mesh ref={ref} position={[position[0] + 0.32, 0.02, position[2] - 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.04, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.5} />
    </mesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Replication sync arrow between DBs                                 */
/* ------------------------------------------------------------------ */

function ReplicationArrow({ color, paused }: { color: string; paused: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const count = 4;
  const initialPositions = useMemo(() => new Float32Array(count * 3), []);

  useFrame(({ clock }) => {
    if (paused || !ref.current) return;
    const t = clock.getElapsedTime();
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const pos = attr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const progress = ((t * 0.4 + i * 0.25) % 1 + 1) % 1;
      pos[i * 3] = DB_PRIMARY[0] + (DB_REPLICA[0] - DB_PRIMARY[0]) * progress;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = DB_PRIMARY[2];
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[initialPositions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.04} sizeAttenuation transparent opacity={0.55} depthWrite={false} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene composition                                                  */
/* ------------------------------------------------------------------ */

function Scene({ paused, isLightMode }: { paused: boolean; isLightMode: boolean }) {
  const accent = isLightMode ? "#2a6496" : "#6ec8ff";
  const green = isLightMode ? "#2d8a4e" : "#5dea8b";
  const lineColor = isLightMode ? "#5a7a96" : "#3a5a72";
  const trafficColor = isLightMode ? "#3582b8" : "#8ed8ff";
  const dbColor = isLightMode ? "#8a6c2a" : "#f5c45a";
  const replicaLine = isLightMode ? "#7a6832" : "#c8a844";

  /* Build traffic routes (depth: neg-Z = far, pos-Z = near) */
  const routes = useMemo<TrafficRoute[]>(() => {
    const result: TrafficRoute[] = [];

    /* Users → LB (from far back toward LB) */
    for (let i = 0; i < USER_COUNT; i++) {
      const ux = (i / (USER_COUNT - 1) - 0.5) * USER_SPREAD;
      result.push({
        from: [ux, 0, USER_Z],
        to: [LB_POS[0], 0, LB_POS[2] + 0.25],
        delay: seededRandom(i * 7 + 1),
        speed: 0.35 + seededRandom(i * 3 + 2) * 0.25,
      });
    }

    /* LB → Servers */
    for (let s = 0; s < SERVER_POSITIONS.length; s++) {
      const sp = SERVER_POSITIONS[s];
      for (let p = 0; p < 3; p++) {
        result.push({
          from: [LB_POS[0], 0, LB_POS[2] + 0.25],
          to: [sp[0], 0, sp[2] - 0.22],
          delay: seededRandom(s * 11 + p * 3 + 10),
          speed: 0.5 + seededRandom(s * 5 + p + 20) * 0.3,
        });
      }
    }

    /* Servers → DB Primary */
    for (let s = 0; s < SERVER_POSITIONS.length; s++) {
      const sp = SERVER_POSITIONS[s];
      for (let p = 0; p < 2; p++) {
        result.push({
          from: [sp[0], 0, sp[2] + 0.22],
          to: [DB_PRIMARY[0], 0, DB_PRIMARY[2] - 0.2],
          delay: seededRandom(s * 13 + p + 40),
          speed: 0.4 + seededRandom(s * 7 + p + 50) * 0.2,
        });
      }
    }

    return result;
  }, []);

  /* User dots (far back in Z) */
  const userPositions = useMemo(() => {
    const arr: [number, number, number][] = [];
    for (let i = 0; i < USER_COUNT; i++) {
      arr.push([(i / (USER_COUNT - 1) - 0.5) * USER_SPREAD, 0, USER_Z]);
    }
    return arr;
  }, []);

  return (
    <>
      {/* Users (far back) */}
      {userPositions.map((pos, i) => (
        <mesh key={`user-${i}`} position={pos} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.08, 16]} />
          <meshBasicMaterial color={accent} transparent opacity={0.5} />
        </mesh>
      ))}

      {/* Connection lines: users → LB */}
      {userPositions.map((pos, i) => (
        <ConnectionLine key={`ul-${i}`} from={pos} to={[LB_POS[0], 0, LB_POS[2] + 0.25]} color={lineColor} />
      ))}

      {/* Load Balancer */}
      <Node position={LB_POS} width={0.9} height={0.45} label="LB" color={accent} accentColor={accent} />
      <GlowRing color={accent} paused={paused} />

      {/* Connection lines: LB → Servers */}
      {SERVER_POSITIONS.map((sp, i) => (
        <ConnectionLine key={`ls-${i}`} from={[LB_POS[0], 0, LB_POS[2] + 0.25]} to={[sp[0], 0, sp[2] - 0.22]} color={lineColor} />
      ))}

      {/* Servers */}
      {SERVER_POSITIONS.map((sp, i) => (
        <group key={`srv-${i}`}>
          <Node position={sp} width={0.85} height={0.4} label={`SRV ${i + 1}`} color={accent} accentColor={accent} fontSize={0.11} />
          <HealthPulse position={sp} color={green} paused={paused} seed={i * 17 + 3} />
        </group>
      ))}

      {/* Connection lines: Servers → DB primary */}
      {SERVER_POSITIONS.map((sp, i) => (
        <ConnectionLine key={`sd-${i}`} from={[sp[0], 0, sp[2] + 0.22]} to={[DB_PRIMARY[0], 0, DB_PRIMARY[2] - 0.2]} color={lineColor} />
      ))}

      {/* DB Primary */}
      <Node position={DB_PRIMARY} width={1.0} height={0.38} label="DB Primary" color={dbColor} accentColor={dbColor} fontSize={0.1} />
      <HealthPulse position={DB_PRIMARY} color={green} paused={paused} seed={99} />

      {/* DB Replica */}
      <Node position={DB_REPLICA} width={1.0} height={0.38} label="DB Replica" color={replicaLine} accentColor={replicaLine} fontSize={0.1} />
      <HealthPulse position={DB_REPLICA} color={green} paused={paused} seed={113} />

      {/* Replication line + particles */}
      <ConnectionLine from={DB_PRIMARY} to={DB_REPLICA} color={replicaLine} />
      <ReplicationArrow color={replicaLine} paused={paused} />

      {/* Traffic particles */}
      <TrafficParticles routes={routes} color={trafficColor} paused={paused} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported wrapper                                                   */
/* ------------------------------------------------------------------ */

export function DeploymentScene({ className }: { className?: string }) {
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

  return (
    <div aria-hidden className={className ? `deployment-scene ${className}` : "deployment-scene"}>
      <Canvas
        camera={{ position: [0, 5.5, 4.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ camera }) => camera.lookAt(0, 0, -0.8)}
      >
        <Scene paused={isPaused} isLightMode={isLightMode} />
      </Canvas>
    </div>
  );
}
