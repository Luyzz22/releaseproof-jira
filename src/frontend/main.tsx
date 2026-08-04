import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { view } from "@forge/bridge";
import { App } from "./App";
import { ReleaseProofErrorBoundary } from "./components/error-boundary";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("ReleaseProof root element is missing.");

void view.theme.enable().catch(() => undefined);

createRoot(root).render(
  <StrictMode>
    <ReleaseProofErrorBoundary>
      <App />
    </ReleaseProofErrorBoundary>
  </StrictMode>,
);
