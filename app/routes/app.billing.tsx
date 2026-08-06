import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  List,
  Banner,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { PLANS, BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN } from "../lib/billing";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const { hasActivePayment, appSubscriptions } = await billing.check();
  return json({
    hasActivePayment,
    currentPlan: appSubscriptions[0]?.name || null,
    plans: PLANS,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan") as string;

  if (![BASIC_PLAN, PRO_PLAN, ENTERPRISE_PLAN].includes(plan)) {
    return json({ error: "Invalid plan" }, { status: 400 });
  }

  await billing.request({
    plan,
    isTest: process.env.NODE_ENV !== "production",
    returnUrl: `${process.env.SHOPIFY_APP_URL}/app?shop=${session.shop}`,
  });

  return json({ ok: true });
};

export default function BillingPage() {
  const { hasActivePayment, currentPlan, plans } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  return (
    <Page>
      <TitleBar title="Billing" />
      <BlockStack gap="500">
        {hasActivePayment && (
          <Banner title={`Active plan: ${currentPlan}`} tone="success">
            You can upgrade or downgrade at any time.
          </Banner>
        )}

        <InlineStack gap="400" align="space-around" blockAlign="stretch" wrap>
          {plans.map((plan: any) => (
            <Card key={plan.name}>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    {plan.name}
                  </Text>
                  {plan.name === currentPlan && <Badge tone="success">Current</Badge>}
                  {plan.highlighted && plan.name !== currentPlan && (
                    <Badge tone="info">Popular</Badge>
                  )}
                </InlineStack>
                <Text as="p" variant="heading2xl">
                  {plan.price}
                  <Text as="span" variant="bodyMd" tone="subdued">
                    {plan.interval}
                  </Text>
                </Text>
                <Text as="p" variant="bodyMd" tone="subdued">
                  {plan.description}
                </Text>
                <List>
                  {plan.features.map((feature: string) => (
                    <List.Item key={feature}>{feature}</List.Item>
                  ))}
                </List>
                <Button
                  onClick={() => submit({ plan: plan.name }, { method: "POST" })}
                  variant={plan.name === currentPlan ? "secondary" : "primary"}
                  disabled={plan.name === currentPlan}
                >
                  {plan.name === currentPlan ? "Current plan" : `Choose ${plan.name}`}
                </Button>
              </BlockStack>
            </Card>
          ))}
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
