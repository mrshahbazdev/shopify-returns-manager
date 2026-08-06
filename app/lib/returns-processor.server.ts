import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { createShopifyRefund, createShopifyExchangeOrder } from "./shopify-orders.server";
import { sendNotification } from "./notifications.server";
import { issueStoreCredit, updateReturnRequest, updateExchangeRequest, getReturnRequest, getExchangeRequest } from "../models/returns.server";
import type { ReturnRequest, ExchangeRequest, ShopSettings } from "@prisma/client";
import { shouldAutoApprove } from "./routing.server";

interface CommonData {
  customerName: string;
  rmaNumber: string;
  orderName: string;
  amount: string;
  reason: string;
  trackingNumber?: string;
  carrier?: string;
}

function buildData(request: ReturnRequest | ExchangeRequest, amount?: number): CommonData {
  return {
    customerName: request.customerName || "Customer",
    rmaNumber: request.rmaNumber,
    orderName: request.orderName,
    amount: amount !== undefined ? `$${amount.toFixed(2)}` : "$0.00",
    reason: request.reason,
    trackingNumber: request.trackingNumber || "",
    carrier: request.carrier || "",
  };
}

export async function notify(
  request: ReturnRequest | ExchangeRequest,
  event: any,
  channel: "EMAIL" | "SMS",
  extraData?: Record<string, string | number | undefined>,
) {
  if (!request.customerEmail) return;
  const isReturn = "resolution" in request;
  const data = { ...buildData(request), ...extraData };
  await sendNotification({
    shop: request.shop,
    channel,
    to: request.customerEmail,
    event,
    data,
    returnRequestId: isReturn ? request.id : undefined,
    exchangeRequestId: isReturn ? undefined : request.id,
  });
}

export async function processAutoApproval(
  returnRequest: ReturnRequest,
  settings: ShopSettings,
  admin: AdminApiContext,
) {
  const { autoApprove, reason } = shouldAutoApprove(returnRequest, settings);
  if (!autoApprove) return { autoApproved: false, reason };

  const request = await updateReturnRequest(returnRequest.id, returnRequest.shop, { status: "APPROVED" });

  await notify(request, "return_approved", "EMAIL");

  if (request.resolution === "STORE_CREDIT" && request.customerEmail) {
    const amount = Number(request.totalRefund || 0);
    await issueStoreCredit(
      request.shop,
      request.customerEmail,
      amount,
      `Auto-approved store credit for ${request.rmaNumber}`,
      request.id,
    );
    await updateReturnRequest(request.id, request.shop, {
      status: "COMPLETED",
      storeCreditIssued: amount,
    });
    await notify(request, "return_refunded", "EMAIL", { amount: amount.toFixed(2) });
  } else if (request.resolution === "REFUND") {
    const result = await createShopifyRefund(
      admin,
      request.orderId,
      request.lineItems.map((item: any) => ({ lineItemId: item.lineItemId, quantity: item.quantity })),
      `Auto-approved return ${request.rmaNumber}`,
    );
    if (result.success) {
      await updateReturnRequest(request.id, request.shop, {
        status: "COMPLETED",
        refundStatus: "ISSUED",
        shopifyRefundId: result.refundId,
      });
      await notify(request, "return_refunded", "EMAIL", { amount: Number(request.totalRefund || 0).toFixed(2) });
    } else {
      await updateReturnRequest(request.id, request.shop, {
        refundStatus: "FAILED",
        refundError: result.error,
      });
    }
  }

  return { autoApproved: true };
}

export async function processRefund(
  returnRequestId: string,
  shop: string,
  admin: AdminApiContext,
) {
  const request = await getReturnRequest(returnRequestId, shop);
  if (!request) throw new Error("Return request not found");

  const result = await createShopifyRefund(
    admin,
    request.orderId,
    request.lineItems.map((item: any) => ({ lineItemId: item.lineItemId, quantity: item.quantity })),
    `Manual refund for ${request.rmaNumber}`,
  );

  if (result.success) {
    await updateReturnRequest(request.id, shop, {
      status: "COMPLETED",
      refundStatus: "ISSUED",
      shopifyRefundId: result.refundId,
    });
    await notify(request, "return_refunded", "EMAIL", { amount: Number(request.totalRefund || 0).toFixed(2) });
    return { success: true, refundId: result.refundId };
  }

  await updateReturnRequest(request.id, shop, {
    refundStatus: "FAILED",
    refundError: result.error,
  });
  return { success: false, error: result.error };
}

export async function processStoreCredit(
  returnRequestId: string,
  shop: string,
) {
  const request = await getReturnRequest(returnRequestId, shop);
  if (!request || !request.customerEmail) throw new Error("Return request not found or missing customer email");

  const amount = Number(request.totalRefund || 0);
  await issueStoreCredit(
    shop,
    request.customerEmail,
    amount,
    `Store credit for ${request.rmaNumber}`,
    request.id,
  );
  const updated = await updateReturnRequest(request.id, shop, {
    status: "COMPLETED",
    storeCreditIssued: amount,
  });
  await notify(updated, "return_refunded", "EMAIL", { amount: amount.toFixed(2) });
  return { success: true };
}

export async function processExchangeOrder(
  exchangeRequestId: string,
  shop: string,
  admin: AdminApiContext,
) {
  const request = await getExchangeRequest(exchangeRequestId, shop);
  if (!request) throw new Error("Exchange request not found");

  const result = await createShopifyExchangeOrder(
    admin,
    request.orderId,
    request.customerEmail,
    request.lineItems.map((item: any) => ({
      variantId: item.newVariantId,
      quantity: item.quantity,
      title: item.newTitle,
    })),
    `Exchange for ${request.rmaNumber}`,
  );

  if (result.success) {
    const updated = await updateExchangeRequest(request.id, shop, {
      status: "APPROVED",
      exchangeOrderId: result.orderId,
    });
    await notify(updated, "exchange_approved", "EMAIL");
    return { success: true, orderId: result.orderId, orderName: result.orderName };
  }

  return { success: false, error: result.error };
}
