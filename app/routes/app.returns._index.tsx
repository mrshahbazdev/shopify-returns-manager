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
import { listReturnRequests } from "../models/returns.server";
import { serializeObject } from "../lib/serializers";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const returns = await listReturnRequests(session.shop);
  return serializeObject({ returns });
};

export default function ReturnsIndex() {
  const { returns } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Returns" />
      <Card>
        {returns.length === 0 ? (
          <EmptyState
            heading="No return requests yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/8156/files/emptystate-bag.png"
            action={{ content: "View customer portal", url: "/app/settings" }}
          >
            <p>
              Customers can submit returns from the public returns portal.
            </p>
          </EmptyState>
        ) : (
          <DataTable
            columnContentTypes={[
              "text",
              "text",
              "text",
              "text",
              "text",
              "text",
            ]}
            headings={["Order", "Customer", "Reason", "Resolution", "Status", "Date"]}
            rows={returns.map((ret) => [
              <Link to={`/app/returns/${ret.id}`} key={ret.id}>
                {ret.orderName}
              </Link>,
              ret.customerName || ret.customerEmail || "—",
              ret.reason,
              ret.resolution,
              <Badge key={`status-${ret.id}`} tone={statusTone(ret.status)}>
                {ret.status}
              </Badge>,
              new Date(ret.createdAt).toLocaleDateString(),
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
