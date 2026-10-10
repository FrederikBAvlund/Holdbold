import { describe, expect, it } from "vitest";
import { placeTooltip } from "@/lib/guide/spotlightPlacement";

const phone = { width: 390, height: 844 };

describe("placeTooltip", () => {
  it("lægger boblen under et element øverst på skærmen", () => {
    const placement = placeTooltip({ top: 100, left: 20, width: 350, height: 60 }, phone, 160, 100);
    expect(placement).toMatchObject({ side: "below", top: 172, width: 340 });
  });

  it("lægger boblen over et element nederst, så den ikke havner bag bundmenuen", () => {
    const placement = placeTooltip({ top: 640, left: 20, width: 350, height: 60 }, phone, 160, 100);
    expect(placement.side).toBe("above");
    expect(placement.bottom).toBe(844 - 640 + 12);
  });

  it("holder boblen inden for skærmen på smalle telefoner", () => {
    const placement = placeTooltip({ top: 100, left: 300, width: 40, height: 40 }, { width: 320, height: 640 }, 160);
    expect(placement.left).toBe(16);
    expect(placement.width).toBe(288);
  });

  it("centrerer boblen under små elementer, når der er plads", () => {
    const placement = placeTooltip({ top: 100, left: 600, width: 40, height: 40 }, { width: 1280, height: 800 }, 160);
    expect(placement.left).toBe(600 + 20 - 170);
  });
});
