import prisma from "../db.server";

export type NotificationEvent =
  | "return_created"
  | "return_approved"
  | "return_rejected"
  | "return_shipped"
  | "return_received"
  | "return_refunded"
  | "exchange_created"
  | "exchange_approved"
  | "exchange_rejected"
  | "exchange_shipped"
  | "exchange_received";

const defaultTemplates: Record<NotificationEvent, { subject: string; body: string }> = {
  return_created: {
    subject: "Return request received",
    body: "Hi {{customerName}}, your return request {{rmaNumber}} for order {{orderName}} has been received and is under review.",
  },
  return_approved: {
    subject: "Return approved",
    body: "Hi {{customerName}}, your return request {{rmaNumber}} for order {{orderName}} has been approved. Please ship the items to the return address.",
  },
  return_rejected: {
    subject: "Return request declined",
    body: "Hi {{customerName}}, your return request {{rmaNumber}} for order {{orderName}} could not be approved. Reason: {{reason}}.",
  },
  return_shipped: {
    subject: "Return shipped",
    body: "Hi {{customerName}}, we received tracking {{trackingNumber}} via {{carrier}} for return {{rmaNumber}}.",
  },
  return_received: {
    subject: "Return received",
    body: "Hi {{customerName}}, we received your return {{rmaNumber}} for order {{orderName}}. Your refund or exchange is being processed.",
  },
  return_refunded: {
    subject: "Refund issued",
    body: "Hi {{customerName}}, a refund of {{amount}} has been issued for return {{rmaNumber}}.",
  },
  exchange_created: {
    subject: "Exchange request received",
    body: "Hi {{customerName}}, your exchange request {{rmaNumber}} for order {{orderName}} has been received and is under review.",
  },
  exchange_approved: {
    subject: "Exchange approved",
    body: "Hi {{customerName}}, your exchange request {{rmaNumber}} for order {{orderName}} has been approved. Your new order is being prepared.",
  },
  exchange_rejected: {
    subject: "Exchange request declined",
    body: "Hi {{customerName}}, your exchange request {{rmaNumber}} for order {{orderName}} could not be approved. Reason: {{reason}}.",
  },
  exchange_shipped: {
    subject: "Exchange shipped",
    body: "Hi {{customerName}}, your exchange {{rmaNumber}} has shipped with tracking {{trackingNumber}} via {{carrier}}.",
  },
  exchange_received: {
    subject: "Exchange received",
    body: "Hi {{customerName}}, we received your exchange return {{rmaNumber}}. Your replacement will be sent soon.",
  },
};

export function interpolateTemplate(template: string, data: Record<string, string | number | undefined>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

export async function getNotificationTemplate(
  shop: string,
  event: NotificationEvent,
  channel: "EMAIL" | "SMS" = "EMAIL",
) {
  const template = await prisma.notificationTemplate.findUnique({
    where: { shop_event_channel: { shop, event, channel } },
  });

  if (template?.active) {
    return { subject: template.subject || undefined, body: template.body };
  }

  return defaultTemplates[event];
}

interface NotifyOptions {
  shop: string;
  channel: "EMAIL" | "SMS";
  to: string;
  event: NotificationEvent;
  data: Record<string, string | number | undefined>;
  returnRequestId?: string;
  exchangeRequestId?: string;
}

export async function sendNotification(options: NotifyOptions) {
  const { shop, channel, to, event, data, returnRequestId, exchangeRequestId } = options;
  if (!to) {
    return { success: false, error: "No recipient" };
  }

  const settings = await prisma.shopSettings.findUnique({ where: { shop } });

  const template = await getNotificationTemplate(shop, event, channel);
  const body = interpolateTemplate(template.body, data);
  const subject = template.subject ? interpolateTemplate(template.subject, data) : undefined;

  const log = await prisma.notificationLog.create({
    data: {
      shop,
      channel,
      to,
      subject,
      body,
      event,
      status: "PENDING",
      returnRequestId,
      exchangeRequestId,
    },
  });

  let result: { success: boolean; error?: string } = { success: false, error: "No provider configured" };

  if (channel === "EMAIL") {
    result = await sendEmail(to, subject || event, body, settings);
  } else if (channel === "SMS") {
    result = await sendSms(to, body, settings);
  }

  await prisma.notificationLog.update({
    where: { id: log.id },
    data: {
      status: result.success ? "SENT" : "FAILED",
      error: result.error || null,
      sentAt: result.success ? new Date() : null,
    },
  });

  return result;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  settings: any,
): Promise<{ success: boolean; error?: string }> {
  const from = settings?.emailFrom || process.env.EMAIL_FROM || "noreply@example.com";

  const resendKey = settings?.resendApiKey || process.env.RESEND_API_KEY;
  const sendgridKey = settings?.sendgridApiKey || process.env.SENDGRID_API_KEY;

  if (resendKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({ from, to, subject, html }),
      });
      if (response.ok) {
        return { success: true };
      }
      const text = await response.text();
      return { success: false, error: `Resend: ${text}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  if (sendgridKey) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sendgridKey}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from },
          subject,
          content: [{ type: "text/html", value: html }],
        }),
      });
      if (response.ok) {
        return { success: true };
      }
      const text = await response.text();
      return { success: false, error: `SendGrid: ${text}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  return { success: false, error: "No email provider configured" };
}

async function sendSms(
  to: string,
  body: string,
  settings: any,
): Promise<{ success: boolean; error?: string }> {
  const accountSid = settings?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = settings?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
  const from = settings?.twilioPhoneNumber || process.env.TWILIO_PHONE_NUMBER;

  if (accountSid && authToken && from) {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          },
          body: new URLSearchParams({ From: from, To: to, Body: body }),
        },
      );
      if (response.ok) {
        return { success: true };
      }
      const text = await response.text();
      return { success: false, error: `Twilio: ${text}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  return { success: false, error: "No SMS provider configured" };
}
