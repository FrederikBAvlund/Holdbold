import { describe, expect, it } from "vitest";
import { buildMobilePayLink } from "./mobilePayLink";

describe("buildMobilePayLink", () => {
  it("bygger betalingslink med beløb for MobilePay-nummer", () => {
    const link = buildMobilePayLink("12345", 150, "Bøder – Anders");
    expect(link?.prefilledAmount).toBe(true);
    const url = new URL(link!.url);
    expect(url.searchParams.get("phone")).toBe("12345");
    expect(url.searchParams.get("amount")).toBe("150.00");
    expect(url.searchParams.get("comment")).toBe("Bøder – Anders");
    expect(url.searchParams.get("lock")).toBe("1");
  });

  it("returnerer null for ugyldigt beløb", () => {
    expect(buildMobilePayLink("12345", 0)).toBeNull();
  });

  it("bruger qr.mobilepay.dk-links uden forudfyldt beløb", () => {
    const link = buildMobilePayLink(
      "https://qr.mobilepay.dk/box/abc/pay-in",
      50,
    );
    expect(link).toEqual({
      url: "https://qr.mobilepay.dk/box/abc/pay-in",
      prefilledAmount: false,
    });
  });

  it("afviser fremmede domæner og Box-ID'er", () => {
    expect(buildMobilePayLink("https://evil.example/x", 50)).toBeNull();
    expect(buildMobilePayLink("1234AB", 50)).toBeNull();
  });
});
