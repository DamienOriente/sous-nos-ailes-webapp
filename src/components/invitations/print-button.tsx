"use client";
import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Imprimer" }: { label?: string }) {
  return (
    <Button size="sm" onClick={() => window.print()}>
       {label}
    </Button>
  );
}
