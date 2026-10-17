"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Crown, KeyRound, LogOut, ShieldAlert, UserX } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormMessage } from "@/components/shared/form-message";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionResult } from "@/lib/errors";
import { cn, formatDateFr, initials } from "@/lib/utils";
import { EVENT_ROLE_LABELS, EVENT_ROLE_PERMISSIONS, TRADE_PERMISSIONS, type EventPermission, type EventRole } from "@/modules/authorization/domain/permissions";
import type { CategoryOption } from "@/modules/events/application/categories";
import { PERMISSION_GROUPS } from "@/modules/events/domain/permission-labels";
import { ASSIGNABLE_ROLES } from "@/modules/events/domain/providers";

export type MemberView = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  role: EventRole;
  status: string;
  categoryName: string | null;
  categorySlug: string | null;
  title: string | null;
  joinedAt: Date | null;
  overrides: Array<{ id: string; permission: string; effect: "allow" | "deny"; expiresAt: Date | null; grantedByName: string | null }>;
  effective: EventPermission[];
  isSelf: boolean;
};

type Actions = {
  changeRole: (eventId: string, memberId: string, input: unknown) => Promise<ActionResult>;
  revoke: (eventId: string, memberId: string, reason?: string) => Promise<ActionResult>;
  transfer: (eventId: string, memberId: string) => Promise<ActionResult>;
  setPermission: (eventId: string, memberId: string, input: unknown) => Promise<ActionResult>;
  removePermission: (eventId: string, memberId: string, permission: string) => Promise<ActionResult>;
};

export function MemberRow({ eventId, member, isOwnerRow, viewer, categories, actions }: { eventId: string; member: MemberView; isOwnerRow: boolean; viewer: { isOwner: boolean; canManage: boolean; canPermissions: boolean; memberId: string }; categories: CategoryOption[]; actions: Actions }) {
  const router = useRouter();
  const editable = !isOwnerRow && !member.isSelf;
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{initials(member.name)}</div>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{member.name}</span>
            {member.isSelf && <span className="text-xs text-muted-foreground">(vous)</span>}
            {isOwnerRow && <Crown className="size-3.5 text-gold" aria-label="Propriétaire" />}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {EVENT_ROLE_LABELS[member.role]}
            {member.categoryName ? ` · ${member.categoryName}` : ""}
            {member.email ? ` · ${member.email}` : ""}
            {member.joinedAt ? ` · depuis le ${formatDateFr(member.joinedAt)}` : ""}
          </p>
          {member.overrides.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {member.overrides.map((o) => (
                <StatusBadge key={o.id} tone={o.effect === "allow" ? "success" : "danger"} dot={false} className="text-[11px]">
                  {o.effect === "allow" ? "+" : "−"} {o.permission}
                  {o.expiresAt ? ` (→ ${formatDateFr(o.expiresAt, { day: "numeric", month: "short" })})` : ""}
                </StatusBadge>
              ))}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {viewer.canPermissions && editable && <PermissionsDialog eventId={eventId} member={member} actions={actions} />}
        {viewer.canManage && editable && <RoleDialog eventId={eventId} member={member} categories={categories} canElevate={viewer.canPermissions} action={actions.changeRole} />}
        {viewer.isOwner && editable && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm">
                <Crown className="size-3.5" aria-hidden="true" />
                Transférer
              </Button>
            }
            title={`Transférer la propriété à ${member.name} ?`}
            description="Vous deviendrez organisateur principal. Seul le nouveau propriétaire pourra supprimer l'évènement ou le transférer de nouveau."
            confirmLabel="Transférer"
            onConfirm={async () => {
              const res = await actions.transfer(eventId, member.id);
              if (res.ok) router.refresh();
              return res;
            }}
          />
        )}
        {viewer.canManage && editable && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="sm" className="text-destructive">
                <UserX className="size-3.5" aria-hidden="true" />
                Révoquer
              </Button>
            }
            title={`Révoquer l'accès de ${member.name} ?`}
            description="Effet immédiat : plus d'accès au planning, aux messages ni aux documents. L'action est journalisée et la personne est informée."
            confirmLabel="Révoquer"
            successMessage="Accès révoqué."
            onConfirm={async () => {
              const res = await actions.revoke(eventId, member.id);
              if (res.ok) router.refresh();
              return res;
            }}
          />
        )}
      </div>
    </li>
  );
}

