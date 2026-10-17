import type { FormState } from "@/server/actions/admin/helpers";

/**
 * Default value for an uncontrolled field: the value echoed by the last failed
 * submission when there is one, otherwise the persisted value.
 */
export function valueOf(state: FormState, name: string, fallback: string | number | null | undefined): string {
  const echoed = state.data?.values?.[name];
  if (echoed !== undefined) return echoed;
  return fallback === null || fallback === undefined ? "" : String(fallback);
}

export function checkedOf(state: FormState, name: string, fallback: boolean): boolean {
  const values = state.data?.values;
  if (values) return values[name] === "on";
  return fallback;
}

export function errorsOf(state: FormState, name: string): string[] | undefined {
  return state.fieldErrors?.[name];
}
