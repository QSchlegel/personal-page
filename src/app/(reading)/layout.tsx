import type { ReactNode } from "react";

import "./reading.css";

export default function ReadingLayout({ children }: { children: ReactNode }) {
  return <div className="reading">{children}</div>;
}
