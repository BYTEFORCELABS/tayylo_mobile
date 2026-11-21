// Shared control surface: same height, radius, fill and focus treatment for
// every text input, select and textarea — mirrors the web's controlBase.

import * as React from "react";
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import { AlertCircle, Check, ChevronDown, type LucideIcon } from "lucide-react-native";
import { colors, radii } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { Text } from "./text";
import { BottomSheet } from "./sheet";

const RING = "0px 0px 0px 4px rgba(69,79,44,0.12)";
const RING_DANGER = "0px 0px 0px 4px rgba(156,61,44,0.12)";

interface FieldProps {
  label?: React.ReactNode;
  /** Shown after the label in muted text, e.g. "Optional" — or a node (link). */
  hint?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: string;
  warning?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Label + control + message. Use for any custom control too. */
export function Field({ label, hint, helperText, error, warning, children, style }: FieldProps) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {label ? (
        <View style={styles.labelRow}>
          {typeof label === "string" ? (
            <Text variant="label" weight="semibold">
              {label}
            </Text>
          ) : (
            label
          )}
          {typeof hint === "string" ? (
            <Text variant="caption" weight="medium" color={colors.textTertiary}>
              {hint}
            </Text>
          ) : (
            hint
          )}
        </View>
      ) : null}
      {children}
      {error ? (
        <View style={styles.message} accessibilityRole="alert">
          <AlertCircle size={14} strokeWidth={2} color={colors.danger} />
          <Text variant="caption" weight="medium" color={colors.danger} style={{ flexShrink: 1 }}>
            {error}
          </Text>
        </View>
      ) : warning ? (
        <View style={styles.message}>
          <AlertCircle size={14} strokeWidth={2} color={colors.warning} />
          <Text variant="caption" weight="medium" color={colors.warning} style={{ flexShrink: 1 }}>
            {warning}
          </Text>
        </View>
      ) : helperText ? (
        typeof helperText === "string" ? (
          <Text variant="caption" color={colors.textTertiary}>
            {helperText}
          </Text>
        ) : (
          helperText
        )
      ) : null}
    </View>
  );
}

export interface InputProps extends Omit<TextInputProps, "style"> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: string;
  warning?: string;
  /** Trailing unit / currency text inside the field. */
  unit?: string;
  /** Leading unit / currency text inside the field. */
  prefix?: string;
  leadingIcon?: LucideIcon;
  trailing?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps["style"];
}

export const Input = React.forwardRef<React.ComponentRef<typeof TextInput>, InputProps>(function Input(
  { label, hint, helperText, error, warning, unit, prefix, leadingIcon: Leading, trailing, containerStyle, inputStyle, editable = true, onFocus, onBlur, ...props },
  ref
) {
  const [focused, setFocused] = React.useState(false);
  return (
    <Field label={label} hint={hint} helperText={helperText} error={error} warning={warning} style={containerStyle}>
      <View
        style={[
          styles.control,
          { height: 48 },
          focused && { borderColor: error ? colors.danger : colors.olive, boxShadow: error ? RING_DANGER : RING },
          !focused && error ? { borderColor: colors.danger } : null,
          !editable && { opacity: 0.5 },
        ]}
      >
        {Leading ? (
          <View style={styles.leading} pointerEvents="none">
            <Leading size={18} strokeWidth={1.75} color={colors.textTertiary} />
          </View>
        ) : null}
        {prefix ? (
          <Text style={styles.prefix} weight="medium" color={colors.textTertiary} pointerEvents="none">
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.olive}
          cursorColor={colors.olive}
          accessibilityLabel={typeof label === "string" ? label : props.placeholder}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            { paddingLeft: Leading || prefix ? 44 : 16, paddingRight: unit || trailing ? 48 : 16 },
            inputStyle,
          ]}
          {...props}
        />
        {unit ? (
          <Text variant="label" weight="medium" color={colors.textTertiary} style={styles.unit} pointerEvents="none">
            {unit}
          </Text>
        ) : null}
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </Field>
  );
});

