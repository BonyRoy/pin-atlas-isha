import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import { getPins, persistPins } from "./db";
import ConfirmModal, { TrashIcon } from "./ConfirmModal";
import Dashboard from "./Dashboard";
import Home from "./Home";
import LeaderCards from "./LeaderCards";
import MyData from "./MyData";

function getPageFromHash() {
  const hash = window.location.hash.replace(/^#\/?/, "");
  if (hash === "maps" || hash === "data" || hash === "dashboard") return hash;
  return "home";
}

const blankPin = (lat = 20, lng = 0, title = "Untitled place") => ({
  id: crypto.randomUUID(),
  lat: Number(lat.toFixed(5)),
  lng: Number(lng.toFixed(5)),
  title,
  image: "",
  description: "Add a note about this location.",
  color: "#ef5b3f",
});
function PinDropper({ onDrop }) {
  const clicks = useRef({ count: 0, timer: null });

  useEffect(
    () => () => {
      if (clicks.current.timer) clearTimeout(clicks.current.timer);
    },
    [],
  );

  useMapEvents({
    click: ({ latlng }) => {
      const pending = clicks.current;
      if (pending.timer) clearTimeout(pending.timer);
      pending.count += 1;

      if (pending.count === 3) {
        pending.count = 0;
        pending.timer = null;
        onDrop(latlng);
        return;
      }

      pending.timer = setTimeout(() => {
        pending.count = 0;
        pending.timer = null;
      }, 500);
    },
  });
  return null;
}
function pinIcon(color, active) {
  return L.divIcon({
    className: "",
    iconSize: [32, 42],
    iconAnchor: [16, 40],
    html: `<span class="map-pin ${active ? "is-active" : ""}" style="--pin-color:${color}"><span></span></span>`,
  });
}

const landStyle = {
  fillColor: "#6f9c65",
  fillOpacity: 1,
  color: "#527b4c",
  weight: 1,
  opacity: 1,
};

let landPromise;
function loadLand() {
  if (!landPromise) {
    landPromise = fetch(`${import.meta.env.BASE_URL}land-110m.geojson`).then(
      (response) => response.json(),
    );
  }
  return landPromise;
}

function MapChrome({ plainMap }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().classList.toggle("is-plain", plainMap);
  }, [map, plainMap]);
  return null;
}

