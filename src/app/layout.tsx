import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: { default: "Sous Nos Ailes — Garde d'enfants et professionnels pour vos évènements", template: "%s · Sous Nos Ailes" },
  description:
    "Trouvez des professionnels de la garde d'enfants et de l'évènementiel, organisez votre mariage, baptême ou séminaire et coordonnez tous vos prestataires depuis un seul espace.",
  applicationName: "Sous Nos Ailes",
  robots: env.INDEXING_ENABLED ? { index: true, follow: true } : { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#1f2026" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="fr" suppressHydrationWarning data-scroll-behavior="smooth">
      {/* suppressHydrationWarning: browser extensions (ColorZilla, Grammarly…) add attributes to <body> before React hydrates. */}
      <body className="min-h-dvh bg-background text-foreground" suppressHydrationWarning>
        <ThemeProvider nonce={nonce}>
          <a href="#contenu" className="sr-only-focusable fixed top-2 left-2 z-[100] rounded-md bg-primary px-3 py-2 text-primary-foreground">
            Aller au contenu
          </a>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
