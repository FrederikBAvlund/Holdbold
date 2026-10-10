import { ImageResponse } from "next/og";
import { brandIconSvgSquare, resolveThemeId } from "../brand-icon-svg";

export function GET(request: Request) {
  const theme = resolveThemeId(new URL(request.url).searchParams.get("theme"));
  const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(brandIconSvgSquare(theme))}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <img src={svgDataUri} alt="" style={{ width: "100%", height: "100%" }} />
      </div>
    ),
    { width: 180, height: 180 }
  );
}
