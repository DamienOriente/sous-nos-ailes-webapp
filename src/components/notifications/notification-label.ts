import { NOTIFICATION_TYPE_LABELS } from "@/modules/notifications/domain/types";

export function notificationLabel(type: string): string {
  return (NOTIFICATION_TYPE_LABELS as Record<string, string>)[type] ?? "Notification";
}
