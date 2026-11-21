// Pure helpers for the Record measurements flow (same rules as the web page).

import type { MeasurementSet, MeasurementTemplate, UnitSystem } from "@/types";
import { formatDelta, formatMeasurement, measurementDelta, parseMeasurement } from "@/lib/format";

export type Step = "client" | "template" | "capture" | "review";
export type Delta = { label: string; direction: "up" | "down" };

export function previousValueOf(previousSet: MeasurementSet | null, key: string, unit: UnitSystem) {
  const v = previousSet?.values.find(x => x.fieldKey === key);
  return v ? formatMeasurement(v.valueMm, unit) : undefined;
}

/** Out-of-range warning, phrased against last time when there is one. */
export function warningOf(
  template: MeasurementTemplate | null,
  previousSet: MeasurementSet | null,
  key: string,
  raw: string,
  unit: UnitSystem,
  unitText: string
) {
  if (!raw || !template) return undefined;
  const f = template.fields.find(x => x.key === key);
  if (!f?.minMm || !f?.maxMm) return undefined;
  const mm = parseMeasurement(raw, unit);
  if (mm >= f.minMm && mm <= f.maxMm) return undefined;
  const p = previousValueOf(previousSet, key, unit);
  return p ? `Far from last time (${p} ${unitText}). Double-check the tape.` : "Outside the usual range. Double-check the tape.";
}

export function deltaOf(previousSet: MeasurementSet | null, key: string, raw: string, unit: UnitSystem): Delta | undefined {
  const p = previousSet?.values.find(x => x.fieldKey === key);
  if (!p || !raw) return undefined;
  const d = measurementDelta(parseMeasurement(raw, unit), p.valueMm, unit);
  return d === 0 ? undefined : { label: formatDelta(d, unit), direction: d > 0 ? "up" : "down" };
}

/** A `?template=` param matches a template id, or loosely by name ("tpl-agbada"). */
export function findTemplateParam(templates: MeasurementTemplate[], param: string) {
  return templates.find(t => t.id === param || t.name.toLowerCase().includes(param.toLowerCase().replace("tpl-", "")));
}
