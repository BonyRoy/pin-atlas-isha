const DB_NAME = "pin-atlas";
const STORE_NAME = "pins";
const CATALOG_STORE = "catalog";
const CATALOG_KEY = "dashboard";
const DB_VERSION = 2;

export function emptyCatalog() {
  return {
    packages: [],
    equipment: [],
    vendors: [],
    packageVendors: [],
    locations: [],
    sites: [],
    countries: [],
  };
}

export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME))
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CATALOG_STORE))
        db.createObjectStore(CATALOG_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getPins() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function persistPins(pins) {
  const db = await openDatabase();
  const transaction = db.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);
  store.clear();
  pins.forEach((pin) => store.put(pin));
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getCatalog() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction(CATALOG_STORE, "readonly")
      .objectStore(CATALOG_STORE)
      .get(CATALOG_KEY);
    request.onsuccess = () => {
      const row = request.result;
      if (!row) {
        resolve(emptyCatalog());
        return;
      }
      const { id: _id, ...catalog } = row;
      resolve({ ...emptyCatalog(), ...catalog });
    };
    request.onerror = () => reject(request.error);
  });
}

export async function persistCatalog(catalog) {
  const db = await openDatabase();
  const transaction = db.transaction(CATALOG_STORE, "readwrite");
  const store = transaction.objectStore(CATALOG_STORE);
  store.put({ id: CATALOG_KEY, ...catalog });
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export function pinsToJson(pins) {
  return JSON.stringify(
    pins.map((pin) => ({
      id: pin.id,
      title: pin.title || "Untitled place",
      description: pin.description || "",
      color: pin.color,
      lat: pin.lat,
      lng: pin.lng,
      image: pin.image || "",
    })),
    null,
    2,
  );
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function pinsToCsv(pins) {
  const header = ["title", "lat", "lng", "color", "description"];
  const rows = pins.map((pin) =>
    [
      pin.title || "Untitled place",
      pin.lat,
      pin.lng,
      pin.color,
      pin.description || "",
    ].map(csvCell),
  );
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

function importedId(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return crypto.randomUUID();
}

function normalizeImportedPin(row) {
  if (!row || typeof row !== "object") return null;
  const lat = Number(row.lat ?? row.latitude);
  const lng = Number(row.lng ?? row.lon ?? row.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  const color = /^#[0-9a-fA-F]{6}$/.test(String(row.color || ""))
    ? String(row.color)
    : "#ef5b3f";
  return {
    id: importedId(row.id),
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
    title: String(row.title || row.name || "Untitled place"),
    image: typeof row.image === "string" ? row.image : "",
    description: String(row.description || row.note || ""),
    color,
  };
}

export function pinsFromJson(text) {
  const parsed = JSON.parse(text);
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.pins)
      ? parsed.pins
      : parsed && typeof parsed === "object"
        ? [parsed]
        : null;
  if (!rows) throw new Error("JSON must be a list of places");
  return rows.map(normalizeImportedPin).filter(Boolean);
}

function parseCsv(text) {
  const source = String(text)
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

export function pinsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const hasHeader = header.includes("lat") || header.includes("latitude");
  const body = hasHeader ? rows.slice(1) : rows;
  const column = (...names) => {
    for (const name of names) {
      const index = header.indexOf(name);
      if (index !== -1) return index;
    }
    return -1;
  };
  const titleIndex = hasHeader ? column("title", "name") : 0;
  const latIndex = hasHeader ? column("lat", "latitude") : 1;
  const lngIndex = hasHeader ? column("lng", "lon", "longitude") : 2;
  const colorIndex = hasHeader ? column("color") : 3;
  const descriptionIndex = hasHeader ? column("description", "note") : 4;
  const cellAt = (cells, index) => (index >= 0 ? cells[index] : "");
  return body
    .map((cells) =>
      normalizeImportedPin({
        title: cellAt(cells, titleIndex),
        lat: cellAt(cells, latIndex),
        lng: cellAt(cells, lngIndex),
        color: cellAt(cells, colorIndex),
        description: cellAt(cells, descriptionIndex),
      }),
    )
    .filter(Boolean);
}
