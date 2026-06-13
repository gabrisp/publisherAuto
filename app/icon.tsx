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
        {/* Stacked cards */}
        <div style={{ position: "absolute", top: 288, left: 96, right: 96, height: 179, background: "#c4c4c4", borderRadius: 16 }} />
        <div style={{ position: "absolute", top: 256, left: 70, right: 70, height: 179, background: "#d4d4d4", borderRadius: 16 }} />
        <div style={{ position: "absolute", top: 224, left: 44, right: 44, height: 179, background: "#e4e4e4", borderRadius: 16 }} />
        {/* Arrow shaft */}
        <div style={{ position: "absolute", top: 166, left: 231, width: 50, height: 58, background: "#111111", borderRadius: 6 }} />
        {/* Arrowhead */}
        <div
          style={{
            position: "absolute",
            top: 45,
            left: 167,
            width: 178,
            height: 121,
            background: "#111111",
            clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
