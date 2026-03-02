"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Eye, Loader2 } from "lucide-react";

interface IframeEmbedProps {
  src: string;
  title: string;
}

export function IframeEmbed({ src, title }: IframeEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="embed-wrapper">
      <iframe
        className="embed-frame"
        src={src}
        title={title}
        loading="lazy"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
      />
      <div className="embed-meta">
        <span>
          {loaded ? (
            <Eye className="icon-sm" />
          ) : timedOut ? (
            <AlertTriangle className="icon-sm" />
          ) : (
            <Loader2 className="icon-sm icon-spin" />
          )}
          {loaded ? "Live UI embedded" : timedOut ? "Embedding may be blocked" : "Loading preview..."}
        </span>
        <a href={src} target="_blank" rel="noreferrer">
          <ExternalLink className="icon-sm" />
          Open live UI
        </a>
      </div>
    </div>
  );
}
