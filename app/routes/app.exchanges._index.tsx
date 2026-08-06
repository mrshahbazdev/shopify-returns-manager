import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Badge,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { listExchangeRequests } from "../models/returns.server";
import { serializeObject } from "../lib/serializers";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const exchanges = await listExchangeRequests(session.shop);
  return serializeObject({ exchanges });
};

export default function ExchangesIndex() {
  const { exchanges } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Exchanges" />
      <Card>
        {exchanges.length === 0 ? (
          <EmptyState
            heading="No exchange requests yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/8156/files/emptystate-bag.png"
            action={{ content: "View customer portal", url: "/app/settings" }}
          >
            <p>Customers can request exchanges from the public portal.</p>
          </EmptyState>
        ) : (
          <DataTable
            columnContentTypes={["text", "text", "text", "text", "text", "text"]}
            headings={["RMA", "Order", "Customer", "Reason", "Status", "Date"]}
            rows={exchanges.map((ex) => [
              <Link to={`/app/exchanges/${ex.id}`} key={ex.id}>
                {ex.rmaNumber}
              </Link>,
              ex.orderName,
              ex.customerName || ex.customerEmail || "—",
              ex.reason,
              <Badge key={`status-${ex.id}`} tone={statusTone(ex.status)}>
                {ex.status}
              </Badge>,
              new Date(ex.createdAt).toLocaleDateString(),
            ])}
          />
        )}
      </Card>
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
