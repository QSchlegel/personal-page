import type { ReactNode } from "react";

import { ReadingThemeToggle } from "@/components/vault/ReadingThemeToggle";

import "./reading.css";

export default function ReadingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="reading">
      <div className="reading-toolbar">
        <ReadingThemeToggle />
      </div>
      {children}
    </div>
  );
}
