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
import {
  getReturnRequest,
  updateReturnRequest,
} from "../models/returns.server";
import { processRefund, processStoreCredit } from "../lib/returns-processor.server";
import { createShippingLabel } from "../lib/shipping.server";
import { sendNotification } from "../lib/notifications.server";
import { serializeObject } from "../lib/serializers";
import { useState } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const returnRequest = await getReturnRequest(params.id!, session.shop);
  if (!returnRequest) {
    throw new Response("Not found", { status: 404 });
  }
  return serializeObject({ returnRequest });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const adminNote = formData.get("adminNote") as string | undefined;
  const id = params.id!;

  const returnRequest = await getReturnRequest(id, session.shop);
  if (!returnRequest) {
    throw new Response("Not found", { status: 404 });
  }

  if (intent === "approve") {
    await updateReturnRequest(id, session.shop, { status: "APPROVED", adminNote });
    await sendNotification({
      shop: session.shop,
      channel: "EMAIL",
      to: returnRequest.customerEmail || "",
      event: "return_approved",
      data: {
        customerName: returnRequest.customerName || "Customer",
        rmaNumber: returnRequest.rmaNumber,
        orderName: returnRequest.orderName,
        amount: Number(returnRequest.totalRefund || 0).toFixed(2),
        reason: returnRequest.reason,
      },
      returnRequestId: returnRequest.id,
    });
  } else if (intent === "reject") {
    await updateReturnRequest(id, session.shop, { status: "REJECTED", adminNote });
    await sendNotification({
      shop: session.shop,
      channel: "EMAIL",
      to: returnRequest.customerEmail || "",
      event: "return_rejected",
      data: {
        customerName: returnRequest.customerName || "Customer",
        rmaNumber: returnRequest.rmaNumber,
        orderName: returnRequest.orderName,
        reason: returnRequest.reason,
      },
      returnRequestId: returnRequest.id,
    });
  } else if (intent === "issue-credit") {
    await processStoreCredit(id, session.shop);
  } else if (intent === "issue-refund") {
    const result = await processRefund(id, session.shop, admin);
    if (!result.success) {
      return json({ success: false, error: result.error });
    }
  } else if (intent === "complete") {
    await updateReturnRequest(id, session.shop, { status: "COMPLETED", adminNote });
  } else if (intent === "save-tracking") {
    const trackingNumber = formData.get("trackingNumber") as string;
    const carrier = formData.get("carrier") as string;
    const shipDate = formData.get("shipDate") as string;
    if (trackingNumber) {
      const updated = await updateReturnRequest(id, session.shop, {
        trackingNumber,
        carrier,
        shipDate: shipDate ? new Date(shipDate) : undefined,
      });
      await sendNotification({
        shop: session.shop,
        channel: "EMAIL",
        to: returnRequest.customerEmail || "",
        event: "return_shipped",
        data: {
          customerName: returnRequest.customerName || "Customer",
          rmaNumber: returnRequest.rmaNumber,
          orderName: returnRequest.orderName,
          trackingNumber,
          carrier,
        },
        returnRequestId: returnRequest.id,
      });
      return serializeObject({ updated });
    }
  } else if (intent === "mark-received") {
    await updateReturnRequest(id, session.shop, { receivedDate: new Date() });
    await sendNotification({
      shop: session.shop,
      channel: "EMAIL",
      to: returnRequest.customerEmail || "",
      event: "return_received",
      data: {
        customerName: returnRequest.customerName || "Customer",
        rmaNumber: returnRequest.rmaNumber,
        orderName: returnRequest.orderName,
      },
      returnRequestId: returnRequest.id,
    });
  } else if (intent === "create-label") {
    const result = await createShippingLabel(session.shop, returnRequest);
    if (!result.success) {
      return json({ success: false, error: result.error });
    }
    return serializeObject({ label: result.label });
  }

  return json({ success: true });
};

