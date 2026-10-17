/** Shared shape for Server Action results consumed by useActionState. */
export type ActionState<TData = undefined> = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  data?: TData;
};

export const idleState: ActionState<never> = { status: "idle" };

export function errorState(message: string, fieldErrors?: Record<string, string[]>): ActionState<never> {
  return { status: "error", message, fieldErrors };
}

export function successState<T>(message?: string, data?: T): ActionState<T> {
  return { status: "success", message, data };
}
