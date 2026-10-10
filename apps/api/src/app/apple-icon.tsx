import { ImageResponse } from "next/og";
import { brandIconSvg } from "./brand-icon-svg";

export const size = {
  width: 180,
  height: 180
};

export const contentType = "image/png";

export default function AppleIcon() {
  const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(brandIconSvg)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex"
        }}
      >
        <img
          src={svgDataUri}
          alt="Holdbold apple icon"
          style={{
            width: "100%",
            height: "100%"
          }}
        />
      </div>
    ),
    {
      ...size
    }
  );
}

