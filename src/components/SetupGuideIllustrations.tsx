import type { ReactNode } from "react";

/**
 * Tegnede illustrationer af Safari/iOS-trinnene. Safaris egen brugerflade kan ikke
 * screenshottes fra serveren, så de er lavet som enkle SVG'er med det fremhævede element markeret.
 */

const HIGHLIGHT = "#ff9f0a";

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 320 200"
      role="img"
      aria-label={label}
      className="h-auto w-full rounded-2xl border border-line bg-[#e9ecf1]"
    >
      {children}
    </svg>
  );
}

function Pulse({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={HIGHLIGHT} strokeWidth="3" />
      <circle cx={x} cy={y} r={r + 6} fill="none" stroke={HIGHLIGHT} strokeOpacity="0.35" strokeWidth="3" />
    </g>
  );
}

function SafariBar({ highlightMore }: { highlightMore?: boolean }) {
  return (
    <g>
      <rect x="0" y="146" width="320" height="54" fill="#f6f6f8" />
      <rect x="14" y="156" width="238" height="30" rx="15" fill="#e1e3e8" />
      <text x="133" y="175" textAnchor="middle" fontSize="12" fill="#3c3c43" fontFamily="system-ui, sans-serif">
        holdbold.dk
      </text>
      <g fill="#3c3c43">
        <circle cx="272" cy="171" r="2.2" />
        <circle cx="282" cy="171" r="2.2" />
        <circle cx="292" cy="171" r="2.2" />
      </g>
      {highlightMore ? <Pulse x={282} y={171} r={17} /> : null}
    </g>
  );
}

/** Trin: tryk på "…" nederst til højre i Safari. */
export function SafariMoreIllustration() {
  return (
    <Frame label="Safari med de tre prikker markeret nederst til højre">
      <rect x="20" y="16" width="280" height="40" rx="10" fill="#fff" />
      <rect x="20" y="66" width="180" height="12" rx="6" fill="#d6d9df" />
      <rect x="20" y="88" width="240" height="12" rx="6" fill="#d6d9df" />
      <rect x="20" y="110" width="140" height="12" rx="6" fill="#d6d9df" />
      <SafariBar highlightMore />
    </Frame>
  );
}

function MenuRow({ y, label, active }: { y: number; label: string; active?: boolean }) {
  return (
    <g>
      {active ? <rect x="168" y={y - 15} width="142" height="30" rx="8" fill={HIGHLIGHT} fillOpacity="0.22" /> : null}
      <text x="180" y={y + 4} fontSize="12" fill="#1c1c1e" fontFamily="system-ui, sans-serif" fontWeight={active ? 700 : 400}>
        {label}
      </text>
      {active ? <rect x="168" y={y - 15} width="142" height="30" rx="8" fill="none" stroke={HIGHLIGHT} strokeWidth="2.5" /> : null}
    </g>
  );
}

/** Trin: tryk på "Del" i menuen. */
export function SafariShareIllustration() {
  return (
    <Frame label="Safari-menu med punktet Del markeret">
      <rect x="20" y="16" width="280" height="40" rx="10" fill="#fff" />
      <rect x="20" y="66" width="180" height="12" rx="6" fill="#d6d9df" />
      <SafariBar />
      <rect x="160" y="24" width="152" height="118" rx="14" fill="#fbfbfd" stroke="#d1d1d6" />
      <MenuRow y={46} label="Ny fane" />
      <MenuRow y={76} label="Del" active />
      <MenuRow y={106} label="Bogmærke" />
      <MenuRow y={132} label="Find på siden" />
    </Frame>
  );
}

/** Trin: scroll ned og tryk "Føj til hjemmeskærm". */
export function AddToHomeIllustration() {
  return (
    <Frame label="Delingsark med Føj til hjemmeskærm markeret">
      <rect x="30" y="14" width="260" height="186" rx="18" fill="#f2f2f7" />
      <rect x="140" y="20" width="40" height="4" rx="2" fill="#c7c7cc" />
      <rect x="44" y="36" width="232" height="34" rx="9" fill="#fff" />
      <text x="58" y="58" fontSize="12" fill="#1c1c1e" fontFamily="system-ui, sans-serif">Kopiér</text>
      <rect x="44" y="76" width="232" height="34" rx="9" fill="#fff" />
      <text x="58" y="98" fontSize="12" fill="#1c1c1e" fontFamily="system-ui, sans-serif">Føj til bogmærker</text>
      <rect x="44" y="116" width="232" height="38" rx="9" fill={HIGHLIGHT} fillOpacity="0.22" stroke={HIGHLIGHT} strokeWidth="2.5" />
      <text x="58" y="140" fontSize="12" fontWeight="700" fill="#1c1c1e" fontFamily="system-ui, sans-serif">Føj til hjemmeskærm</text>
      <rect x="248" y="125" width="18" height="18" rx="4" fill="none" stroke="#1c1c1e" strokeWidth="1.6" />
      <path d="M257 129v10M252 134h10" stroke="#1c1c1e" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="44" y="160" width="232" height="34" rx="9" fill="#fff" />
      <text x="58" y="182" fontSize="12" fill="#1c1c1e" fontFamily="system-ui, sans-serif">Marker</text>
    </Frame>
  );
}

/** Trin: sørg for at "Åbn som webapp" er slået til, og tryk "Tilføj". */
export function OpenAsWebAppIllustration() {
  return (
    <Frame label="Føj til hjemmeskærm med Åbn som webapp slået til og Tilføj markeret">
      <rect x="30" y="10" width="260" height="184" rx="18" fill="#f2f2f7" />
      <text x="62" y="36" fontSize="12" fill="#007aff" fontFamily="system-ui, sans-serif">Annuller</text>
      <text x="160" y="36" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1c1c1e" fontFamily="system-ui, sans-serif">Føj til hjemmeskærm</text>
      <rect x="226" y="20" width="52" height="22" rx="11" fill={HIGHLIGHT} fillOpacity="0.22" stroke={HIGHLIGHT} strokeWidth="2.5" />
      <text x="252" y="36" textAnchor="middle" fontSize="12" fontWeight="700" fill="#007aff" fontFamily="system-ui, sans-serif">Tilføj</text>
      <rect x="44" y="54" width="232" height="52" rx="10" fill="#fff" />
      <rect x="54" y="62" width="36" height="36" rx="9" fill="#1f6b3a" />
      <text x="102" y="78" fontSize="12" fontWeight="700" fill="#1c1c1e" fontFamily="system-ui, sans-serif">Holdbold</text>
      <text x="102" y="94" fontSize="10" fill="#8e8e93" fontFamily="system-ui, sans-serif">holdbold.dk</text>
      <rect x="44" y="118" width="232" height="44" rx="10" fill="#fff" stroke={HIGHLIGHT} strokeWidth="2.5" />
      <text x="58" y="145" fontSize="12" fill="#1c1c1e" fontFamily="system-ui, sans-serif">Åbn som webapp</text>
      <rect x="230" y="130" width="34" height="20" rx="10" fill="#34c759" />
      <circle cx="254" cy="140" r="8" fill="#fff" />
    </Frame>
  );
}
