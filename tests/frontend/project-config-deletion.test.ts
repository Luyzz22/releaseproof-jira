import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import en from "../../locales/en-US.json";
import de from "../../locales/de-DE.json";
import { ProjectConfigDeleteSection } from "../../src/frontend/components/project-config-delete-section";
import {
  I18nProvider,
  type TranslationFunction,
} from "../../src/frontend/i18n/context";
import { I18N_KEYS } from "../../src/frontend/i18n/keys";
import {
  deletionConfirmationReducer,
  initialDeletionConfirmation,
  isDeletionConfirmed,
  runConfirmedDeletion,
} from "../../src/frontend/project-config-deletion";

describe("Configuration deletion confirmation", () => {
  it("requires an explicit first step, exact key, and a separate final action", async () => {
    const onDelete = vi.fn(async () => true);
    const lock = { current: false };
    let state = initialDeletionConfirmation;
    expect(
      await runConfirmedDeletion(state, "DEMO", false, lock, onDelete),
    ).toBe(false);
    state = deletionConfirmationReducer(state, { type: "open" });
    expect(state.open).toBe(true);
    expect(onDelete).not.toHaveBeenCalled();
    for (const key of ["", "demo", "OTHER", " DEMO", "DEMO "]) {
      state = deletionConfirmationReducer(state, { type: "key", value: key });
      expect(isDeletionConfirmed(state, "DEMO", false)).toBe(false);
      expect(
        await runConfirmedDeletion(state, "DEMO", false, lock, onDelete),
      ).toBe(false);
    }
    state = deletionConfirmationReducer(state, { type: "key", value: "DEMO" });
    expect(isDeletionConfirmed(state, "DEMO", false)).toBe(true);
    expect(
      await runConfirmedDeletion(state, "DEMO", false, lock, onDelete),
    ).toBe(true);
    expect(onDelete).toHaveBeenCalledOnce();
    expect(deletionConfirmationReducer(state, { type: "reset" })).toEqual(
      initialDeletionConfirmation,
    );
  });

  it("cancel clears confirmation without deleting; reopening needs a new key", async () => {
    const onDelete = vi.fn(async () => true);
    const state = deletionConfirmationReducer(
      { open: true, projectKey: "DEMO" },
      { type: "reset" },
    );
    expect(state).toEqual(initialDeletionConfirmation);
    const reopened = deletionConfirmationReducer(state, { type: "open" });
    expect(
      await runConfirmedDeletion(
        reopened,
        "DEMO",
        false,
        { current: false },
        onDelete,
      ),
    ).toBe(false);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("blocks busy and same-tick duplicate calls, releases the lock after failure, and allows retry", async () => {
    const state = { open: true, projectKey: "DEMO" };
    const lock = { current: false };
    let finish!: (success: boolean) => void;
    const onDelete = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    expect(
      await runConfirmedDeletion(state, "DEMO", true, lock, onDelete),
    ).toBe(false);
    expect(onDelete).not.toHaveBeenCalled();
    const first = runConfirmedDeletion(state, "DEMO", false, lock, onDelete);
    expect(
      await runConfirmedDeletion(state, "DEMO", false, lock, onDelete),
    ).toBe(false);
    expect(onDelete).toHaveBeenCalledOnce();
    finish(false);
    expect(await first).toBe(false);
    expect(lock.current).toBe(false);
    expect(state).toEqual({ open: true, projectKey: "DEMO" });
    onDelete.mockResolvedValue(true);
    expect(
      await runConfirmedDeletion(state, "DEMO", false, lock, onDelete),
    ).toBe(true);
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it("releases the synchronous lock even if the callback throws", async () => {
    const lock = { current: false };
    await expect(
      runConfirmedDeletion(
        { open: true, projectKey: "DEMO" },
        "DEMO",
        false,
        lock,
        async () => {
          throw new Error("test failure");
        },
      ),
    ).rejects.toThrow("test failure");
    expect(lock.current).toBe(false);
  });
});

describe("Delete confirmation localized rendering", () => {
  it.each([
    ["en-US", en, "Permanently delete configuration", "Cancel"],
    ["de-DE", de, "Konfiguration endgültig löschen", "Abbrechen"],
  ] as const)(
    "renders accessible, fully translated %s confirmation states",
    (locale, messages, finalAction, cancel) => {
      const t: TranslationFunction = (key) =>
        key
          .split(".")
          .reduce<unknown>(
            (value, part) =>
              typeof value === "object" && value !== null
                ? (value as Record<string, unknown>)[part]
                : undefined,
            messages,
          ) as string;
      const keys = Object.values(I18N_KEYS).filter((key) =>
        key.startsWith("projectConfiguration.delete."),
      );
      expect(keys.length).toBeGreaterThanOrEqual(11);
      for (const key of keys) expect(t(key)).toBeTruthy();
      const render = (open: boolean, projectKey: string, busy = false) =>
        renderToStaticMarkup(
          createElement(I18nProvider, {
            locale,
            t,
            children: createElement(ProjectConfigDeleteSection, {
              projectKey: "DEMO",
              state: { open, projectKey },
              busy,
              onAction: vi.fn(),
              onConfirm: vi.fn(),
            }),
          }),
        );
      expect(render(false, "")).not.toContain(finalAction);
      const wrong = render(true, "demo");
      expect(wrong).toContain(
        'aria-describedby="delete-config-warning delete-config-instruction"',
      );
      expect(wrong).toContain('for="delete-config-project-key"');
      expect(wrong).toContain(`disabled="">${finalAction}</button>`);
      expect(wrong).toContain(cancel);
      const ready = render(true, "DEMO");
      expect(ready).toContain(finalAction);
      expect(ready).not.toContain('disabled=""');
      expect(ready).not.toContain("projectConfiguration.delete.");
      expect(render(true, "DEMO", true)).toContain('disabled=""');
    },
  );
});
