export function LoadingState({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={compact ? "loading-state" : "shell shell--center"}
      aria-busy="true"
      role="status"
      aria-live="polite"
    >
      <div className="loader" aria-hidden="true" />
      <p>
        {compact ? "Ansicht wird vorbereitet …" : "ReleaseProof wird geladen …"}
      </p>
    </div>
  );
}
