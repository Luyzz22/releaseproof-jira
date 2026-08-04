import type { BootstrapData } from "../../shared/resolver-contract";
import { Panel } from "../components/panel";

export function EmptyState({
  data,
  onConfigure,
}: {
  data: BootstrapData;
  onConfigure: () => void;
}) {
  return (
    <div className="empty-layout">
      <Panel className="state-card state-card--empty">
        <div className="empty-illustration" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="eyebrow">Willkommen bei ReleaseProof</p>
          <h1>Release-Nachweise sichtbar machen, bevor der Kunde fragt.</h1>
          <p className="lead">
            Für <strong>{data.project.name}</strong> ist noch keine
            Readiness-Konfiguration hinterlegt. Definieren Sie die Kriterien
            einmal projektbezogen; Jira-Inhalte werden nicht dauerhaft
            gespeichert.
          </p>
          <button className="button" type="button" onClick={onConfigure}>
            Projekt jetzt konfigurieren
          </button>
        </div>
      </Panel>
    </div>
  );
}
