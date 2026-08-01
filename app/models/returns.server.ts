import prisma from "../db.server";
import { Prisma } from "@prisma/client";
import type {
  ReturnRequest,
  ExchangeRequest,
  StoreCredit,
  ShopSettings,
} from "@prisma/client";

export type ReturnRequestWithLineItems = ReturnRequest & {
  lineItems: ReturnLineItemPayload[];
};

export type ExchangeRequestWithLineItems = ExchangeRequest & {
  lineItems: ExchangeLineItemPayload[];
};

export interface ReturnLineItemPayload {
  lineItemId: string;
  productId?: string;
  variantId?: string;
  title: string;
  quantity: number;
  price: number;
  reason?: string;
  requestedAction?: string;
}

export interface ExchangeLineItemPayload {
  originalLineItemId: string;
  originalVariantId?: string;
  newVariantId: string;
  newTitle: string;
  quantity: number;
  reason?: string;
}

export async function getShopSettings(shop: string): Promise<ShopSettings> {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

export async function updateShopSettings(
  shop: string,
  data: Partial<ShopSettings>,
): Promise<ShopSettings> {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop, ...data },
    update: data,
  });
}

export async function listReturnRequests(shop: string): Promise<ReturnRequestWithLineItems[]> {
  return prisma.returnRequest.findMany({
    where: { shop },
    include: { lineItems: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getReturnRequest(
  id: string,
  shop: string,
): Promise<ReturnRequestWithLineItems | null> {
  return prisma.returnRequest.findFirst({
    where: { id, shop },
    include: { lineItems: true },
  });
}

export async function createReturnRequest(data: {
  shop: string;
  orderId: string;
  orderName: string;
  customerEmail?: string;
  customerName?: string;
  reason: string;
  customerNote?: string;
  resolution: "REFUND" | "EXCHANGE" | "STORE_CREDIT" | "REPAIR";
  lineItems: ReturnLineItemPayload[];
}): Promise<ReturnRequestWithLineItems> {
  const total = data.lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return prisma.returnRequest.create({
    data: {
      ...data,
      totalRefund: new Prisma.Decimal(total.toFixed(2)),
      lineItems: {
        create: data.lineItems.map((item) => ({
          ...item,
          price: new Prisma.Decimal(item.price.toFixed(2)),
        })),
      },
    },
    include: { lineItems: true },
  });
}

export async function updateReturnRequest(
  id: string,
  shop: string,
  data: Partial<ReturnRequest>,
): Promise<ReturnRequestWithLineItems> {
  return prisma.returnRequest.update({
    where: { id },
    data,
    include: { lineItems: true },
  });
}

export async function listExchangeRequests(shop: string): Promise<ExchangeRequestWithLineItems[]> {
  return prisma.exchangeRequest.findMany({
    where: { shop },
    include: { lineItems: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getExchangeRequest(
  id: string,
  shop: string,
): Promise<ExchangeRequestWithLineItems | null> {
  return prisma.exchangeRequest.findFirst({
    where: { id, shop },
    include: { lineItems: true },
  });
}

export async function createExchangeRequest(data: {
  shop: string;
  orderId: string;
  orderName: string;
  customerEmail?: string;
  customerName?: string;
  reason: string;
  customerNote?: string;
  lineItems: ExchangeLineItemPayload[];
}): Promise<ExchangeRequestWithLineItems> {
  return prisma.exchangeRequest.create({
    data: {
      ...data,
      lineItems: { create: data.lineItems },
    },
    include: { lineItems: true },
  });
}

export async function updateExchangeRequest(
  id: string,
  shop: string,
  data: Partial<ExchangeRequest>,
): Promise<ExchangeRequestWithLineItems> {
  return prisma.exchangeRequest.update({
    where: { id },
    data,
    include: { lineItems: true },
  });
}

export async function getOrCreateStoreCredit(
  shop: string,
  customerEmail: string,
): Promise<StoreCredit> {
  return prisma.storeCredit.upsert({
    where: { shop_customerEmail: { shop, customerEmail } },
    create: { shop, customerEmail },
    update: {},
  });
}

export async function issueStoreCredit(
  shop: string,
  customerEmail: string,
  amount: number,
  description: string,
  returnRequestId?: string,
): Promise<StoreCredit> {
  const credit = await prisma.storeCredit.upsert({
    where: { shop_customerEmail: { shop, customerEmail } },
    create: {
      shop,
      customerEmail,
      balance: new Prisma.Decimal(amount.toFixed(2)),
      totalIssued: new Prisma.Decimal(amount.toFixed(2)),
    },
    update: {
      balance: { increment: new Prisma.Decimal(amount.toFixed(2)) },
      totalIssued: { increment: new Prisma.Decimal(amount.toFixed(2)) },
    },
  });

  await prisma.storeCreditTransaction.create({
    data: {
      storeCreditId: credit.id,
      amount: new Prisma.Decimal(amount.toFixed(2)),
      type: "issue",
      description,
      returnRequestId,
    },
  });

  return credit;
}
