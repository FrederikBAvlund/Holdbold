import { ImageResponse } from "next/og";
import { brandIconSvgMaskable } from "../brand-icon-svg";

// Android beskærer "maskable" ikoner til cirkel/squircle – motivet ligger derfor inden for safe-zonen.
export function GET() {
  const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(brandIconSvgMaskable)}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <img src={svgDataUri} alt="" style={{ width: "100%", height: "100%" }} />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
