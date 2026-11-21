// Record measurements — client → template → keypad capture → review & save.
// Port of tayylo/src/app/(app)/measure/page.tsx.

import * as React from "react";
import { BackHandler } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSharedValue } from "react-native-reanimated";
import { LayoutGrid } from "lucide-react-native";
import type { Customer, MeasurementSet, MeasurementTemplate } from "@/types";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/page";
import { toast } from "@/components/ui/toast";
import { ClientPicker } from "@/components/client-picker";
import { AddClientSheet } from "@/components/add-client-sheet";
import { customerRepo, measurementRepo } from "@/lib/api/repos";
import { getQueryData, qk, useCustomers, useTemplates } from "@/lib/api/query";
import { useBusiness } from "@/lib/use-business";
import { inferBodySex } from "@/lib/measurement-art";
import { formatMeasurement, parseMeasurement, unitLabel } from "@/lib/format";
import { clearDraft, readDraft, writeDraft } from "./draft";
import { deltaOf, findTemplateParam, previousValueOf, warningOf, type Step } from "./measure-logic";
import { TemplateStep } from "./template-step";
import { ReviewFooter, ReviewStep, SavedDialog } from "./review-step";
import { CaptureFocus, CaptureGrid, CaptureProgress } from "./capture-step";

const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

export function MeasureScreen() {
  const params = useLocalSearchParams<{
    clientId?: string;
    template?: string;
  }>();
  const initialClientId = param(params.clientId);
  const initialTemplateParam = param(params.template);
  const { unit } = useBusiness();
  const u = unitLabel(unit);

  const [step, setStep] = React.useState<Step>(initialClientId ? "template" : "client");
  const [client, setClient] = React.useState<Customer | null>(null);
  const clientsQ = useCustomers();
  const templatesQ = useTemplates();
  const clients = clientsQ.data ?? [];
  const clientsLoading = !clientsQ.data;
  const templates = React.useMemo(() => templatesQ.data ?? [], [templatesQ.data]);
  const templatesLoading = !templatesQ.data;
  const [category, setCategory] = React.useState("All");
  const [template, setTemplate] = React.useState<MeasurementTemplate | null>(null);
  const [previousSet, setPreviousSet] = React.useState<MeasurementSet | null>(null);
  const [fieldIndex, setFieldIndex] = React.useState(0);
  // Which way the measurement card slides: forward (next) or back (previous).
  const slideDir = useSharedValue(1);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [gridMode, setGridMode] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [savedSet, setSavedSet] = React.useState<MeasurementSet | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const leaving = React.useRef(false);

  // A template passed in the URL is applied once templates are available.
  const [appliedTemplateParam, setAppliedTemplateParam] = React.useState(false);
  if (!appliedTemplateParam && initialTemplateParam && templatesQ.data) {
    setAppliedTemplateParam(true);
    const found = findTemplateParam(templatesQ.data, initialTemplateParam);
    if (found) setTemplate(found);
  }

  React.useEffect(() => {
    if (!initialClientId) return;
    // Use the cached client instantly when we have it; otherwise fetch.
    const cached = getQueryData<Customer[]>(qk.customers)?.find(c => c.id === initialClientId);
    const lookup = cached ? Promise.resolve(cached) : customerRepo.getById(initialClientId);
    let alive = true;
    lookup
      .then(c => {
        if (!alive) return;
        if (c) setClient(c);
        else setStep("client");
      })
      .catch(() => alive && setStep("client"));
    return () => {
      alive = false;
    };
  }, [initialClientId, initialTemplateParam]);

  const fields = React.useMemo(() => [...(template?.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [template]);
  const currentField = fields[fieldIndex];
  const bodySex = React.useMemo(
    () =>
      inferBodySex(
        fields.map(f => f.key),
        template?.name
      ),
    [fields, template]
  );
  const currentValue = currentField ? values[currentField.key] || "" : "";
  const recordedCount = fields.filter(f => values[f.key]).length;

  const setCurrentValue = (v: string) => {
    if (!currentField || !client || !template) return;
    setValues(prev => {
      const next = { ...prev, [currentField.key]: v };
      writeDraft(client.id, template.id, next);
      return next;
    });
  };

  const selectTemplate = async (tpl: MeasurementTemplate, forClient?: Customer) => {
    const c = forClient || client;
    if (!c) return;
    setTemplate(tpl);

    const [draft, prev] = await Promise.all([readDraft(c.id, tpl.id), measurementRepo.getLatest(c.id, tpl.id).catch(() => null)]);
    setPreviousSet(prev);

    if (Object.keys(draft).length > 0) {
      setValues(draft);
      toast("Picked up your unsaved draft");
    } else if (prev) {
      const prefilled: Record<string, string> = {};
      prev.values.forEach(v => {
        prefilled[v.fieldKey] = formatMeasurement(v.valueMm, unit);
      });
      setValues(prefilled);
    } else {
      setValues({});
    }
    setFieldIndex(0);
    setGridMode(false);
    setStep("capture");
  };

  const selectClient = (c: Customer) => {
    setClient(c);
    if (template) selectTemplate(template, c);
    else setStep("template");
  };

  const next = () => {
    if (fieldIndex < fields.length - 1) {
      slideDir.value = 1;
      setFieldIndex(i => i + 1);
    } else setStep("review");
  };
  const prev = () => {
    slideDir.value = -1;
    setFieldIndex(i => Math.max(0, i - 1));
  };

  const previousValue = (key: string) => previousValueOf(previousSet, key, unit);
  const deltaFor = (key: string, raw: string) => deltaOf(previousSet, key, raw, unit);

  const save = async () => {
    if (!template || !client) return;
    setSaving(true);
    try {
      const created = await measurementRepo.createVersion({
        customerId: client.id,
        templateId: template.id,
        templateName: template.name,
        source: "manual",
        supersedesId: previousSet?.id,
        note: note.trim() || undefined,
        values: fields
          .filter(f => values[f.key])
          .map(f => ({
            fieldKey: f.key,
            labelSnapshot: f.label,
            valueMm: parseMeasurement(values[f.key], unit),
            rawInput: values[f.key],
          })),
      });
      clearDraft(client.id, template.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setSavedSet(created);
    } catch {
      toast.error("Couldn't save. Your values are kept as a draft on this device.");
    } finally {
      setSaving(false);
    }
  };

  const leaveTo = (href: Parameters<typeof router.replace>[0]) => {
    if (leaving.current) return;
    leaving.current = true;
    router.replace(href);
  };
  const viewClient = () => client && leaveTo({ pathname: "/clients/[id]", params: { id: client.id } });
  const createOrder = () => client && leaveTo({ pathname: "/orders/new", params: { clientId: client.id } });

  // Each step's header back, shared with the Android back button.
  const backFor = (): (() => void) | undefined => {
    switch (step) {
      case "client":
        return undefined;
      case "template":
        return initialClientId ? undefined : () => setStep("client");
      case "capture":
        return () => setStep("template");
      case "review":
        return () => {
          setStep("capture");
          setFieldIndex(fields.length - 1);
        };
    }
  };
  const backRef = React.useRef(backFor);
  backRef.current = backFor;
  React.useEffect(() => {
    // Registered once, so open sheets (registered later) handle back first.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const back = backRef.current();
      if (!back) return false;
      back();
      return true;
    });
    return () => sub.remove();
  }, []);

  const addClientSheet = <AddClientSheet open={addOpen} onOpenChange={setAddOpen} onCreated={selectClient} />;

  // ============================================================ STEP: client
  if (step === "client") {
    return (
      <Screen
        header={{
          variant: "compact",
          eyebrow: "Record measurements · Step 1 of 3",
          title: "Who are you measuring?",
          back: true,
        }}
      >
        <ClientPicker clients={clients} loading={clientsLoading} onSelect={selectClient} onAddNew={() => setAddOpen(true)} />
        {addClientSheet}
      </Screen>
    );
  }

  // ========================================================== STEP: template
  if (step === "template") {
    return (
      <Screen
        header={{
          variant: "compact",
          eyebrow: "Record measurements · Step 2 of 3",
          title: "Choose a template",
          back: initialClientId ? true : undefined,
          onBack: backFor(),
          backLabel: initialClientId ? "Back" : "Change client",
        }}
      >
        <TemplateStep
          client={client}
          templates={templates}
          loading={templatesLoading}
          category={category}
          onCategoryChange={setCategory}
          onSelect={t => selectTemplate(t)}
        />
      </Screen>
    );
  }

  // ============================================================ STEP: review
  if (step === "review") {
    return (
      <Screen
        header={{
          variant: "compact",
          eyebrow: "Record measurements · Step 3 of 3",
          title: "Review and save",
          backLabel: "Back to capture",
          onBack: backFor(),
        }}
        footer={
          <ReviewFooter
            onEdit={() => {
              setStep("capture");
              setFieldIndex(0);
            }}
            onSave={save}
            saving={saving}
            disabled={recordedCount === 0}
          />
        }
      >
        <ReviewStep
          client={client}
          template={template}
          fields={fields}
          values={values}
          unitText={u}
          recordedCount={recordedCount}
          note={note}
          onNoteChange={setNote}
          deltaFor={deltaFor}
          onEditField={i => {
            setFieldIndex(i);
            setStep("capture");
          }}
        />
        <SavedDialog savedSet={savedSet} client={client} template={template} onClose={viewClient} onViewClient={viewClient} onCreateOrder={createOrder} />
      </Screen>
    );
  }

  // =========================================================== STEP: capture
  const warning = currentField ? warningOf(template, previousSet, currentField.key, currentValue, unit, u) : undefined;
  const prevVal = currentField ? previousValue(currentField.key) : undefined;

  return (
    <Screen
      scroll={false}
      header={{
        variant: "compact",
        eyebrow: client?.fullName,
        title: template?.name ?? "Measurements",
        onBack: backFor(),
        backLabel: "Back to templates",
        actions: (
          <Button
            variant={gridMode ? "primary" : "secondary"}
            size="icon"
            icon={LayoutGrid}
            onPress={() => setGridMode(g => !g)}
            accessibilityLabel={gridMode ? "Back to one-at-a-time" : "See all measurements"}
          />
        ),
        children: <CaptureProgress fields={fields} fieldIndex={fieldIndex} values={values} />,
      }}
    >
      {gridMode ? (
        <CaptureGrid
          fields={fields}
          values={values}
          fieldIndex={fieldIndex}
          recordedCount={recordedCount}
          unitText={u}
          deltaFor={deltaFor}
          onPickField={i => {
            setFieldIndex(i);
            setGridMode(false);
          }}
          onReview={() => setStep("review")}
        />
      ) : (
        <CaptureFocus
          template={template}
          fields={fields}
          fieldIndex={fieldIndex}
          currentValue={currentValue}
          bodySex={bodySex}
          unit={unit}
          unitText={u}
          previousSet={previousSet}
          prevVal={prevVal}
          warning={warning}
          slideDir={slideDir}
          onChange={setCurrentValue}
          onNext={next}
          onPrevious={prev}
        />
      )}
    </Screen>
  );
}
