import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
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
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          borderRadius: 36
        }}
      >
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: "50%",
            background: "#ffffff",
            border: "4px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "#0f172a",
              boxShadow:
                "0 -42px 0 -14px #0f172a, 0 42px 0 -14px #0f172a, 42px 0 0 -14px #0f172a, -42px 0 0 -14px #0f172a"
            }}
          />
        </div>
      </div>
    ),
    {
      ...size
    }
  );
}

