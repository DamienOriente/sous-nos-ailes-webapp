import type { Metadata } from "next";
import "@fontsource/young-serif/400.css";
import "@fontsource-variable/figtree/index.css";
import "./globals.css";
import { getEnv } from "@/lib/env";

// Every page reads editable settings from the database: render dynamically,
// so `next build` needs no database and content is always current.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const env = getEnv();
  return {
    metadataBase: new URL(env.APP_URL),
    title: {
      default: "Les Petits Invités — avec Marie",
      template: "%s · Les Petits Invités",
    },
    description:
      "Garde et accompagnement d’enfants lors de mariages, fêtes privées et événements professionnels, coordonnés par Marie.",
    robots: env.INDEXING_ENABLED
      ? { index: true, follow: true }
      : { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    icons: { icon: "/icon.svg" },
    openGraph: {
      type: "website",
      locale: "fr_FR",
      siteName: "Les Petits Invités — avec Marie",
    },
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
