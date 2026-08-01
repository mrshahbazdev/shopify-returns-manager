import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  DataTable,
  Text,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { Prisma } from "@prisma/client";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateStoreCredit, issueStoreCredit } from "../models/returns.server";
import { serializeObject } from "../lib/serializers";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const credits = await prisma.storeCredit.findMany({
    where: { shop: session.shop },
    orderBy: { updatedAt: "desc" },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 3 } },
  });
  return serializeObject({ credits });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;
  const customerEmail = formData.get("customerEmail") as string;
  const amount = Number(formData.get("amount"));

  if (intent === "issue" && customerEmail && !Number.isNaN(amount) && amount > 0) {
    await issueStoreCredit(session.shop, customerEmail, amount, "Manual adjustment");
  } else if (intent === "adjust" && customerEmail && !Number.isNaN(amount)) {
    await getOrCreateStoreCredit(session.shop, customerEmail);
    await prisma.storeCredit.updateMany({
      where: { shop: session.shop, customerEmail },
      data: {
        balance: { increment: new Prisma.Decimal(amount.toFixed(2)) },
        totalIssued: { increment: new Prisma.Decimal(Math.max(0, amount).toFixed(2)) },
      },
    });
  }

  return json({ ok: true });
};

export default function StoreCreditPage() {
  const { credits } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");

  const handleIssue = () => {
    submit(
      { intent: "issue", customerEmail: email, amount },
      { method: "POST" },
    );
  };

  return (
    <Page>
      <TitleBar title="Store Credit" />
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Issue store credit
            </Text>
            <InlineStack gap="300" align="start" blockAlign="end">
              <TextField
                label="Customer email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
                type="email"
              />
              <TextField
                label="Amount"
                value={amount}
                onChange={setAmount}
                autoComplete="off"
                type="number"
                prefix="$"
              />
              <Button onClick={handleIssue} variant="primary">
                Issue credit
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Balances
            </Text>
            {credits.length === 0 ? (
              <EmptyState
                heading="No store credit yet"
                image="https://cdn.shopify.com/s/files/1/0262/4071/8156/files/emptystate-bag.png"
              >
                <p>Store credit will appear here once issued.</p>
              </EmptyState>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Customer", "Balance", "Total issued", "Updated"]}
                rows={credits.map((credit) => [
                  credit.customerEmail,
                  `$${Number(credit.balance).toFixed(2)}`,
                  `$${Number(credit.totalIssued).toFixed(2)}`,
                  new Date(credit.updatedAt).toLocaleDateString(),
                ])}
              />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
