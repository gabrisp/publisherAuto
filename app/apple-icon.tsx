import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 41,
          background: "#f0f0f0",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Stacked cards */}
        <div style={{ position: "absolute", top: 101, left: 34, right: 34, height: 63, background: "#c4c4c4", borderRadius: 6 }} />
        <div style={{ position: "absolute", top: 90,  left: 25, right: 25, height: 63, background: "#d4d4d4", borderRadius: 6 }} />
        <div style={{ position: "absolute", top: 79,  left: 15, right: 15, height: 63, background: "#e4e4e4", borderRadius: 6 }} />

        {/* Arrow shaft */}
        <div style={{ position: "absolute", top: 58, left: 81, width: 18, height: 23, background: "#111111", borderRadius: 3 }} />

        {/* Arrowhead — CSS border triangle, centered at x=90 */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 90,
            width: 0,
            height: 0,
            borderLeft: "31px solid transparent",
            borderRight: "31px solid transparent",
            borderBottom: "42px solid #111111",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
