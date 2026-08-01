import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
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
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getExchangeRequest, updateExchangeRequest } from "../models/returns.server";
import { serializeObject } from "../lib/serializers";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const exchange = await getExchangeRequest(params.id!, session.shop);
  if (!exchange) {
    throw new Response("Not found", { status: 404 });
  }
  return serializeObject({ exchange });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const id = params.id!;

  if (intent === "approve" || intent === "reject" || intent === "complete") {
    const statusMap: Record<string, string> = {
      approve: "APPROVED",
      reject: "REJECTED",
      complete: "COMPLETED",
    };
    await updateExchangeRequest(id, session.shop, { status: statusMap[intent] as any });
  }

  return json({ ok: true });
};

export default function ExchangeDetail() {
  const { exchange } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleAction = (intent: string) => {
    submit({ intent }, { method: "POST" });
  };

  return (
    <Page backAction={{ content: "Exchanges", url: "/app/exchanges" }}>
      <TitleBar title={`Exchange ${exchange.orderName}`} />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
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
                    ["Order", exchange.orderName],
                    ["Customer", exchange.customerName || exchange.customerEmail || "—"],
                    ["Reason", exchange.reason],
                    ["Customer note", exchange.customerNote || "—"],
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
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Actions
              </Text>
              {exchange.status === "PENDING" && (
                <>
                  <Banner tone="info" title="Review the exchange">
                    Approve to accept, or reject to decline.
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
              {exchange.status === "APPROVED" && (
                <Button onClick={() => handleAction("complete")} variant="primary">
                  Mark complete
                </Button>
              )}
              {exchange.status === "COMPLETED" && (
                <Banner tone="success" title="Request completed">
                  This exchange has been resolved.
                </Banner>
              )}
            </BlockStack>
          </Card>
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
