import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReleaseReadinessResult } from "../domain/models/readiness";
import type { SafeError } from "../shared/errors";
import type { BootstrapData } from "../shared/resolver-contract";
import type { ProjectConfigInput } from "../shared/validation";
import { releaseProofApi } from "./api/client";
import { ErrorState } from "./components/error-state";
import { InlineError } from "./components/inline-error";
import { LoadingState } from "./components/loading-state";
import { useScreenFocus } from "./hooks/use-screen-focus";
import { EmptyState } from "./pages/empty-state";
import { ReleaseSelection } from "./pages/release-selection";

const ProjectConfiguration = lazy(() =>
  import("./pages/project-configuration").then((module) => ({
    default: module.ProjectConfiguration,
  })),
);
const ReleaseDashboard = lazy(() =>
  import("./pages/release-dashboard").then((module) => ({
    default: module.ReleaseDashboard,
  })),
);
const IssueEvidenceDetail = lazy(() =>
  import("./pages/issue-evidence-detail").then((module) => ({
    default: module.IssueEvidenceDetail,
  })),
);
const ReportView = lazy(() =>
  import("./pages/report-view").then((module) => ({
    default: module.ReportView,
  })),
);

type Screen =
  "empty" | "config" | "release" | "dashboard" | "detail" | "report";

export function App() {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [result, setResult] = useState<ReleaseReadinessResult | null>(null);
  const [screen, setScreen] = useState<Screen>("empty");
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<SafeError | null>(null);
  const [actionError, setActionError] = useState<SafeError | null>(null);
  const requestId = useRef(0);
  const mainRef = useScreenFocus(screen);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setBootstrapError(null);
    const response = await releaseProofApi.getBootstrap();
    if (currentRequest !== requestId.current) return;
    if (!response.ok) {
      setBootstrapError(response.error);
    } else {
      setData(response.data);
      setScreen(response.data.config ? "release" : "empty");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [load]);

  function navigate(nextScreen: Screen) {
    setActionError(null);
    setScreen(nextScreen);
  }

  async function saveConfig(input: ProjectConfigInput) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await releaseProofApi.saveProjectConfig(input);
      if (!response.ok) {
        setActionError(response.error);
      } else if (data) {
        setData({ ...data, config: response.data });
        setScreen("release");
      }
    } finally {
      setBusy(false);
    }
  }

  async function runAnalysis(versionId: string) {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const response = await releaseProofApi.analyzeRelease(versionId);
      if (!response.ok) {
        setActionError(response.error);
      } else {
        setResult(response.data);
        setScreen("dashboard");
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState />;
  if (bootstrapError) {
    return (
      <main className="shell shell--center">
        <ErrorState error={bootstrapError} onRetry={() => void load()} />
      </main>
    );
  }
  if (!data) return null;

  const showNavigation = screen !== "empty" && screen !== "report";
  const analysisActive = screen === "release";
  const dashboardActive = screen === "dashboard" || screen === "detail";
  const configurationActive = screen === "config";

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">
        Zum Hauptinhalt springen
      </a>
      <header className="topbar no-print">
        <button
          className="brand"
          type="button"
          onClick={() => navigate(data.config ? "release" : "empty")}
          aria-label="ReleaseProof Startseite"
        >
          <span aria-hidden="true">RP</span>
          <strong>ReleaseProof</strong>
        </button>
        <div className="project-context" aria-label="Aktuelles Jira-Projekt">
          <span>{data.project.key}</span>
          <strong>{data.project.name}</strong>
        </div>
        {showNavigation ? (
          <nav aria-label="Hauptnavigation">
            <button
              className={analysisActive ? "active" : ""}
              type="button"
              aria-current={analysisActive ? "page" : undefined}
              onClick={() => navigate("release")}
            >
              Analyse
            </button>
            {result ? (
              <button
                className={dashboardActive ? "active" : ""}
                type="button"
                aria-current={dashboardActive ? "page" : undefined}
                onClick={() => navigate("dashboard")}
              >
                Dashboard
              </button>
            ) : null}
            <button
              className={configurationActive ? "active" : ""}
              type="button"
              aria-current={configurationActive ? "page" : undefined}
              onClick={() => navigate("config")}
            >
              Konfiguration
            </button>
          </nav>
        ) : null}
        <div className="privacy-indicator">
          <i aria-hidden="true" /> Atlassian Forge
        </div>
      </header>
      <main
        className="shell"
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        aria-busy={busy}
      >
        {actionError ? (
          <InlineError
            error={actionError}
            onDismiss={() => setActionError(null)}
          />
        ) : null}
        <Suspense fallback={<LoadingState compact />}>
          {screen === "empty" ? (
            <EmptyState data={data} onConfigure={() => navigate("config")} />
          ) : null}
          {screen === "config" ? (
            <ProjectConfiguration
              data={data}
              saving={busy}
              onSave={saveConfig}
            />
          ) : null}
          {screen === "release" ? (
            <ReleaseSelection
              data={data}
              analyzing={busy}
              onAnalyze={runAnalysis}
              onConfigure={() => navigate("config")}
            />
          ) : null}
          {screen === "dashboard" && result ? (
            <ReleaseDashboard
              data={data}
              result={result}
              onDetail={(issueKey) => {
                setSelectedIssue(issueKey);
                navigate("detail");
              }}
              onReport={() => navigate("report")}
              onNewAnalysis={() => navigate("release")}
            />
          ) : null}
          {screen === "detail" && result && selectedIssue ? (
            <IssueEvidenceDetail
              result={result}
              issueKey={selectedIssue}
              siteUrl={data.siteUrl}
              onBack={() => navigate("dashboard")}
            />
          ) : null}
          {screen === "report" && result ? (
            <ReportView result={result} onBack={() => navigate("dashboard")} />
          ) : null}
        </Suspense>
      </main>
    </div>
  );
}
