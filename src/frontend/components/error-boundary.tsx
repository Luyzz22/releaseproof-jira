import { Component, type ReactNode } from "react";
import type { TranslationFunction } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";

interface ReleaseProofErrorBoundaryProps {
  children: ReactNode;
  t: TranslationFunction;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ReleaseProofErrorBoundary extends Component<
  ReleaseProofErrorBoundaryProps,
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
    const { t } = this.props;

    if (this.state.failed) {
      return (
        <main className="shell shell--center">
          <section className="panel state-card state-card--error" role="alert">
            <div className="state-icon" aria-hidden="true">
              !
            </div>
            <div>
              <p className="eyebrow">
                {t(I18N_KEYS.errorBoundaryEyebrow, "Safe recovery mode")}
              </p>
              <h1>
                {t(
                  I18N_KEYS.errorBoundaryTitle,
                  "This view could not be displayed.",
                )}
              </h1>
              <p>
                {t(
                  I18N_KEYS.errorBoundaryDescription,
                  "No Jira content was logged. Reload the app to continue.",
                )}
              </p>
              <button
                type="button"
                className="button"
                onClick={() => window.location.reload()}
              >
                {t(I18N_KEYS.errorBoundaryReload, "Reload ReleaseProof")}
              </button>
            </div>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}
