import * as React from "react";
import { useLocalSearchParams } from "expo-router";
import { OrderDocumentScreen } from "@/features/orders/order-document";

export default function OrderInvoiceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderDocumentScreen orderId={id} kind="invoice" />;
}
