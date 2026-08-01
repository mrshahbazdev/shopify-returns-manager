import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Box,
  InlineStack,
  Button,
  DataTable,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { serializeObject } from "../lib/serializers";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [returnCount, exchangeCount, creditAggregate] = await Promise.all([
    prisma.returnRequest.count({ where: { shop } }),
    prisma.exchangeRequest.count({ where: { shop } }),
    prisma.storeCredit.aggregate({
      where: { shop },
      _sum: { balance: true },
    }),
  ]);

  const recentReturns = await prisma.returnRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return serializeObject({
    shop,
    returnCount,
    exchangeCount,
    totalStoreCredit: creditAggregate._sum.balance || 0,
    recentReturns,
  });
};

export default function Index() {
  const { returnCount, exchangeCount, totalStoreCredit, recentReturns } =
    useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Returns Manager" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Overview
                  </Text>
                  <InlineStack gap="400" wrap={false}>
                    <Box flex="1">
                      <Text as="p" variant="heading2xl">
                        {returnCount}
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Return requests
                      </Text>
                    </Box>
                    <Box flex="1">
                      <Text as="p" variant="heading2xl">
                        {exchangeCount}
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Exchange requests
                      </Text>
                    </Box>
                    <Box flex="1">
                      <Text as="p" variant="heading2xl">
                        ${Number(totalStoreCredit).toFixed(2)}
                      </Text>
                      <Text as="p" variant="bodyMd" tone="subdued">
                        Store credit outstanding
                      </Text>
                    </Box>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingMd">
                      Recent return requests
                    </Text>
                    <Button url="/app/returns">View all</Button>
                  </InlineStack>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Order", "Status", "Resolution", "Requested"]}
                    rows={recentReturns.map((req) => [
                      <Link to={`/app/returns/${req.id}`} key={req.id}>
                        {req.orderName}
                      </Link>,
                      <Badge key={`status-${req.id}`}>{req.status}</Badge>,
                      req.resolution,
                      new Date(req.createdAt).toLocaleDateString(),
                    ])}
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Customer portal
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Share the public returns portal URL with your customers so
                    they can start returns and exchanges themselves.
                  </Text>
                  <Button url="/app/settings">Configure portal</Button>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Store credit
                  </Text>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Keep refunds in-store by issuing store credit instead of
                    payment refunds.
                  </Text>
                  <Button url="/app/store-credit">Manage credit</Button>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
