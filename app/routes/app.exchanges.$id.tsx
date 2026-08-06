import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  DataTable,
  Badge,
  InlineStack,
  Button,
  Banner,
  TextField,
  Select,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getExchangeRequest, updateExchangeRequest } from "../models/returns.server";
import { processExchangeOrder } from "../lib/returns-processor.server";
import { createShippingLabel } from "../lib/shipping.server";
import { sendNotification } from "../lib/notifications.server";
import { serializeObject } from "../lib/serializers";
import { useState } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const exchange = await getExchangeRequest(params.id!, session.shop);
  if (!exchange) {
    throw new Response("Not found", { status: 404 });
  }
  return serializeObject({ exchange });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const adminNote = formData.get("adminNote") as string | undefined;
  const id = params.id!;

  const exchange = await getExchangeRequest(id, session.shop);
  if (!exchange) {
    throw new Response("Not found", { status: 404 });
  }

  if (intent === "approve") {
    await updateExchangeRequest(id, session.shop, { status: "APPROVED", adminNote });
    await sendNotification({
      shop: session.shop,
      channel: "EMAIL",
      to: exchange.customerEmail || "",
      event: "exchange_approved",
      data: {
        customerName: exchange.customerName || "Customer",
        rmaNumber: exchange.rmaNumber,
        orderName: exchange.orderName,
      },
      exchangeRequestId: exchange.id,
    });
    const result = await processExchangeOrder(id, session.shop, admin);
    if (!result.success) {
      return json({ success: false, error: result.error });
    }
  } else if (intent === "reject") {
    await updateExchangeRequest(id, session.shop, { status: "REJECTED", adminNote });
    await sendNotification({
      shop: session.shop,
      channel: "EMAIL",
      to: exchange.customerEmail || "",
      event: "exchange_rejected",
      data: {
        customerName: exchange.customerName || "Customer",
        rmaNumber: exchange.rmaNumber,
        orderName: exchange.orderName,
        reason: exchange.reason,
      },
      exchangeRequestId: exchange.id,
    });
  } else if (intent === "complete") {
    await updateExchangeRequest(id, session.shop, { status: "COMPLETED", adminNote });
  } else if (intent === "save-tracking") {
    const trackingNumber = formData.get("trackingNumber") as string;
    const carrier = formData.get("carrier") as string;
    if (trackingNumber) {
      await updateExchangeRequest(id, session.shop, {
        trackingNumber,
        carrier,
        shipDate: new Date(),
      });
      await sendNotification({
        shop: session.shop,
        channel: "EMAIL",
        to: exchange.customerEmail || "",
        event: "exchange_shipped",
        data: {
          customerName: exchange.customerName || "Customer",
          rmaNumber: exchange.rmaNumber,
          orderName: exchange.orderName,
          trackingNumber,
          carrier,
        },
        exchangeRequestId: exchange.id,
      });
    }
  } else if (intent === "mark-received") {
    await updateExchangeRequest(id, session.shop, { receivedDate: new Date() });
    await sendNotification({
      shop: session.shop,
      channel: "EMAIL",
      to: exchange.customerEmail || "",
      event: "exchange_received",
      data: {
        customerName: exchange.customerName || "Customer",
        rmaNumber: exchange.rmaNumber,
        orderName: exchange.orderName,
      },
      exchangeRequestId: exchange.id,
    });
  } else if (intent === "create-label") {
    const result = await createShippingLabel(session.shop, exchange);
    if (!result.success) {
      return json({ success: false, error: result.error });
    }
    return serializeObject({ label: result.label });
  }

  return json({ success: true });
};

