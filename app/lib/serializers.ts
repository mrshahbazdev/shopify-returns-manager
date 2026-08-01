import { Prisma } from "@prisma/client";

export function serializeDecimal(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return value.toNumber();
}

export function serializeObject<T extends Record<string, unknown>>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => {
      if (value instanceof Prisma.Decimal) return value.toNumber();
      return value;
    }),
  ) as T;
}
