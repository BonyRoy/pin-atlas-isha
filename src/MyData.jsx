import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmModal from "./ConfirmModal";
import {
  getPins,
  persistPins,
  pinsFromCsv,
  pinsFromJson,
  pinsToCsv,
  pinsToJson,
} from "./db";

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  document.body.removeChild(field);
}

function downloadFile(filename, contents, type) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function mergePins(current, incoming) {
  const byId = new Map(current.map((pin) => [pin.id, pin]));
  incoming.forEach((pin) => byId.set(pin.id, pin));
  return [...byId.values()];
}

export default function MyData() {
  const [pins, setPins] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const jsonRef = useRef(null);
  const json = useMemo(() => pinsToJson(pins), [pins]);
  const csv = useMemo(() => pinsToCsv(pins), [pins]);

  useEffect(() => {
    getPins()
      .then((saved) => {
        setPins(saved);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 2200);
    return () => clearTimeout(timer);
  }, [status]);

  const runAction = async (label, work) => {
    try {
      await work();
      setStatus(label);
    } catch {
      setStatus("Could not complete that action");
    }
  };

  const selectJson = () => {
    const field = jsonRef.current;
    if (!field) return;
    field.focus();
    field.select();
  };

  const applyImport = async (incoming, mode) => {
    const next = mode === "replace" ? incoming : mergePins(pins, incoming);
    await persistPins(next);
    setPins(next);
    const label = mode === "replace" ? "Replaced" : "Added";
    setStatus(
      `${label} ${incoming.length} ${incoming.length === 1 ? "place" : "places"}`,
    );
  };

  const pickImport = async (event, kind) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const incoming =
        kind === "json" ? pinsFromJson(text) : pinsFromCsv(text);
      if (!incoming.length) {
        setStatus("No places found in that file");
        return;
      }
      if (!pins.length) {
        await applyImport(incoming, "replace");
        return;
      }
      setPendingImport({ incoming, name: file.name });
    } catch {
      setStatus(
        kind === "json"
          ? "Could not read that JSON file"
          : "Could not read that CSV file",
      );
    }
  };

  const finishImport = async (mode) => {
    const incoming = pendingImport?.incoming;
    setPendingImport(null);
    if (!incoming) return;
    try {
      await applyImport(incoming, mode);
    } catch {
      setStatus("Could not save the imported places");
    }
  };

  return (
    <main className="data-shell">
      <header className="home-topbar">
        <a className="brand brand-button" href="#home">
          <span className="brand-mark">⌖</span>
          <span>pin atlas</span>
        </a>
        <div className="topbar-actions">
          <a className="nav-home" href="#home">
            Home
          </a>
          <a className="nav-home" href="#maps">
            Maps
          </a>
          <div className="saved-state">
            <i></i>
            {loaded ? "Saved locally" : "Loading your pins…"}
          </div>
        </div>
      </header>

      <section className="data-page">
        <div className="data-heading">
          <div>
            <p>INDEXEDDB</p>
            <h1>My Data</h1>
            <span>
              {loaded
                ? `${pins.length} ${pins.length === 1 ? "place" : "places"} on this device`
                : "Reading local storage…"}
            </span>
          </div>
          <div className="data-actions">
            <button
              type="button"
              className="ghost-button"
              disabled={!pins.length}
              onClick={() =>
                runAction("JSON copied", () => copyText(json))
              }
            >
              Copy JSON
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={!pins.length}
              onClick={() =>
                runAction("CSV copied", () => copyText(csv))
              }
            >
              Copy CSV
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={!pins.length}
              onClick={() =>
                runAction("JSON downloaded", () =>
                  downloadFile(
                    `pin-atlas-${stamp()}.json`,
                    json,
                    "application/json",
                  ),
                )
              }
            >
              Export JSON
            </button>
            <button
              type="button"
              className="ghost-button"
              disabled={!pins.length}
              onClick={() =>
                runAction("CSV downloaded", () =>
                  downloadFile(`pin-atlas-${stamp()}.csv`, csv, "text/csv"),
                )
              }
            >
              Export CSV
            </button>
            <label className="ghost-button file-button">
              Import JSON
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => pickImport(event, "json")}
              />
            </label>
            <label className="ghost-button file-button">
              Import CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => pickImport(event, "csv")}
              />
            </label>
          </div>
        </div>

        {status && <p className="data-status">{status}</p>}

        {!loaded ? (
          <p className="data-empty-copy">Loading your pins…</p>
        ) : pins.length === 0 ? (
          <div className="data-empty">
            <div>⌖</div>
            <h2>No pins yet</h2>
            <p>Open Maps to drop a place. It will show up here automatically.</p>
            <a className="add-button data-empty-button" href="#maps">
              <b>→</b> Open Maps
            </a>
          </div>
        ) : (
          <>
            <div className="data-list">
              {pins.map((pin) => (
                <article key={pin.id} className="data-card">
                  <div className="data-card-media">
                    {pin.image ? (
                      <img src={pin.image} alt="" />
                    ) : (
                      <span style={{ background: pin.color }}></span>
                    )}
                  </div>
                  <div className="data-card-body">
                    <div className="data-card-title">
                      <i style={{ background: pin.color }}></i>
                      <strong>{pin.title || "Untitled place"}</strong>
                    </div>
                    <small>
                      {Number(pin.lat).toFixed(5)}, {Number(pin.lng).toFixed(5)}
                    </small>
                    <p>{pin.description || "No description"}</p>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      runAction("Pin copied", () =>
                        copyText(JSON.stringify(pin, null, 2)),
                      )
                    }
                  >
                    Copy
                  </button>
                </article>
              ))}
            </div>

            <label className="json-panel">
              <span>Raw JSON — select and paste anywhere</span>
              <textarea
                ref={jsonRef}
                readOnly
                value={json}
                onFocus={selectJson}
                onClick={selectJson}
                spellCheck={false}
                aria-label="Raw pin data as JSON"
              />
            </label>
          </>
        )}
      </section>
      <ConfirmModal
        open={!!pendingImport}
        title="Import these places?"
        message={
          pendingImport
            ? `${pendingImport.name} has ${pendingImport.incoming.length} ${pendingImport.incoming.length === 1 ? "place" : "places"}. Add them to the ${pins.length} already saved, or replace everything on this device.`
            : ""
        }
        extraLabel="Add"
        extraTone="safe"
        confirmLabel="Replace"
        onExtra={() => finishImport("add")}
        onConfirm={() => finishImport("replace")}
        onCancel={() => setPendingImport(null)}
      />
    </main>
  );
}
