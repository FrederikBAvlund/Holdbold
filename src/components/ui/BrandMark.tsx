import { cn } from "@/lib/utils";

/**
 * Holdbolds mærke (H-monogram med bold) i holdets farve, så det følger valgt tema.
 * Samme motiv som app-ikonet i src/app/brand-icon-svg.ts.
 */
export default function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary text-on-primary", className)}
    >
      <svg viewBox="0 0 1024 1024" className="h-full w-full">
        <g transform="skewX(-12) translate(104 0)" fill="currentColor">
          <rect x="250" y="220" width="160" height="584" rx="34" />
          <rect x="614" y="220" width="160" height="584" rx="34" />
          <rect x="380" y="462" width="264" height="100" />
        </g>
        <circle cx="512" cy="512" r="176" fill="var(--primary)" />
        <circle cx="512" cy="512" r="140" fill="currentColor" />
        <g stroke="var(--primary)" strokeWidth="18" strokeLinecap="round"><line x1="512" y1="462" x2="512" y2="383" /><line x1="560" y1="496" x2="634" y2="472" /><line x1="542" y1="553" x2="588" y2="616" /><line x1="482" y1="553" x2="436" y2="616" /><line x1="464" y1="496" x2="390" y2="472" /></g>
        <polygon points="512,462 560,496 542,553 482,553 464,496" fill="var(--primary)" stroke="var(--primary)" strokeWidth="14" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
