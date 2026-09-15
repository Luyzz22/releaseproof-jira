import type { BootstrapData } from "../../shared/resolver-contract";
import { Panel } from "../components/panel";
import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";

export function EmptyState({
  data,
  onConfigure,
}: {
  data: BootstrapData;
  onConfigure: () => void;
}) {
  const recoveryRequired = data.configRecoveryRequired;
  const administrationRequired = !data.canConfigure;
  const { t } = useI18n();

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
            {administrationRequired
              ? t(I18N_KEYS.emptyStateAdministrationRequiredEyebrow)
              : recoveryRequired
                ? t(I18N_KEYS.emptyStateRecoveryEyebrow)
                : t(I18N_KEYS.emptyStateWelcomeEyebrow)}
          </p>
          <h1>
            {administrationRequired
              ? recoveryRequired
                ? t(I18N_KEYS.emptyStateAdminRecoveryTitle)
                : t(I18N_KEYS.emptyStateAdminInitialTitle)
              : recoveryRequired
                ? t(I18N_KEYS.emptyStateRecoveryTitle)
                : t(I18N_KEYS.emptyStateWelcomeTitle)}
          </h1>
          <p className="lead">
            {administrationRequired ? (
              recoveryRequired ? (
                t(I18N_KEYS.emptyStateAdminRecoveryDescription)
              ) : (
                <>
                  {t(I18N_KEYS.emptyStateAdminInitialDescriptionPrefix)}{" "}
                  <strong>{data.project.name}</strong>
                  {t(I18N_KEYS.emptyStateAdminInitialDescriptionSuffix)}
                </>
              )
            ) : recoveryRequired ? (
              t(I18N_KEYS.emptyStateRecoveryDescription)
            ) : (
              <>
                {t(I18N_KEYS.emptyStateWelcomeDescriptionPrefix)}{" "}
                <strong>{data.project.name}</strong>
                {t(I18N_KEYS.emptyStateWelcomeDescriptionSuffix)}
              </>
            )}
          </p>
          {data.canConfigure ? (
            <button className="button" type="button" onClick={onConfigure}>
              {recoveryRequired
                ? t(I18N_KEYS.emptyStateRecoveryAction)
                : t(I18N_KEYS.emptyStateConfigureAction)}
            </button>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}
