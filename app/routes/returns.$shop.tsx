import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, Form, useSearchParams } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  Banner,
  Checkbox,
  Select,
  InlineStack,
  DataTable,
  Badge,
} from "@shopify/polaris";
import { useState } from "react";
import { unauthenticated } from "../shopify.server";
import { createReturnRequest, getShopSettings } from "../models/returns.server";
import prisma from "../db.server";
import { serializeObject } from "../lib/serializers";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const shop = params.shop!;
  const url = new URL(request.url);
  const orderName = url.searchParams.get("orderName") || "";
  const email = url.searchParams.get("email") || "";

  const settings = await getShopSettings(shop);
  const reasons = settings.returnReasons?.split(",").map((r) => r.trim()).filter(Boolean) || [
    "Wrong size",
    "Defective",
    "Not as described",
    "Changed mind",
    "Other",
  ];

  if (!orderName || !email) {
    return serializeObject({ settings: { reasons }, order: null, existingRequests: [], error: null });
  }

  try {
    const { admin } = await unauthenticated.admin(shop);
    const response = await admin.graphql(
      `#graphql
      query getOrder($query: String!) {
        orders(first: 1, query: $query) {
          nodes {
            id
            name
            email
            processedAt
            customer {
              firstName
              lastName
            }
            lineItems(first: 50) {
              nodes {
                id
                title
                quantity
                variant {
                  id
                  title
                  price
                }
              }
            }
          }
        }
      }`,
      { variables: { query: `name:${orderName} email:${email}` } },
    );
    const responseJson = await response.json();
    const order = responseJson?.data?.orders?.nodes?.[0] || null;

    let windowError = null;
    if (order && order.processedAt) {
      const processedAt = new Date(order.processedAt);
      const windowEnd = new Date();
      windowEnd.setDate(windowEnd.getDate() - settings.returnWindowDays);
      if (processedAt < windowEnd) {
        windowError = `This order is outside the ${settings.returnWindowDays}-day return window.`;
      }
    }

    const existingRequests = order
      ? await prisma.returnRequest.findMany({
          where: { shop, orderId: order.id },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return serializeObject({
      settings: { reasons, returnWindowDays: settings.returnWindowDays },
      order,
      existingRequests,
      error: windowError || (order ? null : "Order not found."),
    });
  } catch (error) {
    return json({
      settings: { reasons, returnWindowDays: settings.returnWindowDays },
      order: null,
      existingRequests: [],
      error: "Unable to load order. Please contact support.",
    });
  }
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const shop = params.shop!;
  const formData = await request.formData();
  const orderId = formData.get("orderId") as string;
  const orderName = formData.get("orderName") as string;
  const customerEmail = formData.get("customerEmail") as string;
  const customerName = formData.get("customerName") as string;
  const reason = formData.get("reason") as string;
  const resolution = formData.get("resolution") as string;
  const lineItemData = formData.getAll("lineItems") as string[];

  const lineItems = lineItemData
    .map((item) => JSON.parse(item))
    .filter((item) => item.selected && item.quantity > 0)
    .map((item) => ({
      lineItemId: item.lineItemId,
      title: item.title,
      quantity: Number(item.quantity),
      price: Number(item.price),
      variantId: item.variantId,
    }));

  if (!orderId || !reason || lineItems.length === 0) {
    return json({
      success: false,
      error: "Please select at least one item and provide a reason.",
    });
  }

  await createReturnRequest({
    shop,
    orderId,
    orderName,
    customerEmail,
    customerName,
    reason,
    resolution: (resolution as any) || "REFUND",
    lineItems,
  });

  return json({ success: true, error: null });
};

export default function CustomerReturnsPortal() {
  const { settings, order, existingRequests, error } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orderName, setOrderName] = useState(searchParams.get("orderName") || "");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [selectedItems, setSelectedItems] = useState<Record<string, any>>({});
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("REFUND");

  const lookupOrder = () => {
    setSearchParams({ orderName, email });
  };

  const toggleItem = (lineItem: any) => {
    setSelectedItems((prev) => {
      const next = { ...prev };
      if (next[lineItem.id]) {
        delete next[lineItem.id];
      } else {
        next[lineItem.id] = {
          lineItemId: lineItem.id,
          title: lineItem.title,
          price: lineItem.variant?.price || 0,
          variantId: lineItem.variant?.id,
          quantity: 1,
          selected: true,
        };
      }
      return next;
    });
  };

  const updateQuantity = (id: string, quantity: string) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: { ...prev[id], quantity: Number(quantity) || 1 },
    }));
  };

  return (
    <Page title="Returns & Exchanges">
      <BlockStack gap="500">
        <Text as="h1" variant="headingXl">
          Start a return or exchange
        </Text>

        {error && <Banner tone="warning">{error}</Banner>}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Find your order
            </Text>
            <InlineStack gap="300" align="start" blockAlign="end">
              <TextField
                label="Order number"
                value={orderName}
                onChange={setOrderName}
                autoComplete="off"
                placeholder="#1001"
              />
              <TextField
                label="Email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                type="email"
              />
              <Button onClick={lookupOrder} variant="primary">
                Find order
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        {existingRequests.length > 0 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Existing requests for this order
              </Text>
              <DataTable
                columnContentTypes={["text", "text", "text"]}
                headings={["Status", "Resolution", "Date"]}
                rows={existingRequests.map((req: any) => [
                  <Badge key={req.id} tone={statusTone(req.status)}>
                    {req.status}
                  </Badge>,
                  req.resolution,
                  new Date(req.createdAt).toLocaleDateString(),
                ])}
              />
            </BlockStack>
          </Card>
        )}

        {order && !error && (
          <Form method="post">
            <BlockStack gap="400">
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="orderName" value={order.name} />
              <input type="hidden" name="customerEmail" value={order.email || email} />
              <input
                type="hidden"
                name="customerName"
                value={`${order.customer?.firstName || ""} ${order.customer?.lastName || ""}`.trim()}
              />

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Select items to return
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Select", "Product", "Qty to return", "Price"]}
                    rows={order.lineItems.nodes.map((item: any) => [
                      <Checkbox
                        key={`chk-${item.id}`}
                        label=""
                        checked={!!selectedItems[item.id]}
                        onChange={() => toggleItem(item)}
                      />,
                      `${item.title} ${item.variant?.title ? `(${item.variant.title})` : ""}`,
                      selectedItems[item.id] ? (
                        <TextField
                          key={`qty-${item.id}`}
                          label=""
                          value={String(selectedItems[item.id].quantity)}
                          onChange={(value) => updateQuantity(item.id, value)}
                          autoComplete="off"
                          type="number"
                          min={1}
                          max={item.quantity}
                        />
                      ) : (
                        "—"
                      ),
                      `$${Number(item.variant?.price || 0).toFixed(2)}`,
                    ])}
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Select
                    label="Reason for return"
                    options={settings.reasons.map((r: string) => ({ label: r, value: r }))}
                    value={reason}
                    onChange={setReason}
                    name="reason"
                  />
                  <Select
                    label="Preferred resolution"
                    options={[
                      { label: "Refund to original payment", value: "REFUND" },
                      { label: "Store credit", value: "STORE_CREDIT" },
                    ]}
                    value={resolution}
                    onChange={setResolution}
                    name="resolution"
                  />
                  {Object.values(selectedItems).map((item: any) => (
                    <input
                      key={item.lineItemId}
                      type="hidden"
                      name="lineItems"
                      value={JSON.stringify(item)}
                    />
                  ))}
                  <Button submit variant="primary">
                    Submit return request
                  </Button>
                </BlockStack>
              </Card>
            </BlockStack>
          </Form>
        )}
      </BlockStack>
    </Page>
  );
}

function statusTone(status: string) {
  switch (status) {
    case "APPROVED":
    case "COMPLETED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
      return "critical";
    default:
      return undefined;
  }
}
