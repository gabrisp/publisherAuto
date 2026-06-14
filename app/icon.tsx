import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          borderRadius: 116,
          background: "#f0f0f0",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Stacked cards (back to front) */}
        <div style={{ position: "absolute", top: 288, left: 96, right: 96, height: 179, background: "#c4c4c4", borderRadius: 16 }} />
        <div style={{ position: "absolute", top: 256, left: 70, right: 70, height: 179, background: "#d4d4d4", borderRadius: 16 }} />
        <div style={{ position: "absolute", top: 224, left: 44, right: 44, height: 179, background: "#e4e4e4", borderRadius: 16 }} />

        {/* Arrow shaft */}
        <div style={{ position: "absolute", top: 166, left: 231, width: 50, height: 65, background: "#111111", borderRadius: 6 }} />

        {/* Arrowhead — CSS border triangle pointing up, centered at x=256 */}
        <div
          style={{
            position: "absolute",
            top: 45,
            left: 256,
            width: 0,
            height: 0,
            borderLeft: "89px solid transparent",
            borderRight: "89px solid transparent",
            borderBottom: "121px solid #111111",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
