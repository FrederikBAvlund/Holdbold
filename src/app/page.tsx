import Image from "next/image";

export default function Home() {
  return (
    <main className="px-4 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[86vh] w-full max-w-6xl items-center">
        <section className="card relative w-full overflow-hidden p-7 sm:p-12">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-ember/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-8 h-64 w-64 rounded-full bg-sky/25 blur-3xl" />

          <div className="relative flex flex-col gap-8">
            <Image
              src="/brand/holdbold-logo-ball.svg"
              alt="Holdbold"
              width={560}
              height={150}
              className="h-auto w-full max-w-[560px]"
              priority
            />

            <div>
              <h1
                className="max-w-4xl text-4xl font-semibold leading-tight text-ink sm:text-6xl"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Alt til holdstyring samlet i en app.
              </h1>
              <p className="mt-5 max-w-3xl text-lg text-ink/75">
                Holdbold giver overblik over kalender, tilmeldinger, notifikationer og bøder i et enkelt flow, der
                fungerer pa både mobil og desktop.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <a href="/login" className="btn-primary">
                Log ind
              </a>
              <a href="/signup" className="btn-ghost">
                Opret bruger
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
