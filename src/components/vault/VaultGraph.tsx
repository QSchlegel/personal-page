"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeObject } from "react-force-graph-2d";

import type { GraphData } from "@/lib/content/types";

// react-force-graph touches `window` at import time → client-only dynamic import.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface VaultGraphProps {
  data: GraphData;
}

export function VaultGraph({ data }: VaultGraphProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // The library mutates node/link objects (adds x/y/vx/vy); hand it fresh clones.
  const graphData = useMemo(
    () => ({
      nodes: data.nodes.map((node) => ({ ...node })),
      links: data.links.map((link) => ({ ...link })),
    }),
    [data],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const update = () => setWidth(element.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="vault-graph" ref={containerRef}>
      {width > 0 ? (
        <ForceGraph2D
          graphData={graphData}
          width={width}
          height={460}
          nodeId="id"
          nodeVal="val"
          nodeLabel="title"
          nodeAutoColorBy="type"
          backgroundColor="rgba(0,0,0,0)"
          linkColor={() => "rgba(120,140,160,0.4)"}
          linkWidth={1}
          nodeRelSize={5}
          cooldownTicks={120}
          onNodeClick={(node: NodeObject) => {
            const url = node.url;
            if (typeof url === "string") {
              router.push(url);
            }
          }}
          nodeCanvasObjectMode={() => "after"}
          nodeCanvasObject={(node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const label = String(node.title ?? node.id ?? "");
            const fontSize = Math.max(11 / globalScale, 2);
            ctx.font = `${fontSize}px 'IBM Plex Mono', monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = "#4a4036";
            ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + 7);
          }}
        />
      ) : null}
    </div>
  );
}
