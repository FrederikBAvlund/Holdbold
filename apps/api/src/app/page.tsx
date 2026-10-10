import Image from "next/image";
import { buttonClasses } from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";

const features: Array<{ t: string; d: string; icon: IconName }> = [
  { t: "Samlet kalender", d: "Kampe, træning og møder – med tilmelding med ét tryk.", icon: "calendar" },
  { t: "Bødekasse", d: "Skabeloner, status og betaling, der er nemme at følge.", icon: "receipt" },
  { t: "Notifikationer", d: "Alle ved, hvad der gælder, uden endnu en gruppechat.", icon: "bell" }
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 pb-10 pt-[max(1.25rem,env(safe-area-inset-top,0px))] sm:px-8">
      <header className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2.5">
          <Image src="/brand/holdbold-mark-ball.svg" alt="" width={40} height={40} className="h-9 w-9" priority />
          <span className="font-display text-2xl font-extrabold uppercase tracking-tight text-ink">Holdbold</span>
        </span>
        <a href="/login" className={buttonClasses({ variant: "secondary", size: "sm" })}>
          Log ind
        </a>
      </header>

      <section className="hero-surface relative animate-rise overflow-hidden rounded-[1.75rem] px-6 py-12 text-on-primary sm:px-10 sm:py-16">
        <div className="relative flex flex-col gap-6">
          <h1 className="font-display text-[3rem] font-extrabold uppercase leading-[0.92] tracking-tight sm:text-7xl">
            Holdlivet samlet i én app
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-on-primary/85">
            Overblik over kampe, træning og opgaver – med tilmelding, bøder og beskeder samlet, så I kan bruge tiden på
            holdet i stedet for på administration.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="/signup" className={buttonClasses({ variant: "inverse", size: "lg", className: "bg-on-primary !text-primary hover:bg-on-primary" })}>
              Opret bruger
            </a>
            <a href="/login" className={buttonClasses({ variant: "inverse", size: "lg" })}>
              Log ind
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-[1.375rem] border border-line bg-surface p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
          <Icon name="users" />
        </span>
        <h2 className="mt-3 font-display text-2xl font-bold uppercase leading-tight text-ink">Vil du oprette dit eget hold?</h2>
        <p className="mt-1 max-w-xl text-sm text-ink/65">
          Skriv til os, så sætter vi jeres hold op i Holdbold. Har I allerede et hold, kan du i stedet bede din admin om et
          invitationslink.
        </p>
        <a
          href="mailto:kontakt@holdbold.dk?subject=Opret%20nyt%20hold%20i%20Holdbold"
          className={buttonClasses({ variant: "primary", size: "md", className: "mt-4" })}
        >
          Kontakt kontakt@holdbold.dk
        </a>
      </section>

      <ul className="stagger grid gap-3 sm:grid-cols-3">
        {features.map((f) => (
          <li key={f.t} className="rounded-[1.375rem] border border-line bg-surface p-5 shadow-[var(--shadow-sm)]">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-moss">
              <Icon name={f.icon} />
            </span>
            <p className="mt-3 font-display text-xl font-bold uppercase leading-tight text-ink">{f.t}</p>
            <p className="mt-1 text-sm text-ink/65">{f.d}</p>
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-4 text-center text-sm text-ink/55">
        Ved brug af Holdbold accepterer du vores{" "}
        <a href="/privatliv" className="font-medium text-moss underline decoration-moss/30 underline-offset-4">
          privatlivspolitik
        </a>
        .
      </p>
    </main>
  );
}
