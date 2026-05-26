import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "../i18n";
import { geocodeAddress } from "../geocode";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 3;

export default function AddressSearch({
  proximity = null,
  language = "en",
  mode = "append",
  canReplace = true,
  onSelectResult,
  onModeChange,
  disabled = false,
  showModeToggle = true,
  placeholder = null,
  autoFocus = false
}) {
  const { t } = useTranslation();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | empty | error
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setStatus("idle");
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("loading");

      geocodeAddress(query, { proximity, language, signal: controller.signal })
        .then((found) => {
          if (controller.signal.aborted) return;
          setResults(found);
          setStatus(found.length ? "idle" : "empty");
          setHighlightIndex(found.length ? 0 : -1);
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          if (error.name === "AbortError") return;
          setResults([]);
          setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [query, proximity, language]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  function handleSelect(result) {
    if (!result || disabled) return;
    onSelectResult?.(result);
    setQuery("");
    setResults([]);
    setStatus("idle");
    setOpen(false);
    setHighlightIndex(-1);
    // On mobile keyboards, blurring closes the keyboard so the user can see the map.
    inputRef.current?.blur();
  }

  function handleKeyDown(event) {
    if (!open || !results.length) {
      if (event.key === "ArrowDown" && results.length) {
        setOpen(true);
        setHighlightIndex(0);
        event.preventDefault();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      setHighlightIndex((i) => (i + 1) % results.length);
      event.preventDefault();
    } else if (event.key === "ArrowUp") {
      setHighlightIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
      event.preventDefault();
    } else if (event.key === "Enter") {
      const picked = results[highlightIndex] ?? results[0];
      handleSelect(picked);
      event.preventDefault();
    } else if (event.key === "Escape") {
      setOpen(false);
      setHighlightIndex(-1);
    }
  }

  const showList = open && (results.length > 0 || status === "loading" || status === "empty" || status === "error");

  return (
    <div className="address-search">
      {showModeToggle ? (
        <div className="address-search__mode" role="group" aria-label={t("routeBuilder.addressSearchModeLabel")}>
          <button
            type="button"
            className={`button button--outline button--sm${mode === "append" ? " is-active" : ""}`}
            onClick={() => onModeChange?.("append")}
          >
            {t("routeBuilder.addressSearchAppend")}
          </button>
          <button
            type="button"
            className={`button button--outline button--sm${mode === "replace" ? " is-active" : ""}`}
            onClick={() => onModeChange?.("replace")}
            disabled={!canReplace}
          >
            {t("routeBuilder.addressSearchReplace")}
          </button>
        </div>
      ) : null}

      <div className="address-search__combobox">
        <input
          ref={inputRef}
          type="search"
          className="address-search__input"
          placeholder={placeholder ?? t("routeBuilder.addressSearchPlaceholder")}
          autoFocus={autoFocus}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightIndex >= 0 && results[highlightIndex]
              ? `${listboxId}-${highlightIndex}`
              : undefined
          }
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
        />
        {showList ? (
          <ul id={listboxId} role="listbox" className="address-search__listbox">
            {status === "loading" ? (
              <li className="address-search__status">{t("routeBuilder.addressSearchLoading")}</li>
            ) : null}
            {status === "empty" ? (
              <li className="address-search__status">{t("routeBuilder.addressSearchEmpty")}</li>
            ) : null}
            {status === "error" ? (
              <li className="address-search__status address-search__status--error">
                {t("routeBuilder.addressSearchError")}
              </li>
            ) : null}
            {results.map((result, index) => (
              <li
                key={result.id}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === highlightIndex}
                className={`address-search__option${index === highlightIndex ? " is-highlighted" : ""}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  handleSelect(result);
                }}
                onMouseEnter={() => setHighlightIndex(index)}
              >
                <strong>{result.primary}</strong>
                {result.secondary ? <span>{result.secondary}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {showModeToggle && mode === "replace" && !canReplace ? (
        <p className="address-search__hint">{t("routeBuilder.addressSearchReplaceHint")}</p>
      ) : null}
    </div>
  );
}