function PlainLand() {
  const [land, setLand] = useState(null);
  useEffect(() => {
    let active = true;
    loadLand()
      .then((data) => {
        if (active) setLand(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  if (!land) return null;
  return <GeoJSON data={land} style={landStyle} interactive={false} />;
}

function MapView({ pins, activeId, showMapCard, plainMap, onDrop, onSelect, onMove }) {
  return (
    <MapContainer
      center={[22, 8]}
      zoom={2}
      minZoom={2}
      className={`map${plainMap ? " is-plain" : ""}`}
      worldCopyJump
      doubleClickZoom={false}
      attributionControl={false}
    >
      <MapChrome plainMap={plainMap} />
      {plainMap ? (
        <PlainLand />
      ) : (
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      )}
      <PinDropper onDrop={onDrop} />
      {pins.map((pin) => (
        <Marker
          key={pin.id}
          position={[pin.lat, pin.lng]}
          icon={pinIcon(pin.color, pin.id === activeId)}
          draggable
          eventHandlers={{
            click: () => onSelect(pin.id),
            dragend: (event) => onMove(pin.id, event.target.getLatLng()),
          }}
        />
      ))}
      {showMapCard && (
        <LeaderCards pins={pins} activeId={activeId} onSelect={onSelect} />
      )}
    </MapContainer>
  );
}

function MapWorkspace() {
  const [pins, setPins] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [search, setSearch] = useState("");
  const [searchState, setSearchState] = useState("");
  const [showMapCard, setShowMapCard] = useState(false);
  const [plainMap, setPlainMap] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    getPins()
      .then((saved) => {
        setPins(saved);
        setActiveId(saved[0]?.id ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);
  useEffect(() => {
    if (loaded) persistPins(pins).catch(() => {});
  }, [pins, loaded]);

  const activePin = useMemo(
    () => pins.find((pin) => pin.id === activeId),
    [pins, activeId],
  );
  const addPin = (lat, lng, title) => {
    const newPin = blankPin(lat, lng, title);
    setPins((current) => [...current, newPin]);
    setActiveId(newPin.id);
  };
  const updatePin = (id, changes) =>
    setPins((current) =>
      current.map((pin) => (pin.id === id ? { ...pin, ...changes } : pin)),
    );
  const deletePin = () => {
    if (!activePin) return;
    setConfirmDelete(true);
  };
  const confirmDeletePin = () => {
    const next = pins.filter((pin) => pin.id !== activeId);
    setPins(next);
    setActiveId(next[0]?.id ?? null);
    setConfirmDelete(false);
  };
  const addByCoordinates = (event) => {
    event.preventDefault();
    const lat = Number(coords.lat),
      lng = Number(coords.lng);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      addPin(lat, lng);
      setCoords({ lat: "", lng: "" });
    }
  };
  const searchPlace = async (event) => {
    event.preventDefault();
    if (!search.trim()) return;
    setSearchState("Searching…");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(search)}`,
        { headers: { Accept: "application/json" } },
      );
      const [result] = await response.json();
      if (!result) {
        setSearchState("No location found");
        return;
      }
      addPin(
        Number(result.lat),
        Number(result.lon),
        result.display_name.split(",")[0],
      );
      setSearch("");
      setSearchState("Pin placed");
    } catch {
      setSearchState("Search unavailable");
    }
  };
  const uploadImage = (event) => {
    const file = event.target.files?.[0];
    if (!file || !activePin) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => updatePin(activePin.id, { image: reader.result });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand brand-button" href="#home">
          <span className="brand-mark">⌖</span>
          <span>pin atlas</span>
        </a>
        <div className="topbar-actions">
          <a className="nav-home" href="#home">
            Home
          </a>
          <a className="nav-home" href="#data">
            My Data
          </a>
          <div className="saved-state">
            <i></i>
            {loaded ? "Saved locally" : "Loading your pins…"}
          </div>
        </div>
      </header>
      <section className="workspace">
        <aside className="sidebar">
          <div className="side-heading">
            <p>YOUR PLACES</p>
            <span>{pins.length}</span>
          </div>
          <button className="add-button" onClick={() => addPin(20, 0)}>
            <b>+</b> Add a pin
          </button>
          <form className="place-search" onSubmit={searchPlace}>
            <label>Find a place</label>
            <div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Paris, France"
                aria-label="Search for a place"
              />
              <button type="submit" aria-label="Search">
                ⌕
              </button>
            </div>
            {searchState && <small>{searchState}</small>}
          </form>
          <form className="coordinate-form" onSubmit={addByCoordinates}>
            <label>Drop by coordinates</label>
            <div>
              <input
                aria-label="Latitude"
                type="number"
                step="any"
                placeholder="Latitude"
                value={coords.lat}
                onChange={(e) => setCoords({ ...coords, lat: e.target.value })}
              />
              <input
                aria-label="Longitude"
                type="number"
                step="any"
                placeholder="Longitude"
                value={coords.lng}
                onChange={(e) => setCoords({ ...coords, lng: e.target.value })}
              />
            </div>
            <button type="submit">Place pin</button>
          </form>
          <label className="map-card-toggle">
            <input
              type="checkbox"
              checked={plainMap}
              onChange={(event) => setPlainMap(event.target.checked)}
            />{" "}
            <span>Plain map</span>
          </label>
          <label className="map-card-toggle">
            <input
              type="checkbox"
              checked={showMapCard}
              onChange={(event) => setShowMapCard(event.target.checked)}
            />{" "}
            <span>Show all cards on map</span>
          </label>
          <p className="hint">
            Turn off “Plain map” to bring back streets and labels. Turn on
            “Show all cards” to place labels beside pins with matching coloured
            leader lines so nearby cards do not overlap. Search a city, click
            the map, or drag a pin to fine-tune it.
          </p>
          <div className="place-list">
            {pins.map((pin) => (
              <button
                key={pin.id}
                className={`place-row ${pin.id === activeId ? "selected" : ""}`}
                onClick={() => setActiveId(pin.id)}
              >
                <span style={{ background: pin.color }}></span>
                <div>
                  <strong>{pin.title || "Untitled place"}</strong>
                  <small>
                    {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
                  </small>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <section className={`map-area${plainMap ? " is-plain" : ""}`}>
          <MapView
            pins={pins}
            activeId={activeId}
            showMapCard={showMapCard}
            plainMap={plainMap}
            onDrop={({ lat, lng }) => addPin(lat, lng)}
            onSelect={setActiveId}
            onMove={(id, { lat, lng }) =>
              updatePin(id, {
                lat: Number(lat.toFixed(5)),
                lng: Number(lng.toFixed(5)),
              })
            }
          />
          <div className="map-tip">Triple-click to place a pin</div>
          {plainMap ? (
            <a
              className="map-credit"
              href="https://www.naturalearthdata.com/"
              target="_blank"
              rel="noreferrer"
            >
              Land: Natural Earth
            </a>
          ) : (
            <a
              className="map-credit"
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              © OpenStreetMap
            </a>
          )}
        </section>
        <aside className="details-panel">
          {activePin ? (
            <>
              <div className="editor-title">
                <div>
                  <p>LOCATION CARD</p>
                  <h1>{activePin.title || "Untitled place"}</h1>
                </div>
                <button
                  type="button"
                  className="delete"
                  onClick={deletePin}
                  aria-label="Delete selected pin"
                >
                  <TrashIcon />
                </button>
              </div>
              <label className="field-label">
                Heading
                <input
                  value={activePin.title}
                  onChange={(e) =>
                    updatePin(activePin.id, { title: e.target.value })
                  }
                  placeholder="Name this place"
                />
              </label>
              <label className="field-label">
                Image URL
                <input
                  value={
                    activePin.image.startsWith("data:")
                      ? "Image from your folder"
                      : activePin.image
                  }
                  onChange={(e) =>
                    updatePin(activePin.id, { image: e.target.value })
                  }
                  placeholder="https://…"
                />
              </label>
              <label className="upload-button">
                Choose image from folder
                <input type="file" accept="image/*" onChange={uploadImage} />
              </label>
              <div className="image-preview">
                {activePin.image ? (
                  <img src={activePin.image} alt="Location preview" />
                ) : (
                  <span>Use a link or select an image from your folder</span>
                )}
              </div>
              <label className="field-label">
                Description
                <textarea
                  rows="5"
                  value={activePin.description}
                  onChange={(e) =>
                    updatePin(activePin.id, { description: e.target.value })
                  }
                  placeholder="Tell the story of this place…"
                />
              </label>
              <div className="pin-settings">
                <label className="field-label">
                  Pin color
                  <input
                    className="color-input"
                    type="color"
                    value={activePin.color}
                    onChange={(e) =>
                      updatePin(activePin.id, { color: e.target.value })
                    }
                  />
                </label>
                <div>
                  <span>Coordinates</span>
                  <b>
                    {activePin.lat.toFixed(4)}, {activePin.lng.toFixed(4)}
                  </b>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-card">
              <div>⌖</div>
              <h1>Your map, your stories</h1>
              <p>
                Search, click the map, or add coordinates to create your first
                location card.
              </p>
            </div>
          )}
        </aside>
      </section>
      <ConfirmModal
        open={confirmDelete}
        title="Delete this place?"
        message={
          activePin
            ? `“${activePin.title || "Untitled place"}” will be removed from this device.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={confirmDeletePin}
        onCancel={() => setConfirmDelete(false)}
      />
    </main>
  );
}

export default function App() {
  const [page, setPage] = useState(getPageFromHash);

  useEffect(() => {
    const sync = () => setPage(getPageFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  if (page === "home") return <Home />;
  if (page === "data") return <MyData />;
  if (page === "dashboard") return <Dashboard />;
  return <MapWorkspace />;
}
