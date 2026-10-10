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

function PageSkeleton() {
  return (
    <g>
      <rect x="20" y="16" width="280" height="40" rx="10" fill="#fff" />
      <rect x="20" y="66" width="180" height="12" rx="6" fill="#d6d9df" />
      <rect x="20" y="88" width="240" height="12" rx="6" fill="#d6d9df" />
      <rect x="20" y="110" width="140" height="12" rx="6" fill="#d6d9df" />
    </g>
  );
}

/** Nyere Safari (iOS 26+): rund tilbage-knap, adressefelt med sideikon, fanerknap. */
function NewSafariBar({ highlight }: { highlight?: boolean }) {
  return (
    <g>
      <circle cx="30" cy="172" r="16" fill="#f6f6f8" stroke="#d1d1d6" />
      <path d="M33 164l-8 8 8 8" fill="none" stroke="#3c3c43" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="54" y="156" width="212" height="32" rx="16" fill="#f6f6f8" stroke="#d1d1d6" />
      <g stroke="#3c3c43" strokeWidth="1.8" strokeLinecap="round">
        <path d="M74 167h12M74 172h12M74 177h7" />
      </g>
      <text x="160" y="176" textAnchor="middle" fontSize="12" fill="#1c1c1e" fontFamily="system-ui, sans-serif">holdbold.dk</text>
      <path d="M247 166a7 7 0 1 0 2 7M249 164v5h-5" fill="none" stroke="#3c3c43" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="290" cy="172" r="16" fill="#f6f6f8" stroke="#d1d1d6" />
      <rect x="283" y="165" width="12" height="12" rx="3" fill="none" stroke="#3c3c43" strokeWidth="1.8" />
      {highlight ? <Pulse x={80} y={172} r={14} /> : null}
    </g>
  );
}

/** Trin (nyere iOS): tryk på sideikonet yderst til venstre i adressefeltet. */
export function SafariMoreIllustration() {
  return (
    <Frame label="Safari med sideikonet yderst til venstre i adressefeltet markeret">
      <PageSkeleton />
      <NewSafariBar highlight />
    </Frame>
  );
}

function MenuItem({ y, label, active, icon }: { y: number; label: string; active?: boolean; icon: ReactNode }) {
  return (
    <g>
      {active ? <rect x="62" y={y - 14} width="196" height="28" rx="8" fill={HIGHLIGHT} fillOpacity="0.22" stroke={HIGHLIGHT} strokeWidth="2.5" /> : null}
      <g transform={`translate(74 ${y - 8})`} fill="none" stroke="#1c1c1e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </g>
      <text x="104" y={y + 4} fontSize="12" fill="#1c1c1e" fontFamily="system-ui, sans-serif" fontWeight={active ? 700 : 400}>
        {label}
      </text>
    </g>
  );
}

/** Trin (nyere iOS): menu med "Del" øverst. */
export function SafariShareIllustration() {
  return (
    <Frame label="Safari-menu med punktet Del øverst markeret">
      <PageSkeleton />
      <NewSafariBar />
      <rect x="50" y="10" width="220" height="140" rx="16" fill="#fbfbfd" stroke="#d1d1d6" />
      <MenuItem y={32} label="Del" active icon={<path d="M8 11v6H2v-6M5 12V1M2 4l3-3 3 3" />} />
      <MenuItem y={62} label="Føj til Bogmærker" icon={<path d="M1 1h8v14L5 12l-4 3z" />} />
      <MenuItem y={92} label="Find på side" icon={<path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM11 11l4 4" />} />
      <MenuItem y={122} label="Zoom på side" icon={<path d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM11 11l4 4M5 7h4M7 5v4" />} />
    </Frame>
  );
}

/** Klassisk Safari (iOS 18 og ældre): Del-ikonet i værktøjslinjen i bunden. */
export function SafariToolbarShareIllustration() {
  return (
    <Frame label="Safari med Del-ikonet i værktøjslinjen i bunden markeret">
      <PageSkeleton />
      <rect x="0" y="124" width="320" height="76" fill="#f6f6f8" />
      <rect x="14" y="130" width="292" height="22" rx="8" fill="#e1e3e8" />
      <text x="160" y="145" textAnchor="middle" fontSize="11" fill="#3c3c43" fontFamily="system-ui, sans-serif">holdbold.dk</text>
      <g fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M34 166l-7 7 7 7" />
        <path d="M86 166l7 7-7 7" />
        <g transform="translate(150 160)">
          <path d="M3 8H1v14h18V8h-2M10 15V1M6 5l4-4 4 4" />
        </g>
        <path d="M222 167h22v14h-22zM233 167v14" />
        <rect x="278" y="166" width="14" height="14" rx="3" />
      </g>
      <Pulse x={160} y={173} r={17} />
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
      <text x="46" y="36" fontSize="11" fill="#007aff" fontFamily="system-ui, sans-serif">Annuller</text>
      <text x="148" y="36" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1c1c1e" fontFamily="system-ui, sans-serif">Føj til hjemmeskærm</text>
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
