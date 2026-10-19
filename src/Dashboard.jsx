import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import {
  downloadDashboardExcel,
  equipmentForPackage,
  loadDashboardFromFile,
  locationsForVendor,
  nextId,
  normalizeCatalog,
  packagesForCountry,
  vendorsForPackage,
  withLocationFlags,
} from "./dashboardData";
import ConfirmModal, { TrashIcon } from "./ConfirmModal";
import {
  emptyCatalog,
  getCatalog,
  getPins,
  persistCatalog,
} from "./db";

const FACTORY_COLOR = "#1f3a5f";
const PARTNER_COLOR = "#c45c26";

function markerIcon(entityType, active) {
  const isFactory = /manufactur|factory/i.test(entityType);
  const color = isFactory ? FACTORY_COLOR : PARTNER_COLOR;
  return L.divIcon({
    className: "",
    iconSize: [32, 42],
    iconAnchor: [16, 40],
    html: `<span class="map-pin ${active ? "is-active" : ""}" style="--pin-color:${color}"><span></span></span>`,
  });
}

function FitLocations({ locations }) {
  const map = useMap();
  useEffect(() => {
    const plottable = locations.filter((loc) => loc.plottable);
    if (!plottable.length) return;
    if (plottable.length === 1) {
      map.setView([plottable[0].lat, plottable[0].lng], 6, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(
      plottable.map((loc) => [loc.lat, loc.lng]),
    );
    map.fitBounds(bounds.pad(0.35), { animate: true });
  }, [locations, map]);
  return null;
}

function StepPill({ label, value, active, onClear }) {
  return (
    <div className={`dash-step ${active ? "is-active" : ""}`}>
      <span>{label}</span>
      <strong>{value || "—"}</strong>
      {value && onClear ? (
        <button type="button" onClick={onClear} aria-label={`Clear ${label}`}>
          ×
        </button>
      ) : null}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="dash-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [pins, setPins] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [country, setCountry] = useState("");
  const [newCountry, setNewCountry] = useState("");
  const [packageId, setPackageId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    Promise.all([getCatalog(), getPins()])
      .then(([catalog, savedPins]) => {
        const normalized = normalizeCatalog(catalog || emptyCatalog());
        setData(normalized);
        setPins(savedPins || []);
        setCountry(normalized.countries[0] || "");
        setLoaded(true);
      })
      .catch(() => {
        setError("Could not read local IndexedDB catalog.");
        setData(emptyCatalog());
        setLoaded(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    persistCatalog(data).catch(() => {});
  }, [data, loaded]);

  const packages = useMemo(
    () => (data ? packagesForCountry(data, country) : []),
    [data, country],
  );
  const selectedPackage =
    data?.packages.find((pkg) => pkg.id === packageId) || null;
  const equipment = useMemo(
    () => (data && packageId ? equipmentForPackage(data, packageId) : []),
    [data, packageId],
  );
  const vendors = useMemo(
    () => (data ? vendorsForPackage(data, country, packageId) : []),
    [data, country, packageId],
  );
  const selectedVendor =
    data?.vendors.find((vendor) => vendor.id === vendorId) || null;
  const vendorSummary = vendors.find((vendor) => vendor.id === vendorId) || null;
  const locations = useMemo(
    () =>
      data && vendorId ? locationsForVendor(data, vendorId, country) : [],
    [data, vendorId, country],
  );
  const selectedLocation =
    locations.find((loc) => loc.id === selectedLocationId) || null;
  const plottable = locations.filter((loc) => loc.plottable);
  const unverified = locations.filter((loc) => !loc.plottable);

  const packageVendorRows = useMemo(() => {
    if (!data || !packageId || !vendorId || !country) return [];
    return data.packageVendors.filter(
      (row) =>
        row.country === country &&
        row.packageId === packageId &&
        row.vendorId === vendorId,
    );
  }, [data, packageId, vendorId, country]);

  const flash = (message) => {
    setStatus(message);
    setTimeout(() => setStatus(""), 2200);
  };

  const patchData = (updater) => {
    setData((current) => {
      if (!current) return current;
      return normalizeCatalog(updater(current));
    });
  };

  const updatePackage = (changes) => {
    if (!packageId) return;
    patchData((current) => ({
      ...current,
      packages: current.packages.map((pkg) =>
        pkg.id === packageId ? { ...pkg, ...changes } : pkg,
      ),
    }));
  };

  const updateEquipment = (equipmentId, changes) => {
    patchData((current) => ({
      ...current,
      equipment: current.equipment.map((item) =>
        item.id === equipmentId ? { ...item, ...changes } : item,
      ),
    }));
  };

  const updateVendor = (changes) => {
    if (!vendorId) return;
    patchData((current) => ({
      ...current,
      vendors: current.vendors.map((vendor) =>
        vendor.id === vendorId ? { ...vendor, ...changes } : vendor,
      ),
    }));
  };

  const updatePackageVendorRow = (index, changes) => {
    const target = packageVendorRows[index];
    if (!target) return;
    patchData((current) => {
      let seen = 0;
      return {
        ...current,
        packageVendors: current.packageVendors.map((row) => {
          const sameLink =
            row.country === target.country &&
            row.packageId === target.packageId &&
            row.vendorId === target.vendorId &&
            row.equipmentId === target.equipmentId;
          if (!sameLink) return row;
          const matchIndex = seen;
          seen += 1;
          return matchIndex === index ? { ...row, ...changes } : row;
        }),
      };
    });
  };

  const updateLocation = (changes) => {
    if (!selectedLocationId) return;
    patchData((current) => ({
      ...current,
      locations: current.locations.map((loc) =>
        loc.id === selectedLocationId
          ? withLocationFlags({ ...loc, ...changes })
          : loc,
      ),
    }));
  };

  const selectCountry = (next) => {
    setCountry(next);
    setPackageId("");
    setVendorId("");
    setSelectedLocationId(null);
  };
  const selectPackage = (id) => {
    setPackageId(id);
    setVendorId("");
    setSelectedLocationId(null);
  };
  const selectVendor = (id) => {
    setVendorId(id);
    setSelectedLocationId(null);
  };

  const addCountry = (event) => {
    event.preventDefault();
    const name = newCountry.trim();
    if (!name) return;
    patchData((current) => ({
      ...current,
      countries: [...new Set([...(current.countries || []), name])],
    }));
    setNewCountry("");
    selectCountry(name);
    flash(`Country “${name}” ready`);
  };

  const replaceExcel = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = await loadDashboardFromFile(file);
      setData(parsed);
      setCountry(parsed.countries[0] || "");
      setPackageId("");
      setVendorId("");
      setSelectedLocationId(null);
      setError("");
      flash(`Imported ${file.name} into local storage`);
    } catch {
      setError("Could not read that Excel file. Check sheet names and columns.");
    }
  };

  const exportExcel = () => {
    if (!data) return;
    downloadDashboardExcel(data, "vendor-packages.xlsx");
    flash("Excel downloaded");
  };

  const ask = (next) => setConfirm(next);

  const clearAll = () => {
    ask({
      title: "Clear the catalog?",
      message:
        "All packages, vendors, and locations will be removed from local storage.",
      confirmLabel: "Clear",
      run: () => {
        setData(emptyCatalog());
        setCountry("");
        setPackageId("");
        setVendorId("");
        setSelectedLocationId(null);
        flash("Catalog cleared");
      },
    });
  };

  const addPackage = () => {
    if (!data) return;
    if (!country) {
      flash("Add a country first");
      return;
    }
    const id = nextId(
      "PKG",
      data.packages.map((pkg) => pkg.id),
    );
    const equipmentId = nextId(
      "EQ",
      data.equipment.map((item) => item.id),
    );
    const sortOrder =
      Math.max(0, ...data.packages.map((pkg) => pkg.sortOrder || 0)) + 1;
    patchData((current) => ({
      ...current,
      packages: [
        ...current.packages,
        {
          id,
          name: "New package",
          color: "#3d5333",
          sortOrder,
          description: "",
        },
      ],
      equipment: [
        ...current.equipment,
        { id: equipmentId, packageId: id, name: "New equipment" },
      ],
    }));
    setPackageId(id);
    setVendorId("");
    setSelectedLocationId(null);
    flash("Package added — saved locally");
  };

  const deletePackage = () => {
    if (!packageId) return;
    const id = packageId;
    const name = selectedPackage?.name || "This package";
    ask({
      title: "Delete this package?",
      message: `${name} and its equipment links will be removed.`,
      confirmLabel: "Delete",
      run: () => {
        patchData((current) => ({
          ...current,
          packages: current.packages.filter((pkg) => pkg.id !== id),
          equipment: current.equipment.filter((item) => item.packageId !== id),
          packageVendors: current.packageVendors.filter(
            (row) => row.packageId !== id,
          ),
        }));
        setPackageId("");
        setVendorId("");
        setSelectedLocationId(null);
        flash("Package deleted");
      },
    });
  };

  const addEquipment = () => {
    if (!data || !packageId) return;
    const id = nextId(
      "EQ",
      data.equipment.map((item) => item.id),
    );
    patchData((current) => ({
      ...current,
      equipment: [
        ...current.equipment,
        { id, packageId, name: "New equipment" },
      ],
    }));
    flash("Equipment row added");
  };

  const deleteEquipment = (equipmentId) => {
    const name =
      data?.equipment.find((item) => item.id === equipmentId)?.name ||
      "This equipment row";
    ask({
      title: "Delete this equipment?",
      message: `${name} will be removed from the package.`,
      confirmLabel: "Delete",
      run: () => {
        patchData((current) => ({
          ...current,
          equipment: current.equipment.filter((item) => item.id !== equipmentId),
          packageVendors: current.packageVendors.filter(
            (row) => row.equipmentId !== equipmentId,
          ),
        }));
        flash("Equipment deleted");
      },
    });
  };

  const addVendorLink = () => {
    if (!data || !packageId || !country) return;
    let createdVendorId = "";
    let createdName = "";
    patchData((current) => {
      const linkedIds = new Set(
        current.packageVendors
          .filter(
            (row) => row.country === country && row.packageId === packageId,
          )
          .map((row) => row.vendorId),
      );
      const unused = current.vendors.find((vendor) => !linkedIds.has(vendor.id));
      let vendors = current.vendors;
      let vendor = unused;
      if (!vendor) {
        const id = nextId(
          "V",
          current.vendors.map((item) => item.id),
        );
        vendor = { id, name: "New vendor" };
        vendors = [...current.vendors, vendor];
      }
      createdVendorId = vendor.id;
      createdName = vendor.name;
      const packageEquipment = current.equipment.filter(
        (item) => item.packageId === packageId,
      );
      let equipmentRows = current.equipment;
      let equipmentId = packageEquipment[0]?.id;
      if (!equipmentId) {
        equipmentId = nextId(
          "EQ",
          current.equipment.map((item) => item.id),
        );
        equipmentRows = [
          ...current.equipment,
          { id: equipmentId, packageId, name: "New equipment" },
        ];
      }
      return {
        ...current,
        vendors,
        equipment: equipmentRows,
        packageVendors: [
          ...current.packageVendors,
          {
            country,
            packageId,
            vendorId: vendor.id,
            equipmentId,
            leadTime: "",
            cityFocus: "",
          },
        ],
      };
    });
    if (createdVendorId) setVendorId(createdVendorId);
    setSelectedLocationId(null);
    flash(`Linked ${createdName || "vendor"}`);
  };

  const deleteVendor = () => {
    if (!vendorId) return;
    const id = vendorId;
    const name = selectedVendor?.name || "This vendor";
    ask({
      title: "Delete this vendor?",
      message: `${name}, its package links, and its locations will be removed.`,
      confirmLabel: "Delete",
      run: () => {
        patchData((current) => ({
          ...current,
          vendors: current.vendors.filter((vendor) => vendor.id !== id),
          packageVendors: current.packageVendors.filter(
            (row) => row.vendorId !== id,
          ),
          locations: current.locations.filter((loc) => loc.vendorId !== id),
        }));
        setVendorId("");
        setSelectedLocationId(null);
        flash("Vendor deleted");
      },
    });
  };

  const unlinkVendor = () => {
    if (!vendorId || !packageId || !country) return;
    const name = selectedVendor?.name || "This vendor";
    ask({
      title: "Unlink this vendor?",
      message: `${name} stays in the catalog, and is removed from ${selectedPackage?.name || "this package"} in ${country} only.`,
      confirmLabel: "Unlink",
      run: () => {
        patchData((current) => ({
          ...current,
          packageVendors: current.packageVendors.filter(
            (row) =>
              !(
                row.country === country &&
                row.packageId === packageId &&
                row.vendorId === vendorId
              ),
          ),
        }));
        setVendorId("");
        setSelectedLocationId(null);
        flash("Vendor unlinked from package");
      },
    });
  };

  const addLocation = (fromPin) => {
    if (!data || !vendorId || !country) return;
    const id = nextId(
      "L",
      data.locations.map((loc) => loc.id),
    );
    const location = withLocationFlags({
      id,
      vendorId,
      name: fromPin?.title || "New location",
      address: "",
      city: "",
      country,
      lat: fromPin ? Number(fromPin.lat) : null,
      lng: fromPin ? Number(fromPin.lng) : null,
      entityType: "Local Partner",
      verified: fromPin ? "yes" : "no",
      notes: fromPin
        ? `Linked from My Data pin ${fromPin.id}`
        : "Add coordinates and set verified to yes before it appears on the map",
      pinId: fromPin?.id || "",
    });
    patchData((current) => ({
      ...current,
      locations: [...current.locations, location],
    }));
    setSelectedLocationId(id);
    flash(fromPin ? "Location added from My Data" : "Location added");
  };

  const deleteLocation = () => {
    if (!selectedLocationId) return;
    const id = selectedLocationId;
    const name = selectedLocation?.name || "This location";
    ask({
      title: "Delete this location?",
      message: `${name} will be removed from the vendor map.`,
      confirmLabel: "Delete",
      run: () => {
        patchData((current) => ({
          ...current,
          locations: current.locations.filter((loc) => loc.id !== id),
        }));
        setSelectedLocationId(null);
        flash("Location deleted");
      },
    });
  };

  const editorMode = selectedLocation
    ? "location"
    : selectedVendor
      ? "vendor"
      : selectedPackage
        ? "package"
        : null;

  const isEmpty =
    data &&
    !data.packages.length &&
    !data.vendors.length &&
    !data.locations.length;

  return (
    <main className="dash-shell">
      <header className="home-topbar">
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
          <button
            type="button"
            className="nav-home"
            onClick={exportExcel}
            disabled={!data}
          >
            Export Excel
          </button>
          <label className="nav-home dash-upload">
            Import Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={replaceExcel}
            />
          </label>
          <button type="button" className="nav-home" onClick={clearAll}>
            Clear
          </button>
        </div>
      </header>

      <section className="dash-page">
        <div className="dash-heading">
          <div>
            <p>EQUIPMENT PACKAGE & VENDOR MAPPING</p>
            <h1>Dashboard</h1>
            <span>
              Starts empty. Everything saves in the same IndexedDB as My Data.
              Add packages and vendors yourself, or import an Excel file.
            </span>
          </div>
          <div className="saved-state">
            <i></i>
            {loaded ? "Saved locally" : "Loading…"}
          </div>
        </div>
        {status && <p className="data-status">{status}</p>}
        {error && <p className="dash-error">{error}</p>}
        {!data && !error && <p className="data-empty-copy">Loading local catalog…</p>}

        {data && (
          <>
            <div className="dash-flow">
              <StepPill
                label="1. Country"
                value={country}
                active={!packageId}
              />
              <StepPill
                label="2. Package"
                value={selectedPackage?.name}
                active={!!packageId && !vendorId}
                onClear={() => selectPackage("")}
              />
              <StepPill
                label="3. Vendor"
                value={selectedVendor?.name}
                active={!!vendorId && !selectedLocationId}
                onClear={() => selectVendor("")}
              />
              <StepPill
                label="4. Map"
                value={
                  vendorId
                    ? `${plottable.length} plotted · ${unverified.length} held back`
                    : ""
                }
                active={!!vendorId}
              />
            </div>

            <div className="dash-toolbar">
              <div className="dash-country-tools">
                <label>
                  Market / Country
                  <select
                    value={country}
                    onChange={(event) => selectCountry(event.target.value)}
                  >
                    <option value="">Select country</option>
                    {data.countries.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <form className="dash-add-country" onSubmit={addCountry}>
                  <input
                    value={newCountry}
                    onChange={(e) => setNewCountry(e.target.value)}
                    placeholder="Add country"
                    aria-label="Add country"
                  />
                  <button type="submit">Add</button>
                </form>
              </div>
              <div className="dash-legend">
                <span>
                  <i
                    className="is-partner"
                    style={{ background: FACTORY_COLOR }}
                  ></i>{" "}
                  Manufacturing / Factory
                </span>
                <span>
                  <i
                    className="is-partner"
                    style={{ background: PARTNER_COLOR }}
                  ></i>{" "}
                  Local Partner
                </span>
              </div>
            </div>

            {isEmpty && (
              <div className="dash-empty-banner">
                <strong>No catalog data yet.</strong>
                <span>
                  Add a country, then packages and vendors — or import Excel.
                  Location pins can also be pulled from My Data ({pins.length}{" "}
                  saved).
                </span>
              </div>
            )}

            <div className="dash-layout">
              <aside className="dash-panel">
                <div className="side-heading">
                  <p>PACKAGES</p>
                  <span>{packages.length}</span>
                </div>
                <button
                  type="button"
                  className="add-button dash-add"
                  onClick={addPackage}
                  disabled={!country}
                >
                  <b>+</b> Add package
                </button>
                <div className="dash-package-list">
                  {packages.map((pkg) => (
                    <button
                      type="button"
                      key={pkg.id}
                      className={`dash-package ${pkg.id === packageId ? "selected" : ""}`}
                      onClick={() => selectPackage(pkg.id)}
                    >
                      <i style={{ background: pkg.color }}></i>
                      <div>
                        <strong>{pkg.name}</strong>
                        <small>{pkg.description || pkg.id}</small>
                      </div>
                    </button>
                  ))}
                  {!packages.length && (
                    <p className="dash-muted">
                      {country
                        ? "No packages yet. Click Add package."
                        : "Add a country first."}
                    </p>
                  )}
                </div>
              </aside>

              <aside className="dash-panel">
                <div className="side-heading">
                  <p>VENDORS</p>
                  <span>{vendors.length}</span>
                </div>
                {!packageId ? (
                  <p className="dash-muted">
                    Select a package to manage vendors.
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      className="add-button dash-add"
                      onClick={addVendorLink}
                    >
                      <b>+</b> Add / link vendor
                    </button>
                    <div className="dash-vendor-list">
                      {vendors.map((vendor) => (
                        <button
                          type="button"
                          key={vendor.id}
                          className={`dash-vendor ${vendor.id === vendorId ? "selected" : ""}`}
                          onClick={() => selectVendor(vendor.id)}
                        >
                          <strong>{vendor.name}</strong>
                          <small>
                            {vendor.supplies.join(" · ") || "Equipment supplier"}
                          </small>
                          <em>
                            {vendor.cities.length
                              ? vendor.cities.join(", ")
                              : country}
                            {vendor.leadTimes[0]
                              ? ` · ${vendor.leadTimes[0]}`
                              : ""}
                          </em>
                        </button>
                      ))}
                      {!vendors.length && (
                        <p className="dash-muted">
                          No vendors linked. Use Add / link vendor.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </aside>

              <section className="dash-map-panel">
                {!vendorId ? (
                  <div className="dash-map-empty">
                    <h2>Vendor map</h2>
                    <p>
                      Choose a vendor to plot factory and partner locations with
                      the same pin style as Maps.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="dash-map-meta">
                      <div>
                        <p>VENDOR FOOTPRINT</p>
                        <h2>{selectedVendor?.name}</h2>
                      </div>
                      <div className="dash-map-meta-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => addLocation()}
                        >
                          + Add location
                        </button>
                        <small>
                          {plottable.length} plotted · {unverified.length} held
                          back · {pins.length} My Data pins
                        </small>
                      </div>
                    </div>
                    <div className="dash-map-wrap">
                      <MapContainer
                        key={vendorId}
                        center={[20.5, 78.5]}
                        zoom={5}
                        minZoom={2}
                        className="dash-map"
                        worldCopyJump
                        attributionControl={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <FitLocations locations={locations} />
                        {plottable.map((loc) => (
                          <Marker
                            key={loc.id}
                            position={[loc.lat, loc.lng]}
                            icon={markerIcon(
                              loc.entityType,
                              loc.id === selectedLocationId,
                            )}
                            eventHandlers={{
                              click: () => setSelectedLocationId(loc.id),
                            }}
                          >
                            <Popup>
                              <strong>{loc.name}</strong>
                              <br />
                              {loc.entityType}
                              <br />
                              {[loc.address, loc.city, loc.country]
                                .filter(Boolean)
                                .join(", ")}
                            </Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                      <a
                        className="map-credit"
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noreferrer"
                      >
                        © OpenStreetMap
                      </a>
                    </div>

                    <div className="dash-location-lists">
                      <div>
                        <p>ON MAP</p>
                        {plottable.map((loc) => (
                          <button
                            type="button"
                            key={loc.id}
                            className={`dash-loc-row ${loc.id === selectedLocationId ? "selected" : ""}`}
                            onClick={() => setSelectedLocationId(loc.id)}
                          >
                            <i className="partner" style={{ background: /manufactur|factory/i.test(loc.entityType) ? FACTORY_COLOR : PARTNER_COLOR }}></i>
                            <div>
                              <strong>{loc.name}</strong>
                              <small>
                                {loc.entityType} · {loc.city || loc.country}
                              </small>
                            </div>
                          </button>
                        ))}
                        {!plottable.length && (
                          <p className="dash-muted">No plottable locations yet.</p>
                        )}
                      </div>
                      <div>
                        <p>HELD BACK</p>
                        {unverified.map((loc) => (
                          <button
                            type="button"
                            key={loc.id}
                            className={`dash-loc-row is-warn ${loc.id === selectedLocationId ? "selected" : ""}`}
                            onClick={() => setSelectedLocationId(loc.id)}
                          >
                            <i className="warn"></i>
                            <div>
                              <strong>{loc.name}</strong>
                              <small>
                                {loc.hasCoords
                                  ? `Unverified (${loc.verified})`
                                  : "Missing lat/lng"}
                              </small>
                            </div>
                          </button>
                        ))}
                        {!unverified.length && (
                          <p className="dash-muted">Nothing held back.</p>
                        )}
                      </div>
                    </div>

                    {!!pins.length && (
                      <div className="dash-mydata-pins">
                        <p>ADD FROM MY DATA</p>
                        <div className="dash-pin-pick">
                          {pins.map((pin) => (
                            <button
                              type="button"
                              key={pin.id}
                              className="ghost-button"
                              onClick={() => addLocation(pin)}
                            >
                              {pin.title || "Untitled"} ({Number(pin.lat).toFixed(2)},{" "}
                              {Number(pin.lng).toFixed(2)})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>

              <aside className="dash-panel dash-editor">
                <div className="side-heading">
                  <p>EDIT SELECTED</p>
                  <span>{editorMode ? "live" : "—"}</span>
                </div>

                {!editorMode && (
                  <p className="dash-muted">
                    Select a package, vendor, or location to edit or delete it.
                  </p>
                )}

                {editorMode === "package" && selectedPackage && (
                  <div className="dash-editor-fields">
                    <div className="dash-editor-title-row">
                      <p className="dash-editor-kicker">Package</p>
                      <button
                        type="button"
                        className="delete"
                        onClick={deletePackage}
                        aria-label="Delete package"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                    <Field label="Name">
                      <input
                        value={selectedPackage.name}
                        onChange={(e) => updatePackage({ name: e.target.value })}
                      />
                    </Field>
                    <Field label="Color">
                      <input
                        className="color-input"
                        type="color"
                        value={selectedPackage.color || "#3d5333"}
                        onChange={(e) => updatePackage({ color: e.target.value })}
                      />
                    </Field>
                    <Field label="Description">
                      <textarea
                        rows="3"
                        value={selectedPackage.description}
                        onChange={(e) =>
                          updatePackage({ description: e.target.value })
                        }
                      />
                    </Field>
                    <div className="dash-inline-head">
                      <p className="dash-editor-kicker">Equipment</p>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={addEquipment}
                      >
                        + Add
                      </button>
                    </div>
                    {equipment.map((item) => (
                      <div key={item.id} className="dash-equip-row">
                        <Field label={item.id}>
                          <input
                            value={item.name}
                            onChange={(e) =>
                              updateEquipment(item.id, { name: e.target.value })
                            }
                          />
                        </Field>
                        <button
                          type="button"
                          className="delete"
                          onClick={() => deleteEquipment(item.id)}
                          aria-label={`Delete ${item.name || "equipment"}`}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {editorMode === "vendor" && selectedVendor && (
                  <div className="dash-editor-fields">
                    <div className="dash-editor-title-row">
                      <p className="dash-editor-kicker">Vendor</p>
                      <div className="dash-editor-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={unlinkVendor}
                        >
                          Unlink
                        </button>
                        <button
                          type="button"
                          className="delete"
                          onClick={deleteVendor}
                          aria-label="Delete vendor"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    <Field label="Name">
                      <input
                        value={selectedVendor.name}
                        onChange={(e) => updateVendor({ name: e.target.value })}
                      />
                    </Field>
                    {vendorSummary && (
                      <p className="dash-muted">
                        Supplies: {vendorSummary.supplies.join(", ") || "—"}
                      </p>
                    )}
                    <p className="dash-editor-kicker">
                      Package link · {country} / {selectedPackage?.name}
                    </p>
                    {packageVendorRows.map((row, index) => {
                      const eq = data.equipment.find(
                        (item) => item.id === row.equipmentId,
                      );
                      return (
                        <div
                          key={`${row.equipmentId}-${index}`}
                          className="dash-link-edit"
                        >
                          <strong>{eq?.name || row.equipmentId || "Equipment"}</strong>
                          <Field label="Lead time">
                            <input
                              value={row.leadTime}
                              onChange={(e) =>
                                updatePackageVendorRow(index, {
                                  leadTime: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="City focus">
                            <input
                              value={row.cityFocus}
                              onChange={(e) =>
                                updatePackageVendorRow(index, {
                                  cityFocus: e.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>
                      );
                    })}
                  </div>
                )}

                {editorMode === "location" && selectedLocation && (
                  <div className="dash-editor-fields">
                    <div className="dash-editor-title-row">
                      <p className="dash-editor-kicker">Location</p>
                      <div className="dash-editor-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setSelectedLocationId(null)}
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          className="delete"
                          onClick={deleteLocation}
                          aria-label="Delete location"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                    <Field label="Name">
                      <input
                        value={selectedLocation.name}
                        onChange={(e) => updateLocation({ name: e.target.value })}
                      />
                    </Field>
                    <Field label="Entity type">
                      <select
                        value={selectedLocation.entityType}
                        onChange={(e) =>
                          updateLocation({ entityType: e.target.value })
                        }
                      >
                        <option>Manufacturing</option>
                        <option>Local Partner</option>
                      </select>
                    </Field>
                    <Field label="Address">
                      <input
                        value={selectedLocation.address}
                        onChange={(e) =>
                          updateLocation({ address: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="City">
                      <input
                        value={selectedLocation.city}
                        onChange={(e) => updateLocation({ city: e.target.value })}
                      />
                    </Field>
                    <Field label="Country">
                      <input
                        value={selectedLocation.country}
                        onChange={(e) =>
                          updateLocation({ country: e.target.value })
                        }
                      />
                    </Field>
                    <div className="dash-coord-row">
                      <Field label="Latitude">
                        <input
                          type="number"
                          step="any"
                          value={selectedLocation.lat ?? ""}
                          onChange={(e) =>
                            updateLocation({
                              lat:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                      <Field label="Longitude">
                        <input
                          type="number"
                          step="any"
                          value={selectedLocation.lng ?? ""}
                          onChange={(e) =>
                            updateLocation({
                              lng:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Verified">
                      <select
                        value={selectedLocation.verified}
                        onChange={(e) =>
                          updateLocation({ verified: e.target.value })
                        }
                      >
                        <option value="yes">yes</option>
                        <option value="partial">partial</option>
                        <option value="no">no</option>
                      </select>
                    </Field>
                    <Field label="Notes">
                      <textarea
                        rows="3"
                        value={selectedLocation.notes}
                        onChange={(e) =>
                          updateLocation({ notes: e.target.value })
                        }
                      />
                    </Field>
                    {!selectedLocation.plottable && (
                      <p className="dash-warn">
                        Held back until coordinates exist and verified is not
                        “no”.
                      </p>
                    )}
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </section>
      <ConfirmModal
        open={!!confirm}
        title={confirm?.title || ""}
        message={confirm?.message || ""}
        confirmLabel={confirm?.confirmLabel || "Confirm"}
        onConfirm={() => {
          const action = confirm?.run;
          setConfirm(null);
          action?.();
        }}
        onCancel={() => setConfirm(null)}
      />
    </main>
  );
}
