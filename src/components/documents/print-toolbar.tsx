"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/** Small toolbar above printable documents; hidden when printing. */
export function PrintToolbar({ backHref, backLabel = "Retour" }: { backHref: string; backLabel?: string }) {
  return (
    <div className="no-print container-page flex items-center justify-between gap-4 py-4">
      <Link href={backHref} className="text-[15px] font-semibold text-sage-800 hover:underline">
        ← {backLabel}
      </Link>
      <button type="button" onClick={() => window.print()} className={buttonClasses({ variant: "secondary", size: "sm" })}>
        Imprimer ou enregistrer en PDF
      </button>
    </div>
  );
}
