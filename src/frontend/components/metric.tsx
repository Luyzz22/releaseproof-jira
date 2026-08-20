import { memo } from "react";

type MetricTone = "neutral" | "score" | "ready" | "incomplete" | "blocked";

export const Metric = memo(function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: MetricTone;
}) {
  return (
    <div className={`metric metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
});
