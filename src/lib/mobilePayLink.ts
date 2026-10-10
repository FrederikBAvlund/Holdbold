const PAYMENT_LINK_BASE =
  "https://www.mobilepay.dk/erhverv/betalingslink/betalingslink-svar";

/**
 * Bygger et link, der åbner MobilePay med modtager og beløb udfyldt.
 *
 * - Almindeligt MobilePay-nummer (5-6 cifre): MobilePay-betalingslink med beløb.
 * - Indsat qr.mobilepay.dk-link (fx fra en Box): bruges som det er. Beløb kan ikke
 *   forudfyldes, så kaldere skal stadig vise beløbet.
 * - Alt andet (fx Box-ID): null, så UI falder tilbage til manuel betaling.
 */
export function buildMobilePayLink(
  recipient: string,
  amount: number,
  comment?: string,
): { url: string; prefilledAmount: boolean } | null {
  const value = recipient.trim();

  if (/^\d{5,6}$/.test(value)) {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const params = new URLSearchParams({
      phone: value,
      amount: amount.toFixed(2),
      lock: "1",
    });
    if (comment?.trim()) params.set("comment", comment.trim().slice(0, 100));
    return {
      url: `${PAYMENT_LINK_BASE}?${params.toString()}`,
      prefilledAmount: true,
    };
  }

  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "qr.mobilepay.dk") {
      return { url: url.toString(), prefilledAmount: false };
    }
  } catch {
    // ikke en URL
  }
  return null;
}
