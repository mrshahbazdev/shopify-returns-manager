import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  Text,
  TextField,
  Checkbox,
  Select,
  Button,
  InlineStack,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { getShopSettings, updateShopSettings } from "../models/returns.server";
import { serializeObject } from "../lib/serializers";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  return serializeObject({ settings, shop: session.shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const returnWindowDays = Number(formData.get("returnWindowDays"));
  const allowExchanges = formData.get("allowExchanges") === "on";
  const allowStoreCredit = formData.get("allowStoreCredit") === "on";
  const allowPartialReturns = formData.get("allowPartialReturns") === "on";
  const refundMethod = formData.get("refundMethod") as string;
  const restockingFeePercent = Number(formData.get("restockingFeePercent"));
  const autoApproveThreshold = Number(formData.get("autoApproveThreshold"));
  const autoApproveEnabled = formData.get("autoApproveEnabled") === "on";
  const autoRejectReasons = formData.get("autoRejectReasons") as string;
  const returnReasons = formData.get("returnReasons") as string;
  const emailProvider = formData.get("emailProvider") as string;
  const emailFrom = formData.get("emailFrom") as string;
  const smsProvider = formData.get("smsProvider") as string;
  const smsFrom = formData.get("smsFrom") as string;
  const shippingLabelProvider = formData.get("shippingLabelProvider") as string;

  const settings = await updateShopSettings(session.shop, {
    returnWindowDays,
    allowExchanges,
    allowStoreCredit,
    allowPartialReturns,
    refundMethod,
    restockingFeePercent,
    autoApproveThreshold,
    autoApproveEnabled,
    autoRejectReasons,
    returnReasons,
    emailProvider,
    emailFrom,
    smsProvider,
    smsFrom,
    shippingLabelProvider,
  });

  return json({ settings: serializeObject(settings) });
};

export default function SettingsPage() {
  const { settings, shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const [returnWindowDays, setReturnWindowDays] = useState(String(settings.returnWindowDays));
  const [allowExchanges, setAllowExchanges] = useState(settings.allowExchanges);
  const [allowStoreCredit, setAllowStoreCredit] = useState(settings.allowStoreCredit);
  const [allowPartialReturns, setAllowPartialReturns] = useState(settings.allowPartialReturns);
  const [refundMethod, setRefundMethod] = useState(settings.refundMethod);
  const [restockingFeePercent, setRestockingFeePercent] = useState(String(settings.restockingFeePercent || 0));
  const [autoApproveThreshold, setAutoApproveThreshold] = useState(String(settings.autoApproveThreshold || 0));
  const [autoApproveEnabled, setAutoApproveEnabled] = useState(settings.autoApproveEnabled);
  const [autoRejectReasons, setAutoRejectReasons] = useState(settings.autoRejectReasons || "");
  const [returnReasons, setReturnReasons] = useState(settings.returnReasons || "");
  const [emailProvider, setEmailProvider] = useState(settings.emailProvider || "none");
  const [emailFrom, setEmailFrom] = useState(settings.emailFrom || "");
  const [smsProvider, setSmsProvider] = useState(settings.smsProvider || "none");
  const [smsFrom, setSmsFrom] = useState(settings.smsFrom || "");
  const [shippingLabelProvider, setShippingLabelProvider] = useState(settings.shippingLabelProvider || "none");

  const handleSave = useCallback(() => {
    submit(
      {
        returnWindowDays,
        allowExchanges: allowExchanges ? "on" : "off",
        allowStoreCredit: allowStoreCredit ? "on" : "off",
        allowPartialReturns: allowPartialReturns ? "on" : "off",
        refundMethod,
        restockingFeePercent,
        autoApproveThreshold,
        autoApproveEnabled: autoApproveEnabled ? "on" : "off",
        autoRejectReasons,
        returnReasons,
        emailProvider,
        emailFrom,
        smsProvider,
        smsFrom,
        shippingLabelProvider,
      },
      { method: "POST" },
    );
  }, [
    returnWindowDays,
    allowExchanges,
    allowStoreCredit,
    allowPartialReturns,
    refundMethod,
    restockingFeePercent,
    autoApproveThreshold,
    autoApproveEnabled,
    autoRejectReasons,
    returnReasons,
    emailProvider,
    emailFrom,
    smsProvider,
    smsFrom,
    shippingLabelProvider,
    submit,
  ]);

  const providerOptions = [
    { label: "None (log only)", value: "none" },
    { label: "Resend", value: "resend" },
    { label: "SendGrid", value: "sendgrid" },
    { label: "Twilio", value: "twilio" },
    { label: "Shippo", value: "shippo" },
    { label: "EasyPost", value: "easypost" },
  ];

  return (
    <Page>
      <TitleBar title="Settings" />
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Return policy
            </Text>
            <TextField
              label="Return window (days)"
              value={returnWindowDays}
              onChange={setReturnWindowDays}
              autoComplete="off"
              type="number"
              helpText="Number of days after delivery that customers can request a return."
            />
            <Checkbox
              label="Allow exchanges"
              checked={allowExchanges}
              onChange={setAllowExchanges}
            />
            <Checkbox
              label="Allow store credit as a refund option"
              checked={allowStoreCredit}
              onChange={setAllowStoreCredit}
            />
            <Checkbox
              label="Allow partial returns"
              checked={allowPartialReturns}
              onChange={setAllowPartialReturns}
            />
            <Select
              label="Default refund method"
              options={[
                { label: "Original payment method", value: "original" },
                { label: "Store credit", value: "store_credit" },
              ]}
              value={refundMethod}
              onChange={setRefundMethod}
            />
            <TextField
              label="Restocking fee (%)"
              value={restockingFeePercent}
              onChange={setRestockingFeePercent}
              autoComplete="off"
              type="number"
              helpText="Percentage deducted from refund value for restocking."
            />
            <TextField
              label="Auto-approve threshold ($)"
              value={autoApproveThreshold}
              onChange={setAutoApproveThreshold}
              autoComplete="off"
              type="number"
              helpText="Return requests with a total below this amount will be considered for auto-approval."
            />
            <Checkbox
              label="Enable auto-approval"
              checked={autoApproveEnabled}
              onChange={setAutoApproveEnabled}
              helpText="Automatically approve eligible return requests when the customer submits them."
            />
            <TextField
              label="Auto-reject reasons"
              value={autoRejectReasons}
              onChange={setAutoRejectReasons}
              autoComplete="off"
              helpText="Comma-separated list of reasons that should never be auto-approved."
            />
            <TextField
              label="Return reasons"
              value={returnReasons}
              onChange={setReturnReasons}
              autoComplete="off"
              multiline={3}
              helpText="Comma-separated list of reasons shown to customers in the portal."
            />
            <InlineStack align="end">
              <Button onClick={handleSave} variant="primary">
                Save settings
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Notifications & labels
            </Text>
            <Select
              label="Email provider"
              options={providerOptions.filter((p) => ["none", "resend", "sendgrid"].includes(p.value))}
              value={emailProvider}
              onChange={setEmailProvider}
              helpText="Resend or SendGrid API key must be set in environment variables."
            />
            <TextField
              label="From email"
              value={emailFrom}
              onChange={setEmailFrom}
              autoComplete="off"
              helpText="Sender address used for customer emails."
            />
            <Select
              label="SMS provider"
              options={providerOptions.filter((p) => ["none", "twilio"].includes(p.value))}
              value={smsProvider}
              onChange={setSmsProvider}
              helpText="Twilio credentials must be set in environment variables."
            />
            <TextField
              label="From phone number"
              value={smsFrom}
              onChange={setSmsFrom}
              autoComplete="off"
              helpText="Twilio phone number for SMS."
            />
            <Select
              label="Shipping label provider"
              options={providerOptions.filter((p) => ["none", "shippo", "easypost"].includes(p.value))}
              value={shippingLabelProvider}
              onChange={setShippingLabelProvider}
              helpText="Shippo or EasyPost API key must be set in environment variables."
            />
            <InlineStack align="end">
              <Button onClick={handleSave} variant="primary">
                Save settings
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              Customer portal URL
            </Text>
            <Text as="p" variant="bodyMd" tone="subdued">
              Customers can submit returns and exchanges from this public page:
            </Text>
            <Banner tone="info">
              <code>{`/returns/${shop}`}</code>
            </Banner>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
