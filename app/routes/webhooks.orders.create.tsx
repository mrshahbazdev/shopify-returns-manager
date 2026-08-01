import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic === "orders/create") {
    // Persist order data here if you want to avoid querying Shopify on every
    // customer portal lookup. For now we log to keep the webhook healthy.
    console.log(`Order created for ${shop}:`, payload?.id);
  }

  return new Response();
};
