export const REPORT_REASONS = ["inappropriate", "fraud", "spam", "safety", "legal", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
