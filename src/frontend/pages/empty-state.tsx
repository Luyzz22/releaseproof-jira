import type { BootstrapData } from "../../shared/resolver-contract";
import { Panel } from "../components/panel";

export function EmptyState({
  data,
  onConfigure,
}: {
  data: BootstrapData;
  onConfigure: () => void;
}) {
  const recoveryRequired = data.configRecoveryRequired;

  return (
    <div className="empty-layout">
      <Panel className="state-card state-card--empty">
        <div className="empty-illustration" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="eyebrow">
            {recoveryRequired
              ? "Projektkonfiguration reparieren"
              : "Willkommen bei ReleaseProof"}
          </p>
          <h1>
            {recoveryRequired
              ? "Projektkonfiguration sicher ersetzen."
              : "Release-Nachweise sichtbar machen, bevor der Kunde fragt."}
          </h1>
          <p className="lead">
            {recoveryRequired ? (
              <>
                Die gespeicherte Projektkonfiguration ist beschädigt oder nicht
                mehr kompatibel. Speichern Sie eine neue gültige Konfiguration,
                um ReleaseProof wieder zu verwenden.
              </>
            ) : (
              <>
                Für <strong>{data.project.name}</strong> ist noch keine
                Bereitschaftskonfiguration hinterlegt. Definieren Sie die
                Kriterien einmal projektbezogen; Jira-Inhalte werden nicht
                dauerhaft gespeichert.
              </>
            )}
          </p>
          <button className="button" type="button" onClick={onConfigure}>
            {recoveryRequired
              ? "Projektkonfiguration öffnen"
              : "Projekt jetzt konfigurieren"}
          </button>
        </div>
      </Panel>
    </div>
  );
}
