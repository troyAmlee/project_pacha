import { SUPPORTED_LANGS, useTranslation } from "../i18n";

export default function LanguageToggle() {
  const { lang, setLang, t } = useTranslation();

  return (
    <div
      aria-label={t("common.languageLabel")}
      className="language-toggle"
      role="group"
    >
      {SUPPORTED_LANGS.map((code) => {
        const active = code === lang;
        const labelKey = code === "en" ? "common.languageEn" : "common.languageEs";
        return (
          <button
            aria-pressed={active}
            className={`language-toggle__option${active ? " is-active" : ""}`}
            key={code}
            onClick={() => setLang(code)}
            type="button"
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
