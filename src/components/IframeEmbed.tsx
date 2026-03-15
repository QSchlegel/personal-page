"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ExternalLink, Eye, Loader2, RefreshCw } from "lucide-react";

interface IframeEmbedProps {
  src: string;
  title: string;
}

export function IframeEmbed({ src, title }: IframeEmbedProps) {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);

    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [attempt]);

  return (
    <div className="embed-wrapper">
      <iframe
        key={attempt}
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
        <span className="embed-meta-actions">
          {timedOut && !loaded ? (
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw className="icon-sm" />
              Retry
            </button>
          ) : null}
          <a href={src} target="_blank" rel="noreferrer">
            <ExternalLink className="icon-sm" />
            Open live UI
          </a>
        </span>
      </div>
    </div>
  );
}
