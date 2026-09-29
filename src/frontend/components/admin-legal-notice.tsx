import { useI18n } from "../i18n/context";
import { I18N_KEYS } from "../i18n/keys";

const PRIVACY_NOTICE_URL = "https://releaseproof.de/legal/privacy";

export function AdminLegalNotice({ visible }: { visible: boolean }) {
  const { t } = useI18n();

  if (!visible) return null;

  return (
    <aside
      className="scope-notice scope-notice--warning"
      aria-labelledby="admin-legal-notice-title"
      role="status"
    >
      <p className="eyebrow">{t(I18N_KEYS.adminNoticeEyebrow)}</p>
      <strong id="admin-legal-notice-title">
        {t(I18N_KEYS.adminNoticePrivacyTitle)}
      </strong>
      <p>{t(I18N_KEYS.adminNoticePrivacyDescription)}</p>
      <a href={PRIVACY_NOTICE_URL}>{t(I18N_KEYS.adminNoticePrivacyLink)}</a>
    </aside>
  );
}
