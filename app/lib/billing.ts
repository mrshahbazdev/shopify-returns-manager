export const BASIC_PLAN = "Basic";
export const PRO_PLAN = "Pro";
export const ENTERPRISE_PLAN = "Enterprise";

export const PLANS = [
  {
    name: BASIC_PLAN,
    price: "$9.99",
    interval: "/ month",
    description: "Up to 100 return requests per month",
    features: ["Returns & exchanges", "Store credit", "Customer portal", "Email support"],
  },
  {
    name: PRO_PLAN,
    price: "$29.99",
    interval: "/ month",
    description: "Unlimited return requests + analytics",
    features: [
      "Everything in Basic",
      "Advanced analytics",
      "Bulk actions",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: ENTERPRISE_PLAN,
    price: "$99.99",
    interval: "/ month",
    description: "White-glove onboarding and SLA",
    features: [
      "Everything in Pro",
      "Dedicated support",
      "Custom integrations",
      "SLA",
    ],
  },
];