export default function ExchangeDetail() {
  const { exchange } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [carrier, setCarrier] = useState(exchange.carrier || "UPS");
  const [trackingNumber, setTrackingNumber] = useState(exchange.trackingNumber || "");

  const handleAction = (intent: string, extra?: Record<string, string>) => {
    submit({ intent, ...extra }, { method: "POST" });
  };

  const labels = exchange.shippingLabels || [];
  const notifications = exchange.notifications || [];

  return (
    <Page backAction={{ content: "Exchanges", url: "/app/exchanges" }}>
      <TitleBar title={`Exchange ${exchange.orderName}`} />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {actionData?.error && (
              <Banner tone="critical" title="Action failed">
                {actionData.error}
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Exchange details
                  </Text>
                  <Badge tone={statusTone(exchange.status)}>{exchange.status}</Badge>
                </InlineStack>
                <DataTable
                  columnContentTypes={["text", "text"]}
                  headings={["Field", "Value"]}
                  rows={[
                    ["RMA", exchange.rmaNumber],
                    ["Order", exchange.orderName],
                    ["Customer", exchange.customerName || exchange.customerEmail || "—"],
                    ["Reason", exchange.reason],
                    ["Exchange order", exchange.exchangeOrderId ? exchange.exchangeOrderId : "—"],
                    ["Tracking", exchange.trackingNumber ? `${exchange.carrier || ""} ${exchange.trackingNumber}` : "—"],
                    ["Shipped", exchange.shipDate ? new Date(exchange.shipDate).toLocaleDateString() : "—"],
                    ["Received", exchange.receivedDate ? new Date(exchange.receivedDate).toLocaleDateString() : "—"],
                    ["Requested", new Date(exchange.createdAt).toLocaleString()],
                  ]}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  New items requested
                </Text>
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Original item", "New variant", "Quantity", "Reason"]}
                  rows={exchange.lineItems.map((item: any) => [
                    item.originalLineItemId,
                    item.newTitle,
                    item.quantity,
                    item.reason || "—",
                  ])}
                />
              </BlockStack>
            </Card>

            {labels.length > 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Shipping labels
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Carrier", "Tracking", "Cost", "Status"]}
                    rows={labels.map((label: any) => [
                      label.carrier,
                      label.trackingNumber,
                      label.cost ? `$${Number(label.cost).toFixed(2)}` : "—",
                      label.status,
                    ])}
                  />
                </BlockStack>
              </Card>
            )}

            {notifications.length > 0 && (
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Notifications
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Channel", "To", "Event", "Status"]}
                    rows={notifications.map((n: any) => [n.channel, n.to, n.event, n.status])}
                  />
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Actions
                </Text>
                {exchange.status === "PENDING" && (
                  <>
                    <Banner tone="info" title="Review the exchange">
                      Approve to create the Shopify exchange order, or reject.
                    </Banner>
                    <InlineStack gap="300">
                      <Button onClick={() => handleAction("approve")} variant="primary">
                        Approve & create order
                      </Button>
                      <Button onClick={() => handleAction("reject")} tone="critical">
                        Reject
                      </Button>
                    </InlineStack>
                  </>
                )}
                {exchange.status === "APPROVED" && (
                  <>
                    <Button onClick={() => handleAction("complete")} variant="primary">
                      Mark complete
                    </Button>
                    <Button onClick={() => handleAction("create-label")}>
                      Generate shipping label
                    </Button>
                  </>
                )}
                {exchange.status === "COMPLETED" && (
                  <Banner tone="success" title="Request completed">
                    This exchange has been resolved.
                  </Banner>
                )}
                {exchange.status === "REJECTED" && (
                  <Banner tone="critical" title="Request rejected">
                    This exchange has been declined.
                  </Banner>
                )}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Tracking
                </Text>
                <Select
                  label="Carrier"
                  options={["UPS", "FedEx", "USPS", "DHL", "Other"].map((c) => ({ label: c, value: c }))}
                  value={carrier}
                  onChange={setCarrier}
                />
                <TextField
                  label="Tracking number"
                  value={trackingNumber}
                  onChange={setTrackingNumber}
                  autoComplete="off"
                />
                <Button
                  onClick={() =>
                    handleAction("save-tracking", { carrier, trackingNumber })
                  }
                  variant="primary"
                >
                  Save tracking
                </Button>
                <Button onClick={() => handleAction("mark-received")}>
                  Mark items received
                </Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
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
