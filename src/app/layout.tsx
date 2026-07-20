import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { getCurrentSession } from "@/lib/auth";
import { readAppState } from "@/lib/store";
import { buildThemeGradient, themeToCssVariables } from "@/lib/theme";
import { Pill } from "@/components/ui";
import { SystemStatus } from "@/components/system-status";
import { ServiceWorkerManager } from "@/components/service-worker-manager";
import { LogoutButton } from "@/components/logout-button";
import "./globals.css";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const bodyFont = IBM_Plex_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Emberdex",
  description: "Un centre de commande Nuzlocke avec sauvegardes par code et administration privée.",
  manifest: "/manifest.webmanifest",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [state, session] = await Promise.all([readAppState(), getCurrentSession()]);

  return (
    <html
      lang="fr"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} antialiased`}
      style={themeToCssVariables(state.theme)}
    >
      <body className="min-h-screen bg-[color:var(--background)] text-[color:var(--text)]">
        <ServiceWorkerManager />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 overflow-hidden"
        >
          <div
            className="absolute inset-0 opacity-90"
            style={{ backgroundImage: buildThemeGradient(state.theme) }}
          />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header className="sticky top-4 z-20 mb-6 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)]/90 px-4 py-3 shadow-[var(--shadow)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="group flex items-center gap-3">
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-strong)] shadow-[var(--shadow)]">
                    <span className="h-3 w-3 rounded-full bg-[color:var(--accent)] shadow-[0_0_28px_var(--glow)]" />
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
                      Emberdex
                    </span>
                    <span className="block text-base font-medium text-[color:var(--text)]">
                      Votre compagnon Nuzlocke
                    </span>
                  </span>
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {session ? <Pill>{session.ownerName}</Pill> : null}
                <Link href="/" className="rounded-lg px-3 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--text)]">
                  Jouer
                </Link>
                {session ? (
                  <Link href="/admin" className="rounded-lg px-3 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--text)]">
                    Administration
                  </Link>
                ) : (
                  <Link href="/login" className="rounded-lg px-3 py-2 text-sm text-[color:var(--muted)] hover:text-[color:var(--text)]">
                    Espace propriétaire
                  </Link>
                )}
                {session ? <SystemStatus /> : null}
                {session ? <LogoutButton /> : null}
              </div>
            </div>
          </header>

          <main className="flex-1 pb-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
