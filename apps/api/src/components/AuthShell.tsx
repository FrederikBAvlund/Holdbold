import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthShell({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center px-4 pb-10 pt-[max(2rem,env(safe-area-inset-top,0px))] sm:justify-center sm:px-6">
      <div className="w-full max-w-md animate-rise">
        <a href="/" className="mb-8 inline-flex items-center" aria-label="Holdbold forside">
          <span className="inline-flex items-center gap-2.5">
            <Image src="/brand/holdbold-mark-ball.svg" alt="" width={40} height={40} className="h-9 w-9" priority />
            <span className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">Holdbold</span>
          </span>
        </a>
        <div className="mb-6 space-y-2">
          <h1 className="font-display text-[2.4rem] font-extrabold uppercase leading-[0.95] tracking-tight text-ink">{title}</h1>
          <p className="text-[0.95rem] text-ink/65">{subtitle}</p>
        </div>
        <div className="rounded-[1.375rem] border border-line bg-surface shadow-[var(--shadow-sm)] p-5 sm:p-7">{children}</div>
      </div>
    </main>
  );
}
