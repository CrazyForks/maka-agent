"use client";

import type { ReactElement } from "react";
import { Switch as BaseUiSwitch } from "../ui.js";

/**
 * Settings-flavored Switch adapter.
 *
 * Reshapes Base UI's `{ checked, onCheckedChange, aria-label }` API
 * into `{ checked, onChange, ariaLabel, ariaDescribedBy, disabled }` —
 * the shape the 15+ settings toggle call sites have been using since
 * before the Base UI migration. Lives in `@maka/ui` so a single
 * primitive change (e.g. swapping the underlying control) propagates
 * to every settings page automatically, instead of duplicating the
 * adapter inside SettingsModal.tsx.
 *
 * Use this in any settings/preferences row where the row description
 * already supplies the label. For chat / composer / chat-header
 * toggles that pass Base UI props directly (e.g. `checked={false}
 * disabled aria-label="..."`), use the underlying `Switch` /
 * `BaseUiSwitch` re-export instead.
 */
export interface SettingsSwitchProps {
  ariaLabel: string;
  checked: boolean;
  onChange(checked: boolean): void;
  disabled?: boolean;
  ariaDescribedBy?: string;
}

export function SettingsSwitch(props: SettingsSwitchProps): ReactElement {
  return (
    <BaseUiSwitch
      aria-label={props.ariaLabel}
      aria-describedby={props.ariaDescribedBy}
      checked={props.checked}
      disabled={props.disabled}
      onCheckedChange={(next) => props.onChange(next)}
    />
  );
}