function RoleDialog({ eventId, member, categories, canElevate, action }: { eventId: string; member: MemberView; categories: CategoryOption[]; canElevate: boolean; action: Actions["changeRole"] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>(member.role === "owner" ? "collaborator" : member.role);
  const [cat, setCat] = useState<string>(member.categorySlug ?? "none");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const roles = ASSIGNABLE_ROLES.filter((r) => canElevate || !["lead_organizer", "co_organizer", "wedding_planner"].includes(r));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Rôle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer le rôle de {member.name}</DialogTitle>
          <DialogDescription>Le rôle fixe les droits par défaut ; le métier débloque les outils dédiés (enfants, traiteur, lieu…).</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              const res = await action(eventId, member.id, { role, categorySlug: cat === "none" ? null : cat, title: String(fd.get("title") ?? "") || null });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              toast.success("Rôle mis à jour.");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="r-role">Rôle</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="r-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {EVENT_ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-cat">Métier</Label>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger id="r-cat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-title">Intitulé affiché (optionnel)</Label>
            <Input id="r-title" name="title" defaultValue={member.title ?? ""} maxLength={80} placeholder="Responsable espace enfants" />
          </div>
          <FormMessage error={error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={pending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PermissionsDialog({ eventId, member, actions }: { eventId: string; member: MemberView; actions: Actions }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [expires, setExpires] = useState("");
  const defaults = new Set<EventPermission>(EVENT_ROLE_PERMISSIONS[member.role]);
  if (member.categorySlug && (member.role === "provider" || member.role === "staff")) for (const p of TRADE_PERMISSIONS[member.categorySlug] ?? []) defaults.add(p);
  const effective = new Set(member.effective);
  const overrideFor = (key: string) => member.overrides.find((o) => o.permission === key);

  function apply(permission: EventPermission, effect: "allow" | "deny" | "reset") {
    start(async () => {
      const res = effect === "reset" ? await actions.removePermission(eventId, member.id, permission) : await actions.setPermission(eventId, member.id, { permission, effect, expiresAt: expires ? new Date(expires).toISOString() : null });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Permission mise à jour.");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <KeyRound className="size-3.5" aria-hidden="true" />
          Permissions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissions de {member.name}</DialogTitle>
          <DialogDescription>
            Rôle : {EVENT_ROLE_LABELS[member.role]}
            {member.categoryName ? ` · ${member.categoryName}` : ""}. Les règles explicites complètent ou retirent les droits du rôle ; un refus l'emporte toujours.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="perm-expires">Expiration des prochaines règles (optionnel)</Label>
          <Input id="perm-expires" type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)} className="max-w-xs" />
        </div>
        <div className="space-y-5">
          {PERMISSION_GROUPS.map((g) => (
            <section key={g.title} aria-labelledby={`pg-${g.title}`}>
              <h3 id={`pg-${g.title}`} className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {g.title}
              </h3>
              <ul className="divide-y rounded-xl border">
                {g.permissions.map((p) => {
                  const o = overrideFor(p.key);
                  const byRole = defaults.has(p.key);
                  const on = effective.has(p.key);
                  return (
                    <li key={p.key} className={cn("flex flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between", p.sensitive && "bg-destructive/5")}>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className={cn("font-medium", !on && "text-muted-foreground")}>{p.label}</span>
                          <StatusBadge tone={on ? "success" : "neutral"} dot={false} className="text-[11px]">
                            {on ? "Accordé" : "Refusé"}
                          </StatusBadge>
                          {o && (
                            <StatusBadge tone={o.effect === "allow" ? "info" : "danger"} dot={false} className="text-[11px]">
                              règle explicite{o.expiresAt ? ` jusqu'au ${formatDateFr(o.expiresAt, { day: "numeric", month: "short" })}` : ""}
                            </StatusBadge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <code className="text-[11px]">{p.key}</code> · par défaut pour ce rôle : {byRole ? "oui" : "non"}
                        </p>
                        {p.sensitive && (
                          <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                            Donnée de santé : accès strictement nécessaire, journalisé à chaque consultation. Privilégiez une expiration.
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button size="xs" variant={o?.effect === "allow" ? "default" : "outline"} disabled={pending} onClick={() => apply(p.key, "allow")}>
                          Autoriser
                        </Button>
                        <Button size="xs" variant={o?.effect === "deny" ? "destructive" : "outline"} disabled={pending} onClick={() => apply(p.key, "deny")}>
                          Refuser
                        </Button>
                        {o && (
                          <Button size="xs" variant="ghost" disabled={pending} onClick={() => apply(p.key, "reset")}>
                            Rôle
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function PendingInvitationRow({ eventId, invitation, action }: { eventId: string; invitation: { id: string; recipientName: string; recipientEmail: string | null; targetRole: string | null; sentAt: string | null; expiresAt: string | null }; action: (eventId: string, invitationId: string) => Promise<ActionResult> }) {
  const router = useRouter();
  const [role] = (invitation.targetRole ?? "provider").split(":");
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">
          {invitation.recipientName} <span className="text-xs font-normal text-muted-foreground">{invitation.recipientEmail}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {EVENT_ROLE_LABELS[(role as EventRole) ?? "provider"] ?? role} · envoyée {invitation.sentAt ? formatDateFr(invitation.sentAt) : ""}
          {invitation.expiresAt ? ` · expire le ${formatDateFr(invitation.expiresAt)}` : ""}
        </p>
      </div>
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm" className="text-destructive">
            Révoquer
          </Button>
        }
        title="Révoquer cette invitation ?"
        description="Le lien envoyé ne fonctionnera plus."
        confirmLabel="Révoquer"
        onConfirm={async () => {
          const res = await action(eventId, invitation.id);
          if (res.ok) router.refresh();
          return res;
        }}
      />
    </li>
  );
}

export function LeaveEventButton({ eventId, action }: { eventId: string; action: (eventId: string) => Promise<ActionResult> }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive">
          <LogOut className="size-3.5" aria-hidden="true" />
          Quitter l'évènement
        </Button>
      }
      title="Quitter cet évènement ?"
      description="Vous perdrez l'accès à l'espace. L'organisateur pourra vous réinviter."
      confirmLabel="Quitter"
      onConfirm={async () => {
        const res = await action(eventId);
        if (res.ok) router.push("/app/evenements");
        return res;
      }}
    />
  );
}

export function DangerNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}
