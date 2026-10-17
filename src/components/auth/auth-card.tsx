import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Centered card shared by every authentication page (the (auth) layout provides the centering). */
export function AuthCard({
  eyebrow,
  title,
  description,
  children,
  footer,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-6 border-border/70 shadow-sm", className)}>
      <CardHeader className="gap-2">
        {eyebrow && <p className="text-xs font-semibold tracking-[0.12em] text-primary uppercase">{eyebrow}</p>}
        <h1 className="font-heading text-2xl leading-tight font-semibold text-balance">{title}</h1>
        {description && <CardDescription className="text-pretty">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer && <CardFooter className="flex-col items-start gap-2 border-t pt-5 text-sm text-muted-foreground">{footer}</CardFooter>}
    </Card>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
