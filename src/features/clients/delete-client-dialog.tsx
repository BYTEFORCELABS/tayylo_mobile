// Deleting a client — the same flow as the web's delete-client-dialog.
// It first checks whether the client can be deleted: while they have orders
// in production or money owed it explains why not (the API enforces the same
// rule). Otherwise it lists exactly what will be removed and asks to confirm.

import * as React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api/http";
import { useMeasurements, useOrdersByCustomer } from "@/lib/api/query";
import { customerRepo } from "@/lib/api/repos";
import { formatMoney } from "@/lib/format";
import { clientDeletionBlockers } from "@/lib/orders";
import { useBusiness } from "@/lib/use-business";
import { colors } from "@/theme/tokens";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function DeleteClientDialog({
  clientId,
  clientName,
  open,
  onOpenChange,
}: {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { currency } = useBusiness();
  // Only fetch once the dialog opens; both are usually cached from the profile already.
  const ordersQ = useOrdersByCustomer(open ? clientId : null);
  const measurementsQ = useMeasurements(open ? clientId : null);
  const [deleting, setDeleting] = React.useState(false);

  const orders = ordersQ.data;
  const sets = measurementsQ.data;
  const loading = orders === undefined || sets === undefined;
  // Still no data and a request failed: offer a retry instead of an endless "checking".
  const failed = loading && (ordersQ.isError || measurementsQ.isError);
  const { activeOrders, outstandingMinor, canDelete } = clientDeletionBlockers(orders ?? []);

  const close = (o: boolean) => {
    if (!deleting) onOpenChange(o);
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await customerRepo.delete(clientId);
      toast.success(`${clientName} deleted`);
      onOpenChange(false);
      router.replace("/clients");
    } catch (error) {
      // The server re-checks the rule; if something changed meanwhile, say why.
      toast.error(error instanceof ApiRequestError && error.status === 409 ? error.message : "Couldn't delete this client");
      ordersQ.refetch();
      setDeleting(false);
    }
  };

  if (failed) {
    return (
      <Dialog open={open} onOpenChange={close} title="Couldn't check this client" description="Check your connection and try again.">
        <DialogFooter style={{ marginTop: 0 }}>
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onPress={() => {
              ordersQ.refetch();
              measurementsQ.refetch();
            }}
          >
            Try again
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={close} title={`Delete ${clientName}?`} description="Checking this client's orders and balances…">
        <ActivityIndicator color={colors.ink} style={{ marginVertical: 8 }} />
      </Dialog>
    );
  }

  if (!canDelete) {
    return (
      <Dialog
        open={open}
        onOpenChange={close}
        title={`${clientName} can't be deleted yet`}
        description="Finish or settle these first, so no work or payment is lost:"
      >
        <View style={{ gap: 10 }}>
          {activeOrders > 0 && (
            <View style={styles.reason}>
              <View style={styles.dot} />
              <Text style={{ flex: 1 }}>
                {plural(activeOrders, "order")} still in progress. Mark {activeOrders === 1 ? "it" : "them"} delivered or cancelled.
              </Text>
            </View>
          )}
          {outstandingMinor > 0 && (
            <View style={styles.reason}>
              <View style={styles.dot} />
              <Text style={{ flex: 1 }}>
                <Text tabular weight="semibold">
                  {formatMoney(outstandingMinor, currency)}
                </Text>{" "}
                still owed. Record the payment first.
              </Text>
            </View>
          )}
        </View>
        <DialogFooter>
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onPress={() => {
              onOpenChange(false);
              router.replace(`/clients/${clientId}`);
            }}
          >
            View client
          </Button>
        </DialogFooter>
      </Dialog>
    );
  }

  const parts = [
    sets!.length > 0 ? plural(sets!.length, "measurement set") : null,
    orders!.length > 0 ? `${plural(orders!.length, "past order")} with their payments and fittings` : null,
  ].filter(Boolean);

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      dismissible={!deleting}
      title={`Delete ${clientName}?`}
      description={`${clientName}'s profile${parts.length ? `, ${parts.join(", ")}` : ""}, notes and photos will be permanently deleted. This can't be undone.`}
    >
      <DialogFooter style={{ marginTop: 0 }}>
        <Button variant="secondary" onPress={() => onOpenChange(false)} disabled={deleting}>
          Keep client
        </Button>
        <Button variant="destructive-filled" icon={Trash2} loading={deleting} onPress={remove}>
          Delete client
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  reason: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { marginTop: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.warning },
});
