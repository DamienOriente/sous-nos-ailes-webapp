import { AlertTriangle, Bell, CalendarClock, CheckCircle2, CreditCard, FileText, Mail, MessageSquare, ShieldCheck, UserPlus, Users, XCircle, type LucideIcon } from "lucide-react";
import { NOTIFICATION_TYPE_LABELS, type NotificationType } from "@/modules/notifications/domain/types";

const ICONS: Record<NotificationType, LucideIcon> = {
  invitation_received: Mail,
  invitation_accepted: CheckCircle2,
  rsvp_received: CheckCircle2,
  new_message: MessageSquare,
  inquiry_received: Mail,
  inquiry_updated: Mail,
  quote_accepted: CheckCircle2,
  document_added: FileText,
  deadline: CalendarClock,
  schedule_changed: CalendarClock,
  profile_approved: ShieldCheck,
  changes_requested: AlertTriangle,
  profile_rejected: XCircle,
  payment_alert: CreditCard,
  member_added: UserPlus,
  permission_changed: Users,
  system: Bell,
};

export function notificationLabel(type: string): string {
  return (NOTIFICATION_TYPE_LABELS as Record<string, string>)[type] ?? "Notification";
}

export function NotificationIcon({ type, className }: { type: string; className?: string }) {
  const Icon = (ICONS as Record<string, LucideIcon>)[type] ?? Bell;
  return <Icon className={className} aria-hidden="true" />;
}
