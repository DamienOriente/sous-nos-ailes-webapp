import { StatusBadge } from "@/components/shared/status-badge";
import { INQUIRY_STATUS_LABELS, INQUIRY_STATUS_TONES, type InquiryStatus } from "@/modules/inquiries/domain/inquiry-status";

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return <StatusBadge tone={INQUIRY_STATUS_TONES[status]}>{INQUIRY_STATUS_LABELS[status]}</StatusBadge>;
}
