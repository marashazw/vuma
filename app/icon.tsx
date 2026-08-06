import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0E1B2E",
          borderRadius: 14,
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            color: "#F2A93B",
            fontFamily: "sans-serif",
          }}
        >
          V
        </div>
      </div>
    ),
    { ...size }
  );
}
