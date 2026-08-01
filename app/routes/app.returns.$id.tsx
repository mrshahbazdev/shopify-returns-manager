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
import {
  getReturnRequest,
  updateReturnRequest,
  issueStoreCredit,
} from "../models/returns.server";
import { serializeObject } from "../lib/serializers";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const returnRequest = await getReturnRequest(params.id!, session.shop);
  if (!returnRequest) {
    throw new Response("Not found", { status: 404 });
  }
  return serializeObject({ returnRequest });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const adminNote = formData.get("adminNote") as string | undefined;
  const id = params.id!;

  if (intent === "approve" || intent === "reject") {
    await updateReturnRequest(id, session.shop, {
      status: intent === "approve" ? "APPROVED" : "REJECTED",
      adminNote,
    });
  } else if (intent === "issue-credit") {
    const returnRequest = await getReturnRequest(id, session.shop);
    if (returnRequest && returnRequest.customerEmail) {
      const amount = Number(returnRequest.totalRefund);
      await issueStoreCredit(
        session.shop,
        returnRequest.customerEmail,
        amount,
        `Store credit for return ${returnRequest.orderName}`,
        returnRequest.id,
      );
      await updateReturnRequest(id, session.shop, {
        status: "COMPLETED",
        storeCreditIssued: returnRequest.totalRefund,
        adminNote,
      });
    }
  } else if (intent === "complete") {
    await updateReturnRequest(id, session.shop, {
      status: "COMPLETED",
      adminNote,
    });
  }

  return json({ ok: true });
};

export default function ReturnDetail() {
  const { returnRequest } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleAction = (intent: string) => {
    submit({ intent }, { method: "POST" });
  };

  return (
    <Page backAction={{ content: "Returns", url: "/app/returns" }}>
      <TitleBar title={`Return ${returnRequest.orderName}`} />
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Request details
                  </Text>
                  <Badge tone={statusTone(returnRequest.status)}>
                    {returnRequest.status}
                  </Badge>
                </InlineStack>
                <DataTable
                  columnContentTypes={["text", "text"]}
                  headings={["Field", "Value"]}
                  rows={[
                    ["Order", returnRequest.orderName],
                    ["Customer", returnRequest.customerName || returnRequest.customerEmail || "—"],
                    ["Reason", returnRequest.reason],
                    ["Resolution", returnRequest.resolution],
                    ["Customer note", returnRequest.customerNote || "—"],
                    ["Admin note", returnRequest.adminNote || "—"],
                    ["Total", `$${Number(returnRequest.totalRefund).toFixed(2)}`],
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
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
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
                  {returnRequest.resolution === "STORE_CREDIT" && returnRequest.customerEmail ? (
                    <Button onClick={() => handleAction("issue-credit")} variant="primary">
                      Issue store credit
                    </Button>
                  ) : (
                    <Button onClick={() => handleAction("complete")} variant="primary">
                      Mark complete
                    </Button>
                  )}
                </>
              )}
              {returnRequest.status === "COMPLETED" && (
                <Banner tone="success" title="Request completed">
                  This return has been resolved.
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
