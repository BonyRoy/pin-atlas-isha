import { useMemo, useState } from "react";

export default function ExportPdfModal({ pins, exporting, onClose, onExport }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(() => new Set(pins.map((pin) => pin.id)));

  const visiblePins = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return pins;
    return pins.filter((pin) =>
      [pin.title, pin.description, pin.lat, pin.lng].some((value) =>
        String(value ?? "").toLowerCase().includes(search),
      ),
    );
  }, [pins, query]);

  const toggle = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectedPins = pins.filter((pin) => selected.has(pin.id));

  return (
    <div className="modal-backdrop" onMouseDown={exporting ? undefined : onClose}>
      <section
        className="modal-card export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-report-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="modal-kicker">PDF EXPORT</p>
        <h2 id="export-report-title">Create location report</h2>
        <p className="modal-copy">Choose the pins to include. The PDF contains a fitted map with their cards, followed by one formal detail page per location.</p>
        <input
          className="export-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search locations"
          aria-label="Search locations to export"
          disabled={exporting}
        />
        <div className="export-selection-actions">
          <span>{selected.size} selected</span>
          <button type="button" onClick={() => setSelected(new Set(visiblePins.map((pin) => pin.id)))} disabled={exporting}>Select shown</button>
          <button type="button" onClick={() => setSelected(new Set())} disabled={exporting}>Clear</button>
        </div>
        <div className="export-pin-list">
          {visiblePins.map((pin) => (
            <label className="export-pin" key={pin.id}>
              <input type="checkbox" checked={selected.has(pin.id)} onChange={() => toggle(pin.id)} disabled={exporting} />
              <i style={{ background: pin.color }}></i>
              <span><strong>{pin.title || "Untitled place"}</strong><small>{Number(pin.lat).toFixed(3)}, {Number(pin.lng).toFixed(3)}</small></span>
            </label>
          ))}
          {!visiblePins.length && <p className="export-empty">No matching locations.</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost-button" onClick={onClose} disabled={exporting}>Cancel</button>
          <button type="button" className="modal-confirm is-safe" onClick={() => onExport(selectedPins)} disabled={!selectedPins.length || exporting}>
            {exporting ? "Creating PDF…" : "Export PDF"}
          </button>
        </div>
      </section>
    </div>
  );
}
