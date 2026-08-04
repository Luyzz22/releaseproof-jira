import { Component, type ReactNode } from "react";

interface ErrorBoundaryState {
  failed: boolean;
}

export class ReleaseProofErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(): void {
    // Intentionally no logging: Jira content and component props must not leak.
  }

  override render() {
    if (this.state.failed) {
      return (
        <main className="shell shell--center">
          <section className="panel state-card state-card--error" role="alert">
            <div className="state-icon" aria-hidden="true">
              !
            </div>
            <div>
              <p className="eyebrow">Sicherer Wiederherstellungsmodus</p>
              <h1>Diese Ansicht konnte nicht dargestellt werden.</h1>
              <p>
                Es wurden keine Jira-Inhalte protokolliert. Laden Sie die App
                neu, um fortzufahren.
              </p>
              <button
                type="button"
                className="button"
                onClick={() => window.location.reload()}
              >
                ReleaseProof neu laden
              </button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
