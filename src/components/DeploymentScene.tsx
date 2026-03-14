"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Layout constants                                                   */
/* ------------------------------------------------------------------ */

/* Depth layout: users far back (neg-Z), DBs up front (pos-Z) */
/* Increased Z-separation for more distinct layers */
const LB_POS: [number, number, number] = [0, 0, -3.2];

const SERVER_POSITIONS: [number, number, number][] = [
  [-2.4, 0, 0.4],
  [0, 0, 0.4],
  [2.4, 0, 0.4],
];

const DB_PRIMARY: [number, number, number] = [-1.2, 0, 3.6];
const DB_REPLICA: [number, number, number] = [1.2, 0, 3.6];

/* Layer Z-boundaries for separator planes */
const LAYER_Z_LB = -1.4; /* between LB and Servers */
const LAYER_Z_SRV = 2.0; /* between Servers and DBs */

/* Ambient mesh: scattered dots that card nodes connect into */
const AMBIENT_COUNT = 48;
const AMBIENT_SPREAD_X = 10.0;
const AMBIENT_SPREAD_Z = 14.0;
const AMBIENT_Z_CENTER = -0.5;

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
      <ringGeometry args={[0.52, 0.58, 32]} />
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

function Node({ position, width, height, label, color, accentColor, fontSize = 0.16 }: NodeProps) {
  const shape = useMemo(() => roundedRectShape(width, height, 0.1), [width, height]);

  const textCanvas = useMemo(() => {
    const c = document.createElement("canvas");
    const s = 512;
    c.width = s;
    c.height = s;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = accentColor;
    ctx.font = `bold ${Math.round(s * 0.16)}px monospace`;
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
      {/* filled background – flat on ground (XZ plane) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      {/* border outline */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.ShapeGeometry(shape)]} />
        <lineBasicMaterial color={color} transparent opacity={0.7} />
      </lineSegments>
      {/* label – billboard sprite stays readable */}
      <sprite scale={[fontSize * 6, fontSize * 6, 1]} position={[0, 0.4, 0]}>
        <spriteMaterial map={texture} transparent />
      </sprite>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated traffic particles                                         */
/* ------------------------------------------------------------------ */

interface TrafficRoute {
  from: [number, number, number];
  to: [number, number, number];
  mid: [number, number, number]; /* arc control point for curved paths */
  delay: number;
  speed: number;
}

/* Quadratic bezier interpolation for curved traffic paths */
function bezierPoint(
  from: [number, number, number],
  mid: [number, number, number],
  to: [number, number, number],
  t: number,
): [number, number, number] {
  const u = 1 - t;
  return [
    u * u * from[0] + 2 * u * t * mid[0] + t * t * to[0],
    u * u * from[1] + 2 * u * t * mid[1] + t * t * to[1],
    u * u * from[2] + 2 * u * t * mid[2] + t * t * to[2],
  ];
}

/* Ease-in-out for realistic acceleration/deceleration */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
  const initialOpacities = useMemo(() => {
    const o = new Float32Array(count);
    o.fill(1.0);
    return o;
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
      const rawProgress = ((t * speeds[i] + offsets[i]) % 1 + 1) % 1;
      const progress = easeInOut(rawProgress);

      const p = bezierPoint(route.from, route.mid, route.to, progress);
      pos[i * 3] = p[0];
      pos[i * 3 + 1] = p[1];
      pos[i * 3 + 2] = p[2];
    }

    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[initialPositions, 3]} />
        <bufferAttribute attach="attributes-opacity" args={[initialOpacities, 1]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.07} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
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
  const count = 6; /* 4 forward (primary→replica) + 2 reverse (ack) */
  const initialPositions = useMemo(() => new Float32Array(count * 3), []);

  useFrame(({ clock }) => {
    if (paused || !ref.current) return;
    const t = clock.getElapsedTime();
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const pos = attr.array as Float32Array;
    /* Forward replication stream (primary → replica) */
    for (let i = 0; i < 4; i++) {
      const progress = ((t * 0.35 + i * 0.25) % 1 + 1) % 1;
      const eased = easeInOut(progress);
      pos[i * 3] = DB_PRIMARY[0] + (DB_REPLICA[0] - DB_PRIMARY[0]) * eased;
      pos[i * 3 + 1] = 0.01;
      pos[i * 3 + 2] = DB_PRIMARY[2] + Math.sin(progress * Math.PI) * 0.15;
    }
    /* Reverse ack stream (replica → primary), slower & offset */
    for (let i = 4; i < count; i++) {
      const progress = ((t * 0.25 + (i - 4) * 0.5 + 0.3) % 1 + 1) % 1;
      const eased = easeInOut(progress);
      pos[i * 3] = DB_REPLICA[0] + (DB_PRIMARY[0] - DB_REPLICA[0]) * eased;
      pos[i * 3 + 1] = 0.01;
      pos[i * 3 + 2] = DB_PRIMARY[2] - Math.sin(progress * Math.PI) * 0.1;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[initialPositions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.05} sizeAttenuation transparent opacity={0.6} depthWrite={false} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer separator planes                                             */
/* ------------------------------------------------------------------ */

function LayerSeparator({
  zPos,
  color,
  width = 8,
  depth = 0.02,
}: {
  zPos: number;
  color: string;
  width?: number;
  depth?: number;
}) {
  return (
    <group position={[0, 0.005, zPos]}>
      {/* faint horizontal line */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      {/* subtle glow strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, 0.35]} />
        <meshBasicMaterial color={color} transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer label (tiny text floating above separator)                   */
/* ------------------------------------------------------------------ */

function LayerLabel({
  text,
  position,
  color,
}: {
  text: string;
  position: [number, number, number];
  color: string;
}) {
  const canvas = useMemo(() => {
    const c = document.createElement("canvas");
    const s = 256;
    c.width = s;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, s, 64);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.45;
    ctx.font = `bold ${Math.round(s * 0.12)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, s / 2, 32);
    return c;
  }, [text, color]);

  const texture = useMemo(() => {
    const t = new THREE.CanvasTexture(canvas);
    t.needsUpdate = true;
    return t;
  }, [canvas]);

  return (
    <sprite scale={[1.2, 0.3, 1]} position={position}>
      <spriteMaterial map={texture} transparent opacity={0.5} />
    </sprite>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated ambient mesh dots                                         */
/* ------------------------------------------------------------------ */

function AnimatedAmbientDots({
  positions,
  color,
  paused,
}: {
  positions: [number, number, number][];
  color: string;
  paused: boolean;
}) {
  const count = positions.length;
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const circleGeo = useMemo(() => new THREE.CircleGeometry(0.05, 12), []);

  /* Pre-compute per-dot drift parameters */
  const driftParams = useMemo(
    () =>
      positions.map((_, i) => ({
        freqX: 0.15 + seededRandom(i * 53 + 1) * 0.2,
        freqZ: 0.12 + seededRandom(i * 61 + 2) * 0.18,
        ampX: 0.15 + seededRandom(i * 71 + 3) * 0.25,
        ampZ: 0.12 + seededRandom(i * 79 + 4) * 0.22,
        phaseX: seededRandom(i * 83 + 5) * Math.PI * 2,
        phaseZ: seededRandom(i * 89 + 6) * Math.PI * 2,
      })),
    [positions],
  );

  useFrame(({ clock }) => {
    if (paused || !ref.current) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const base = positions[i];
      const d = driftParams[i];
      dummy.position.set(
        base[0] + Math.sin(t * d.freqX + d.phaseX) * d.ampX,
        base[1],
        base[2] + Math.cos(t * d.freqZ + d.phaseZ) * d.ampZ,
      );
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[circleGeo, undefined, count]}>
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated connection lines (follow drifting ambient dots)           */
/* ------------------------------------------------------------------ */

function AnimatedConnectionLines({
  edges,
  allPositions,
  ambientPositions,
  cardCount,
  lineColor,
  meshLineColor,
  paused,
}: {
  edges: { from: number; to: number }[];
  allPositions: [number, number, number][];
  ambientPositions: [number, number, number][];
  cardCount: number;
  lineColor: string;
  meshLineColor: string;
  paused: boolean;
}) {
  /* Pre-compute per-dot drift params (same as AnimatedAmbientDots) */
  const driftParams = useMemo(
    () =>
      ambientPositions.map((_, i) => ({
        freqX: 0.15 + seededRandom(i * 53 + 1) * 0.2,
        freqZ: 0.12 + seededRandom(i * 61 + 2) * 0.18,
        ampX: 0.15 + seededRandom(i * 71 + 3) * 0.25,
        ampZ: 0.12 + seededRandom(i * 79 + 4) * 0.22,
        phaseX: seededRandom(i * 83 + 5) * Math.PI * 2,
        phaseZ: seededRandom(i * 89 + 6) * Math.PI * 2,
      })),
    [ambientPositions],
  );

  /* Separate edges by type for different colors */
  const cardEdges = useMemo(() => edges.filter((e) => e.from < cardCount || e.to < cardCount), [edges, cardCount]);
  const meshEdges = useMemo(() => edges.filter((e) => e.from >= cardCount && e.to >= cardCount), [edges, cardCount]);

  const cardLineRef = useRef<THREE.LineSegments>(null);
  const meshLineRef = useRef<THREE.LineSegments>(null);

  const cardPositions = useMemo(() => new Float32Array(cardEdges.length * 6), [cardEdges]);
  const meshPositions = useMemo(() => new Float32Array(meshEdges.length * 6), [meshEdges]);

  const getDriftedPos = (idx: number, t: number): [number, number, number] => {
    const base = allPositions[idx];
    if (idx < cardCount) return base; /* Card nodes don't drift */
    const ambIdx = idx - cardCount;
    const d = driftParams[ambIdx];
    return [
      base[0] + Math.sin(t * d.freqX + d.phaseX) * d.ampX,
      base[1],
      base[2] + Math.cos(t * d.freqZ + d.phaseZ) * d.ampZ,
    ];
  };

  useFrame(({ clock }) => {
    if (paused) return;
    const t = clock.getElapsedTime();

    if (cardLineRef.current) {
      const attr = cardLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const pos = attr.array as Float32Array;
      for (let i = 0; i < cardEdges.length; i++) {
        const e = cardEdges[i];
        const from = getDriftedPos(e.from, t);
        const to = getDriftedPos(e.to, t);
        pos[i * 6] = from[0]; pos[i * 6 + 1] = from[1]; pos[i * 6 + 2] = from[2];
        pos[i * 6 + 3] = to[0]; pos[i * 6 + 4] = to[1]; pos[i * 6 + 5] = to[2];
      }
      attr.needsUpdate = true;
    }

    if (meshLineRef.current) {
      const attr = meshLineRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const pos = attr.array as Float32Array;
      for (let i = 0; i < meshEdges.length; i++) {
        const e = meshEdges[i];
        const from = getDriftedPos(e.from, t);
        const to = getDriftedPos(e.to, t);
        pos[i * 6] = from[0]; pos[i * 6 + 1] = from[1]; pos[i * 6 + 2] = from[2];
        pos[i * 6 + 3] = to[0]; pos[i * 6 + 4] = to[1]; pos[i * 6 + 5] = to[2];
      }
      attr.needsUpdate = true;
    }
  });

  return (
    <>
      {cardEdges.length > 0 && (
        <lineSegments ref={cardLineRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[cardPositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={lineColor} transparent opacity={0.18} />
        </lineSegments>
      )}
      {meshEdges.length > 0 && (
        <lineSegments ref={meshLineRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[meshPositions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={meshLineColor} transparent opacity={0.18} />
        </lineSegments>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Scene composition                                                  */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Card nodes (labeled infrastructure boxes)                          */
/* ------------------------------------------------------------------ */

const CARD_NODES: { pos: [number, number, number]; label: string; width: number; height: number; fontSize: number; kind: "infra" | "db" }[] = [
  { pos: LB_POS, label: "LB", width: 1.2, height: 0.6, fontSize: 0.18, kind: "infra" },
  ...SERVER_POSITIONS.map((sp, i) => ({ pos: sp, label: `SRV ${i + 1}`, width: 1.1, height: 0.55, fontSize: 0.15, kind: "infra" as const })),
  { pos: DB_PRIMARY, label: "DB Primary", width: 1.3, height: 0.5, fontSize: 0.14, kind: "db" as const },
  { pos: DB_REPLICA, label: "DB Replica", width: 1.3, height: 0.5, fontSize: 0.14, kind: "db" as const },
];

/* ------------------------------------------------------------------ */
/*  Build unified mesh: ambient dots + card nodes, random connections  */
/* ------------------------------------------------------------------ */

function buildMesh() {
  /* 1. Generate ambient dot positions */
  const ambientPositions: [number, number, number][] = [];
  for (let i = 0; i < AMBIENT_COUNT; i++) {
    ambientPositions.push([
      (seededRandom(i * 7 + 100) - 0.5) * AMBIENT_SPREAD_X,
      0,
      AMBIENT_Z_CENTER + (seededRandom(i * 11 + 200) - 0.5) * AMBIENT_SPREAD_Z,
    ]);
  }

  /* 2. Unified position list: [0..CARD_NODES-1] = card nodes, [CARD_NODES..end] = ambient dots */
  const allPositions: [number, number, number][] = [
    ...CARD_NODES.map((n) => n.pos),
    ...ambientPositions,
  ];
  const totalNodes = allPositions.length;
  const cardCount = CARD_NODES.length;

  /* 3. Random connections - ambient↔ambient mesh plus card↔ambient bridges */
  const edges: { from: number; to: number }[] = [];
  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    const exists = edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
    if (!exists) edges.push({ from: a, to: b });
  };

  /* Each ambient dot connects to 2-3 nearest neighbors (by seeded random selection) */
  for (let i = cardCount; i < totalNodes; i++) {
    const connCount = 2 + Math.floor(seededRandom(i * 31 + 7) * 2);
    let attempt = 0;
    const targets = new Set<number>();
    while (targets.size < connCount && attempt < 30) {
      const candidate = Math.floor(seededRandom(i * 17 + attempt * 13 + 53) * totalNodes);
      if (candidate !== i) targets.add(candidate);
      attempt++;
    }
    for (const t of targets) addEdge(i, t);
  }

  /* Each card node connects to 2-4 random ambient dots (bridge into the mesh) */
  for (let i = 0; i < cardCount; i++) {
    const connCount = 2 + Math.floor(seededRandom(i * 43 + 300) * 3);
    let attempt = 0;
    const targets = new Set<number>();
    while (targets.size < connCount && attempt < 30) {
      const candidate = cardCount + Math.floor(seededRandom(i * 19 + attempt * 11 + 400) * AMBIENT_COUNT);
      targets.add(candidate);
      attempt++;
    }
    for (const t of targets) addEdge(i, t);
  }

  /* Also keep some card-to-card connections (1-2 per card node) */
  for (let i = 0; i < cardCount; i++) {
    const connCount = 1 + Math.floor(seededRandom(i * 37 + 500) * 2);
    let attempt = 0;
    const targets = new Set<number>();
    while (targets.size < connCount && attempt < 20) {
      const candidate = Math.floor(seededRandom(i * 23 + attempt * 7 + 600) * cardCount);
      if (candidate !== i) targets.add(candidate);
      attempt++;
    }
    for (const t of targets) addEdge(i, t);
  }

  return { ambientPositions, allPositions, edges };
}

const MESH = buildMesh();

function Scene({ paused, isLightMode }: { paused: boolean; isLightMode: boolean }) {
  const accent = isLightMode ? "#2a6496" : "#6ec8ff";
  const green = isLightMode ? "#2d8a4e" : "#5dea8b";
  const lineColor = isLightMode ? "#5a7a96" : "#3a5a72";
  const meshLineColor = isLightMode ? "#8a9bac" : "#2e4556";
  const trafficColor = isLightMode ? "#3582b8" : "#8ed8ff";
  const dbColor = isLightMode ? "#8a6c2a" : "#f5c45a";
  const replicaLine = isLightMode ? "#7a6832" : "#c8a844";
  const dotColor = isLightMode ? "#7a8fa3" : "#4a6a82";

  const cardCount = CARD_NODES.length;

  /* Build traffic routes: realistic multi-hop flow LB → SRV → DB */
  const routes = useMemo<TrafficRoute[]>(() => {
    const result: TrafficRoute[] = [];

    /* Primary routes: LB → each server (request distribution) */
    for (let s = 0; s < SERVER_POSITIONS.length; s++) {
      const from: [number, number, number] = [LB_POS[0], 0, LB_POS[2]];
      const to: [number, number, number] = [SERVER_POSITIONS[s][0], 0, SERVER_POSITIONS[s][2]];
      const mid: [number, number, number] = [
        (from[0] + to[0]) / 2 + (seededRandom(s * 7 + 1) - 0.5) * 0.6,
        0.05,
        (from[2] + to[2]) / 2,
      ];
      for (let p = 0; p < 3; p++) {
        result.push({ from, to, mid, delay: seededRandom(s * 11 + p * 3), speed: 0.22 + seededRandom(s * 5 + p) * 0.15 });
      }
    }

    /* Server → DB routes (queries) */
    for (let s = 0; s < SERVER_POSITIONS.length; s++) {
      const from: [number, number, number] = [SERVER_POSITIONS[s][0], 0, SERVER_POSITIONS[s][2]];
      const dbTarget = s < 2 ? DB_PRIMARY : DB_REPLICA;
      const to: [number, number, number] = [dbTarget[0], 0, dbTarget[2]];
      const mid: [number, number, number] = [
        (from[0] + to[0]) / 2 + (seededRandom(s * 13 + 50) - 0.5) * 0.4,
        0.03,
        (from[2] + to[2]) / 2,
      ];
      for (let p = 0; p < 2; p++) {
        result.push({ from, to, mid, delay: seededRandom(s * 9 + p * 5 + 30), speed: 0.18 + seededRandom(s * 3 + p + 40) * 0.12 });
      }
    }

    /* DB → Server response routes */
    for (let s = 0; s < SERVER_POSITIONS.length; s++) {
      const dbSource = s < 2 ? DB_PRIMARY : DB_REPLICA;
      const from: [number, number, number] = [dbSource[0], 0, dbSource[2]];
      const to: [number, number, number] = [SERVER_POSITIONS[s][0], 0, SERVER_POSITIONS[s][2]];
      const mid: [number, number, number] = [
        (from[0] + to[0]) / 2 + (seededRandom(s * 17 + 70) - 0.5) * 0.5,
        0.04,
        (from[2] + to[2]) / 2,
      ];
      result.push({ from, to, mid, delay: seededRandom(s * 7 + 80), speed: 0.2 + seededRandom(s * 11 + 90) * 0.1 });
    }

    /* Ambient mesh traffic (background network chatter) */
    for (let c = 0; c < MESH.edges.length; c++) {
      const e = MESH.edges[c];
      if (e.from >= cardCount && e.to >= cardCount) {
        if (seededRandom(c * 23 + 100) > 0.7) continue; /* sparse background traffic */
        const fromPos = MESH.allPositions[e.from];
        const toPos = MESH.allPositions[e.to];
        const mid: [number, number, number] = [
          (fromPos[0] + toPos[0]) / 2 + (seededRandom(c * 29 + 110) - 0.5) * 0.3,
          0,
          (fromPos[2] + toPos[2]) / 2 + (seededRandom(c * 31 + 120) - 0.5) * 0.3,
        ];
        result.push({
          from: [fromPos[0], 0, fromPos[2]],
          to: [toPos[0], 0, toPos[2]],
          mid,
          delay: seededRandom(c * 11 + 1),
          speed: 0.12 + seededRandom(c * 5 + 20) * 0.15,
        });
      }
    }

    return result;
  }, [cardCount]);

  const separatorColor = isLightMode ? "#6a8aaa" : "#4a7a9a";
  const labelColor = isLightMode ? "#4a6a8a" : "#7ab0d8";

  return (
    <>
      {/* Layer separator planes */}
      <LayerSeparator zPos={LAYER_Z_LB} color={separatorColor} width={12} />
      <LayerSeparator zPos={LAYER_Z_SRV} color={separatorColor} width={12} />

      {/* Layer labels */}
      <LayerLabel text="LOAD BALANCER" position={[-4.0, 0.3, LB_POS[2]]} color={labelColor} />
      <LayerLabel text="APPLICATION" position={[-4.0, 0.3, SERVER_POSITIONS[0][2]]} color={labelColor} />
      <LayerLabel text="DATA" position={[-4.0, 0.3, DB_PRIMARY[2]]} color={labelColor} />

      {/* Animated ambient mesh dots */}
      <AnimatedAmbientDots positions={MESH.ambientPositions} color={dotColor} paused={paused} />

      {/* Animated connection lines that follow drifting dots */}
      <AnimatedConnectionLines
        edges={MESH.edges}
        allPositions={MESH.allPositions}
        ambientPositions={MESH.ambientPositions}
        cardCount={cardCount}
        lineColor={lineColor}
        meshLineColor={meshLineColor}
        paused={paused}
      />

      {/* Card nodes (labeled boxes) */}
      {CARD_NODES.map((node, i) => {
        const color = node.kind === "db" ? (node.label === "DB Replica" ? replicaLine : dbColor) : accent;
        return (
          <group key={`node-${i}`}>
            <Node position={node.pos} width={node.width} height={node.height} label={node.label} color={color} accentColor={color} fontSize={node.fontSize} />
            <HealthPulse position={node.pos} color={green} paused={paused} seed={i * 17 + 3} />
          </group>
        );
      })}

      {/* Glow ring on LB */}
      <GlowRing color={accent} paused={paused} />

      {/* Traffic particles along card-connected edges */}
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
        camera={{ position: [0, 7.5, 6.0], fov: 48 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ camera }) => camera.lookAt(0, 0, -0.4)}
      >
        <Scene paused={isPaused} isLightMode={isLightMode} />
      </Canvas>
    </div>
  );
}
