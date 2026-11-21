// Named, cached data hooks for every screen (TanStack Query). Keys line up
// with the invalidations in src/lib/api/repos.ts, as on the web.

import { useQuery } from "@tanstack/react-query";
import { businessRepo, customerRepo, measurementRepo, meRepo, orderRepo, templateRepo } from "./repos";
import { queryClient, toKey } from "./query-client";

export { queryClient, invalidate, clearQueries, setQueryData, getQueryData, toKey } from "./query-client";

export const qk = {
  me: "me",
  business: "business",
  customers: "customers",
  customer: (id: string) => `customer:${id}`,
  measurements: (customerId: string) => `measurements:${customerId}`,
  measurementSet: (id: string) => `measurementSet:${id}`,
  templates: "templates",
  orders: "orders",
  ordersByCustomer: (customerId: string) => `orders:customer:${customerId}`,
  order: (id: string) => `order:${id}`,
};

// ---------------------------------------------------------------- hooks

export const useMeQuery = () => useQuery({ queryKey: toKey(qk.me), queryFn: meRepo.get, staleTime: 300_000 });
export const useBusinessQuery = (enabled = true) =>
  useQuery({ queryKey: toKey(qk.business), queryFn: businessRepo.get, staleTime: 60_000, enabled });
export const useCustomers = () => useQuery({ queryKey: toKey(qk.customers), queryFn: customerRepo.list });
export const useOrders = () => useQuery({ queryKey: toKey(qk.orders), queryFn: orderRepo.list });
/** Templates are global and rarely change — keep them for 10 minutes. */
export const useTemplates = () => useQuery({ queryKey: toKey(qk.templates), queryFn: templateRepo.list, staleTime: 600_000 });

export const useCustomer = (id: string | null | undefined) =>
  useQuery({ queryKey: toKey(qk.customer(id ?? "")), queryFn: () => customerRepo.getById(id!), enabled: !!id });
export const useMeasurements = (customerId: string | null | undefined) =>
  useQuery({
    queryKey: toKey(qk.measurements(customerId ?? "")),
    queryFn: () => measurementRepo.listByCustomer(customerId!),
    enabled: !!customerId,
  });
export const useOrdersByCustomer = (customerId: string | null | undefined) =>
  useQuery({
    queryKey: toKey(qk.ordersByCustomer(customerId ?? "")),
    queryFn: () => orderRepo.getByCustomer(customerId!),
    enabled: !!customerId,
  });
export const useOrder = (id: string | null | undefined) =>
  useQuery({ queryKey: toKey(qk.order(id ?? "")), queryFn: () => orderRepo.getById(id!), enabled: !!id });
export const useMeasurementSet = (id: string | null | undefined) =>
  useQuery({ queryKey: toKey(qk.measurementSet(id ?? "")), queryFn: () => measurementRepo.getById(id!), enabled: !!id, staleTime: 600_000 });

// ------------------------------------------------- prefetch on intent

export function prefetchOrder(id: string) {
  queryClient.prefetchQuery({ queryKey: toKey(qk.order(id)), queryFn: () => orderRepo.getById(id), staleTime: 30_000 });
}

export function prefetchClient(id: string) {
  queryClient.prefetchQuery({ queryKey: toKey(qk.customer(id)), queryFn: () => customerRepo.getById(id), staleTime: 30_000 });
  queryClient.prefetchQuery({ queryKey: toKey(qk.measurements(id)), queryFn: () => measurementRepo.listByCustomer(id), staleTime: 30_000 });
  queryClient.prefetchQuery({ queryKey: toKey(qk.ordersByCustomer(id)), queryFn: () => orderRepo.getByCustomer(id), staleTime: 30_000 });
  queryClient.prefetchQuery({ queryKey: toKey(qk.templates), queryFn: templateRepo.list, staleTime: 600_000 });
}

/** Start the data most screens need as soon as the workspace opens. */
export function prefetchWorkspace() {
  queryClient.prefetchQuery({ queryKey: toKey(qk.orders), queryFn: orderRepo.list, staleTime: 30_000 });
  queryClient.prefetchQuery({ queryKey: toKey(qk.customers), queryFn: customerRepo.list, staleTime: 30_000 });
  queryClient.prefetchQuery({ queryKey: toKey(qk.templates), queryFn: templateRepo.list, staleTime: 600_000 });
}
