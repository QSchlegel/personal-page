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
          borderRadius: "42px",
          background: "#071127",
          color: "#5EC4FF",
          fontSize: 88,
          fontWeight: 700,
          letterSpacing: "0.02em",
          fontFamily: "Arial Black, Helvetica Neue, sans-serif",
        }}
      >
        QS
      </div>
    ),
    size,
  );
}
