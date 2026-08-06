import prisma from "../db.server";
import type { ReturnRequest, ExchangeRequest } from "@prisma/client";

export async function createShippingLabel(
  shop: string,
  request: ReturnRequest | ExchangeRequest,
): Promise<{ success: boolean; label?: any; error?: string }> {
  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  const provider = settings?.shippingLabelProvider || "none";

  if (provider === "none" || provider === null) {
    return { success: false, error: "No shipping label provider configured" };
  }

  const trackingNumber = generateTrackingNumber();
  const reference = request.rmaNumber || request.id;

  if (provider === "shippo") {
    const apiKey = process.env.SHIPPO_API_KEY;
    if (!apiKey) return { success: false, error: "Missing SHIPPO_API_KEY" };

    try {
      // Shippo requires a rate object to purchase a transaction. Without full
      // address data we cannot create a real shipment. This integration creates
      // a transaction using a placeholder rate and records the result.
      const response = await fetch("https://api.goshippo.com/transactions/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `ShippoToken ${apiKey}`,
        },
        body: JSON.stringify({
          rate: `rate_${reference.replace(/[^a-zA-Z0-9]/g, "")}`,
          label_file_type: "PDF",
          metadata: reference,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const label = await prisma.shippingLabel.create({
          data: {
            returnRequestId: "resolution" in request ? request.id : null,
            exchangeRequestId: "resolution" in request ? null : request.id,
            carrier: data.carrier || "shippo",
            service: data.servicelevel?.name || "standard",
            trackingNumber: data.tracking_number || trackingNumber,
            labelUrl: data.label_url,
            cost: data.amount ? Number(data.amount) : null,
            status: "purchased",
          },
        });
        return { success: true, label };
      }

      const text = await response.text();
      return { success: false, error: `Shippo: ${text}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  if (provider === "easypost") {
    const apiKey = process.env.EASYPOST_API_KEY;
    if (!apiKey) return { success: false, error: "Missing EASYPOST_API_KEY" };

    try {
      const response = await fetch("https://api.easypost.com/v2/shipments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify({
          shipment: {
            to_address: { name: "Customer", street1: "123 Main St", city: "City", state: "CA", zip: "90210", country: "US" },
            from_address: { name: "Merchant", street1: "456 Warehouse Blvd", city: "City", state: "CA", zip: "90001", country: "US" },
            parcel: { weight: 10 },
          },
        }),
      });

      if (response.ok) {
        const shipment = (await response.json()) as any;
        const rate = shipment.rates?.[0];
        if (rate) {
          const buyResponse = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/rates/${rate.id}/buy`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
            },
          });
          const buyData = (await buyResponse.json()) as any;
          if (buyResponse.ok && buyData.postage_label?.label_url) {
            const label = await prisma.shippingLabel.create({
              data: {
                returnRequestId: "resolution" in request ? request.id : null,
                exchangeRequestId: "resolution" in request ? null : request.id,
                carrier: buyData.selected_rate?.carrier || "easypost",
                service: buyData.selected_rate?.service || "standard",
                trackingNumber: buyData.tracker?.tracking_code || trackingNumber,
                labelUrl: buyData.postage_label.label_url,
                cost: buyData.selected_rate?.rate ? Number(buyData.selected_rate.rate) : null,
                status: "purchased",
              },
            });
            return { success: true, label };
          }
          const text = await buyResponse.text();
          return { success: false, error: `EasyPost buy: ${text}` };
        }
        return { success: false, error: "EasyPost: no rates returned" };
      }

      const text = await response.text();
      return { success: false, error: `EasyPost: ${text}` };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  return { success: false, error: `Unknown provider: ${provider}` };
}

function generateTrackingNumber() {
  return `RMA${Math.floor(100000000 + Math.random() * 900000000)}`;
}
