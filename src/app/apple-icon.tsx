import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1c2a3a",
          fontSize: 104,
          fontWeight: 800,
          letterSpacing: "-6px",
          fontFamily: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <span style={{ color: "#f5efe4" }}>Q</span>
        <span style={{ color: "#e0763f" }}>S</span>
      </div>
    ),
    size,
  );
}