export interface TextareaProps extends Omit<InputProps, "unit" | "prefix" | "leadingIcon" | "trailing"> {
  rows?: number;
}

export const Textarea = React.forwardRef<React.ComponentRef<typeof TextInput>, TextareaProps>(function Textarea(
  { label, hint, helperText, error, containerStyle, inputStyle, rows = 4, onFocus, onBlur, ...props },
  ref
) {
  const [focused, setFocused] = React.useState(false);
  return (
    <Field label={label} hint={hint} helperText={helperText} error={error} style={containerStyle}>
      <View
        style={[
          styles.control,
          focused && { borderColor: colors.olive, boxShadow: RING },
          !focused && error ? { borderColor: colors.danger } : null,
        ]}
      >
        <TextInput
          ref={ref}
          multiline
          textAlignVertical="top"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.olive}
          cursorColor={colors.olive}
          accessibilityLabel={typeof label === "string" ? label : props.placeholder}
          onFocus={e => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, styles.textarea, { minHeight: 24 + rows * 24 }, inputStyle]}
          {...props}
        />
      </View>
    </Field>
  );
});

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional muted second line in the picker. */
  description?: string;
}

interface SelectProps<T extends string> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: string;
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  /** Title of the picker sheet (defaults to the label). */
  sheetTitle?: string;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
}

/**
 * The web uses a native <select> on phones; here the same control opens a
 * native-feeling bottom sheet list with the current choice ticked.
 */
export function Select<T extends string>({
  label,
  hint,
  helperText,
  error,
  value,
  onChange,
  options,
  placeholder = "Choose",
  sheetTitle,
  containerStyle,
  disabled,
}: SelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const current = options.find(o => o.value === value);
  return (
    <Field label={label} hint={hint} helperText={helperText} error={error} style={containerStyle}>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${typeof label === "string" ? label : "Select"}: ${current?.label ?? placeholder}`}
        style={({ pressed }) => [
          styles.control,
          styles.select,
          pressed && { borderColor: colors.borderStrong },
          error ? { borderColor: colors.danger } : null,
          disabled && { opacity: 0.5 },
        ]}
      >
        <Text numberOfLines={1} style={styles.selectText} color={current ? colors.ink : colors.textTertiary}>
          {current?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} strokeWidth={1.75} color={colors.textTertiary} />
      </Pressable>
      <BottomSheet open={open} onOpenChange={setOpen} title={sheetTitle ?? (typeof label === "string" ? label : undefined)}>
        <View style={{ marginHorizontal: -8 }}>
          {options.map(o => {
            const selected = o.value === value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={({ pressed }) => [styles.option, (pressed || selected) && { backgroundColor: colors.beigeLight }]}
              >
                <View style={{ flex: 1 }}>
                  <Text weight={selected ? "semibold" : "medium"}>{o.label}</Text>
                  {o.description ? (
                    <Text variant="caption" color={colors.textTertiary}>
                      {o.description}
                    </Text>
                  ) : null}
                </View>
                {selected && <Check size={18} strokeWidth={2.25} color={colors.olive} />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </Field>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  message: { flexDirection: "row", alignItems: "center", gap: 6 },
  control: {
    width: "100%",
    borderRadius: radii.input,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.ink,
    paddingVertical: 0,
  },
  textarea: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, lineHeight: 24 },
  leading: { position: "absolute", left: 16, top: 0, bottom: 0, justifyContent: "center", zIndex: 1 },
  prefix: { position: "absolute", left: 16, fontSize: 15, zIndex: 1 },
  unit: { position: "absolute", right: 16 },
  trailing: { position: "absolute", right: 6, top: 0, bottom: 0, justifyContent: "center" },
  select: { height: 48, flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 16, gap: 8 },
  selectText: { flex: 1, fontSize: 15 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.control,
  },
});
