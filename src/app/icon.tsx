import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512
};

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
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          borderRadius: 96
        }}
      >
        <div
          style={{
            width: 312,
            height: 312,
            borderRadius: "50%",
            background: "#ffffff",
            border: "10px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: "50%",
              background: "#0f172a",
              boxShadow:
                "0 -116px 0 -36px #0f172a, 0 116px 0 -36px #0f172a, 116px 0 0 -36px #0f172a, -116px 0 0 -36px #0f172a"
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

