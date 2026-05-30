"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForceGraphMethods, NodeObject } from "react-force-graph-2d";

import type { GraphData, GraphNode } from "@/lib/content/types";

// react-force-graph touches `window` at import time → client-only dynamic import.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

interface VaultGraphProps {
  data: GraphData;
}

// Editorial palette pulled from the reading-surface tokens so the graph reads
// as part of the article, not as a generic D3 widget.
const COLOR_HUB = "#c0552c"; // rust — six-pagers (the “hubs”)
const COLOR_HUB_STROKE = "#8a3d1e";
const COLOR_NOTE = "#3a536e"; // navy — atomic notes
const COLOR_NOTE_STROKE = "#1f3046";
const COLOR_HOVER_RING = "#c0552c";
const COLOR_LABEL = "#1c2a3a"; // ink-0
const COLOR_LABEL_HALO = "#fcfbf8"; // soft cream halo around labels for legibility
const COLOR_LINK = "rgba(28, 42, 58, 0.22)";

/** Draw a single line of text with a soft cream halo for legibility on cream paper. */
function drawHaloedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontPx: number,
) {
  ctx.font = `500 ${fontPx}px 'IBM Plex Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.max(2.5, fontPx * 0.55);
  ctx.strokeStyle = COLOR_LABEL_HALO;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = COLOR_LABEL;
  ctx.fillText(text, x, y);
}

export function VaultGraph({ data }: VaultGraphProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [width, setWidth] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);

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

  // Once the graph is mounted, push the default forces toward an airier layout:
  // longer links, stronger node repulsion, gentler decay so it settles farther
  // apart. Otherwise everything piles up around the centre.
  const onEngineRef = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    const link = fg.d3Force("link") as { distance: (d: number) => unknown } | undefined;
    const charge = fg.d3Force("charge") as { strength: (s: number) => unknown } | undefined;
    link?.distance(95);
    charge?.strength(-260);
    fg.d3ReheatSimulation();
  }, []);

  const nodeCanvasObject = useCallback(
    (rawNode: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const node = rawNode as NodeObject & GraphNode;
      const isHub = node.type === "6-pager";
      const baseRadius = isHub ? 12 : 7;
      // val rises with degree; scale modestly so popular notes are visible but never huge.
      const radius = baseRadius + Math.min(6, Math.sqrt(Math.max(0, (node.val ?? 1) - 1)) * 2);
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      // Hover ring (drawn behind the node).
      if (hoverId === node.id) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = COLOR_HOVER_RING;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHub ? COLOR_HUB : COLOR_NOTE;
      ctx.fill();
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = isHub ? COLOR_HUB_STROKE : COLOR_NOTE_STROKE;
      ctx.stroke();

      // Labels — only render at sensible zoom levels so the canvas stays clean
      // when zoomed far out.
      if (globalScale < 0.55) return;
      const fontPx = isHub ? 6.5 : 5.5;
      const labelY = y + radius + 4;
      // Two-line wrap for long labels so they don’t overlap their neighbours.
      const label = String(node.title ?? node.id ?? "");
      const words = label.split(/\s+/);
      if (words.length > 2 && label.length > 14) {
        const mid = Math.ceil(words.length / 2);
        drawHaloedText(ctx, words.slice(0, mid).join(" "), x, labelY, fontPx);
        drawHaloedText(ctx, words.slice(mid).join(" "), x, labelY + fontPx + 1.5, fontPx);
      } else {
        drawHaloedText(ctx, label, x, labelY, fontPx);
      }
    },
    [hoverId],
  );

  const linkColor = useCallback(
    (rawLink: { source?: unknown; target?: unknown }): string => {
      if (!hoverId) return COLOR_LINK;
      const sourceId =
        typeof rawLink.source === "object" && rawLink.source !== null
          ? (rawLink.source as { id?: string }).id
          : (rawLink.source as string | undefined);
      const targetId =
        typeof rawLink.target === "object" && rawLink.target !== null
          ? (rawLink.target as { id?: string }).id
          : (rawLink.target as string | undefined);
      return sourceId === hoverId || targetId === hoverId ? COLOR_HOVER_RING : COLOR_LINK;
    },
    [hoverId],
  );

  return (
    <div className="vault-graph" ref={containerRef}>
      {width > 0 ? (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={width}
          height={560}
          nodeId="id"
          nodeLabel=""
          backgroundColor="rgba(0,0,0,0)"
          linkColor={linkColor}
          linkWidth={1.1}
          d3VelocityDecay={0.32}
          cooldownTicks={220}
          onEngineStop={onEngineRef}
          nodeCanvasObjectMode={() => "replace"}
          nodeCanvasObject={nodeCanvasObject}
          // Make the whole node area clickable / hoverable, not just the painted dot.
          nodePointerAreaPaint={(node: NodeObject, color: string, ctx: CanvasRenderingContext2D) => {
            const isHub = (node as GraphNode).type === "6-pager";
            const r = isHub ? 16 : 11;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, Math.PI * 2);
            ctx.fill();
          }}
          onNodeHover={(node) => {
            setHoverId(node ? ((node as GraphNode).id ?? null) : null);
            if (containerRef.current) {
              containerRef.current.style.cursor = node ? "pointer" : "default";
            }
          }}
          onNodeClick={(node) => {
            const url = (node as GraphNode).url;
            if (typeof url === "string") {
              router.push(url);
            }
          }}
        />
      ) : null}
    </div>
  );
}