export default function ReturnDetail() {
  const { returnRequest } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [carrier, setCarrier] = useState(returnRequest.carrier || "UPS");
  const [trackingNumber, setTrackingNumber] = useState(returnRequest.trackingNumber || "");

  const handleAction = (intent: string, extra?: Record<string, string>) => {
    submit({ intent, ...extra }, { method: "POST" });
  };

  const notifications = returnRequest.notifications || [];
  const labels = returnRequest.shippingLabels || [];

  return (
    <Page backAction={{ content: "Returns", url: "/app/returns" }}>
      <TitleBar title={`Return ${returnRequest.orderName}`} />
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
                    Request details
                  </Text>
                  <Badge tone={statusTone(returnRequest.status)}>{returnRequest.status}</Badge>
                </InlineStack>
                <DataTable
                  columnContentTypes={["text", "text"]}
                  headings={["Field", "Value"]}
                  rows={[
                    ["RMA", returnRequest.rmaNumber],
                    ["Order", returnRequest.orderName],
                    ["Customer", returnRequest.customerName || returnRequest.customerEmail || "—"],
                    ["Reason", returnRequest.reason],
                    ["Resolution", returnRequest.resolution],
                    ["Refund status", returnRequest.refundStatus],
                    ["Customer note", returnRequest.customerNote || "—"],
                    ["Admin note", returnRequest.adminNote || "—"],
                    ["Total", `$${Number(returnRequest.totalRefund).toFixed(2)}`],
                    ["Store credit issued", `$${Number(returnRequest.storeCreditIssued || 0).toFixed(2)}`],
                    ["Tracking", returnRequest.trackingNumber ? `${returnRequest.carrier || ""} ${returnRequest.trackingNumber}` : "—"],
                    ["Shipped", returnRequest.shipDate ? new Date(returnRequest.shipDate).toLocaleDateString() : "—"],
                    ["Received", returnRequest.receivedDate ? new Date(returnRequest.receivedDate).toLocaleDateString() : "—"],
                    ["Requested", new Date(returnRequest.createdAt).toLocaleString()],
                  ]}
                />
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Line items
                </Text>
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "text"]}
                  headings={["Product", "Quantity", "Price", "Action", "Reason"]}
                  rows={returnRequest.lineItems.map((item: any) => [
                    item.title,
                    item.quantity,
                    `$${Number(item.price).toFixed(2)}`,
                    item.requestedAction,
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
                    rows={notifications.map((n: any) => [
                      n.channel,
                      n.to,
                      n.event,
                      n.status,
                    ])}
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
                {returnRequest.status === "PENDING" && (
                  <>
                    <Banner tone="info" title="Review the request">
                      Approve to accept the return, or reject to decline it.
                    </Banner>
                    <InlineStack gap="300">
                      <Button onClick={() => handleAction("approve")} variant="primary">
                        Approve
                      </Button>
                      <Button onClick={() => handleAction("reject")} tone="critical">
                        Reject
                      </Button>
                    </InlineStack>
                  </>
                )}

                {returnRequest.status === "APPROVED" && (
                  <>
                    <Banner tone="info" title="Process the return">
                      Choose the final resolution for this return.
                    </Banner>
                    <InlineStack gap="300" blockAlign="start">
                      {returnRequest.resolution === "STORE_CREDIT" && returnRequest.customerEmail && (
                        <Button onClick={() => handleAction("issue-credit")} variant="primary">
                          Issue store credit
                        </Button>
                      )}
                      {returnRequest.resolution === "REFUND" && (
                        <Button onClick={() => handleAction("issue-refund")} variant="primary">
                          Issue Shopify refund
                        </Button>
                      )}
                      <Button onClick={() => handleAction("complete")}>
                        Mark complete
                      </Button>
                    </InlineStack>
                    <Button onClick={() => handleAction("create-label")}>
                      Generate shipping label
                    </Button>
                  </>
                )}

                {returnRequest.status === "COMPLETED" && (
                  <Banner tone="success" title="Request completed">
                    This return has been resolved.
                  </Banner>
                )}

                {returnRequest.status === "REJECTED" && (
                  <Banner tone="critical" title="Request rejected">
                    This return has been declined.
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
                <TextField
                  label="Ship date"
                  type="date"
                  value={new Date().toISOString().split("T")[0]}
                  onChange={() => {}}
                  autoComplete="off"
                />
                <Button
                  onClick={() =>
                    handleAction("save-tracking", {
                      carrier,
                      trackingNumber,
                      shipDate: new Date().toISOString().split("T")[0],
                    })
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
