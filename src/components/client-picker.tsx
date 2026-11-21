import * as React from "react";
import { View } from "react-native";
import { UserPlus, Users } from "lucide-react-native";
import type { Customer } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/choice";
import { List, ListItem } from "@/components/ui/list";
import { EmptyState, ListSkeleton } from "@/components/ui/states";

interface ClientPickerProps {
  clients: Customer[];
  loading: boolean;
  onSelect: (client: Customer) => void;
  onAddNew: () => void;
}

/** Search-first client chooser used by the measure and new-order flows. */
export function ClientPicker({ clients, loading, onSelect, onAddNew }: ClientPickerProps) {
  const [query, setQuery] = React.useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c => c.fullName.toLowerCase().includes(q) || c.phones.some(p => p.replace(/\s/g, "").includes(q.replace(/\s/g, ""))))
    : clients;

  return (
    <View>
      <SearchField value={query} onValueChange={setQuery} placeholder="Search by name or phone" size="lg" autoFocus />

      <View style={{ marginTop: 16 }}>
        {loading ? (
          <ListSkeleton count={6} />
        ) : clients.length === 0 ? (
          <EmptyState
            variant="inset"
            icon={Users}
            title="No clients yet"
            description="Add the client first, then come back to continue."
            action={
              <Button icon={UserPlus} onPress={onAddNew}>
                Add client
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            variant="inset"
            title={`No match for “${query}”`}
            description="Check the spelling, or add them as a new client."
            action={
              <Button variant="secondary" icon={UserPlus} onPress={onAddNew}>
                Add new client
              </Button>
            }
          />
        ) : (
          <List>
            {filtered.slice(0, 50).map(c => (
              <ListItem
                key={c.id}
                onPress={() => onSelect(c)}
                leading={<Avatar name={c.fullName} src={c.photoUrl} />}
                title={c.fullName}
                subtitle={c.phones[0] || "No phone"}
                chevron
              />
            ))}
          </List>
        )}
      </View>

      {clients.length > 0 && (
        <Button variant="ghost" block icon={UserPlus} onPress={onAddNew} style={{ marginTop: 12 }}>
          Add a new client
        </Button>
      )}
    </View>
  );
}
