export interface DeletionConfirmationState {
  open: boolean;
  projectKey: string;
}

export type DeletionConfirmationAction =
  { type: "open" } | { type: "key"; value: string } | { type: "reset" };

export const initialDeletionConfirmation: DeletionConfirmationState = {
  open: false,
  projectKey: "",
};

export function deletionConfirmationReducer(
  state: DeletionConfirmationState,
  action: DeletionConfirmationAction,
): DeletionConfirmationState {
  switch (action.type) {
    case "open":
      return { open: true, projectKey: "" };
    case "key":
      return { ...state, projectKey: action.value };
    case "reset":
      return initialDeletionConfirmation;
  }
}

export function isDeletionConfirmed(
  state: DeletionConfirmationState,
  projectKey: string,
  busy: boolean,
): boolean {
  return state.open && !busy && state.projectKey === projectKey;
}

export async function runConfirmedDeletion(
  state: DeletionConfirmationState,
  projectKey: string,
  busy: boolean,
  inFlight: { current: boolean },
  onDelete: () => Promise<boolean>,
): Promise<boolean> {
  if (inFlight.current || !isDeletionConfirmed(state, projectKey, busy))
    return false;
  inFlight.current = true;
  try {
    return await onDelete();
  } finally {
    inFlight.current = false;
  }
}
