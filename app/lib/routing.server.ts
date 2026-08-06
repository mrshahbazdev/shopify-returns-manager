import type { ReturnRequest, ShopSettings } from "@prisma/client";

export function shouldAutoApprove(
  returnRequest: ReturnRequest,
  settings: ShopSettings,
): { autoApprove: boolean; reason?: string } {
  if (!settings.autoApproveEnabled) {
    return { autoApprove: false, reason: "Auto-approval disabled" };
  }

  const threshold = Number(settings.autoApproveThreshold || 0);
  if (threshold <= 0) {
    return { autoApprove: false, reason: "Auto-approve threshold not set" };
  }

  const total = Number(returnRequest.totalRefund || 0);
  if (total > threshold) {
    return { autoApprove: false, reason: "Total exceeds auto-approve threshold" };
  }

  const rejectReasons = (settings.autoRejectReasons || "")
    .split(",")
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (rejectReasons.includes(returnRequest.reason.toLowerCase())) {
    return { autoApprove: false, reason: "Reason is on auto-reject list" };
  }

  if (returnRequest.resolution === "EXCHANGE" && !settings.allowExchanges) {
    return { autoApprove: false, reason: "Exchanges not allowed" };
  }

  if (returnRequest.resolution === "STORE_CREDIT" && !settings.allowStoreCredit) {
    return { autoApprove: false, reason: "Store credit not allowed" };
  }

  return { autoApprove: true };
}
