import type { AdminApiContext } from "@shopify/shopify-app-remix/server";

export interface RefundLineItem {
  lineItemId: string;
  quantity: number;
}

export async function createShopifyRefund(
  admin: AdminApiContext,
  orderId: string,
  lineItems: RefundLineItem[],
  note?: string,
): Promise<{ success: true; refundId: string } | { success: false; error: string }> {
  const refundLineItems = lineItems.map((item) => ({
    lineItemId: item.lineItemId,
    quantity: item.quantity,
    restockType: "RETURN",
  }));

  const response = await admin.graphql(
    `#graphql
    mutation orderCreateRefund($orderId: ID!, $refundLineItems: [RefundLineItemInput!]!, $note: String) {
      orderCreateRefund(orderId: $orderId, refundLineItems: $refundLineItems, note: $note) {
        refund { id }
        userErrors { field message }
      }
    }`,
    { variables: { orderId, refundLineItems, note } },
  );
  const json = (await response.json()) as any;
  const data = json?.data?.orderCreateRefund;

  if (data?.userErrors?.length) {
    const messages = data.userErrors.map((e: any) => e.message).join("; ");
    return { success: false, error: messages };
  }

  if (data?.refund?.id) {
    return { success: true, refundId: data.refund.id };
  }

  return { success: false, error: "Unknown error creating refund" };
}

export interface ExchangeLineItem {
  variantId: string;
  quantity: number;
  title: string;
}

export async function createShopifyExchangeOrder(
  admin: AdminApiContext,
  orderId: string,
  email: string | null,
  lineItems: ExchangeLineItem[],
  note?: string,
): Promise<{ success: true; orderId: string; orderName: string } | { success: false; error: string }> {
  const input: any = {
    lineItems: lineItems.map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      title: item.title,
    })),
    note: note || `Exchange for order ${orderId}`,
    tags: ["exchange"],
  };
  if (email) {
    input.email = email;
  }

  const createResponse = await admin.graphql(
    `#graphql
    mutation draftOrderCreate($input: DraftOrderInput!) {
      draftOrderCreate(input: $input) {
        draftOrder { id name }
        userErrors { field message }
      }
    }`,
    { variables: { input } },
  );
  const createJson = (await createResponse.json()) as any;
  const draftData = createJson?.data?.draftOrderCreate;

  if (draftData?.userErrors?.length) {
    return { success: false, error: draftData.userErrors.map((e: any) => e.message).join("; ") };
  }

  const draftOrderId = draftData?.draftOrder?.id;
  if (!draftOrderId) {
    return { success: false, error: "Draft order not created" };
  }

  const completeResponse = await admin.graphql(
    `#graphql
    mutation draftOrderComplete($id: ID!) {
      draftOrderComplete(id: $id) {
        draftOrder { id order { id name } }
        userErrors { field message }
      }
    }`,
    { variables: { id: draftOrderId } },
  );
  const completeJson = (await completeResponse.json()) as any;
  const completeData = completeJson?.data?.draftOrderComplete;

  if (completeData?.userErrors?.length) {
    return { success: false, error: completeData.userErrors.map((e: any) => e.message).join("; ") };
  }

  const order = completeData?.draftOrder?.order;
  if (order?.id && order?.name) {
    return { success: true, orderId: order.id, orderName: order.name };
  }

  return { success: false, error: "Draft order did not complete" };
}
