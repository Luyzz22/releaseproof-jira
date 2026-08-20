import type { ComponentPropsWithoutRef, ReactNode } from "react";

type PanelProps = { children: ReactNode; className?: string } & Omit<
  ComponentPropsWithoutRef<"section">,
  "children" | "className"
>;

export function Panel({ children, className = "", ...props }: PanelProps) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  );
}
