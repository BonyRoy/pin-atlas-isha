import * as XLSX from "xlsx";

function sheetRows(workbook, name) {
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function text(value) {
  return String(value ?? "").trim();
}

function num(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseWorkbook(workbook) {
  const packages = sheetRows(workbook, "Packages")
    .map((row) => ({
      id: text(row.package_id),
      name: text(row.name),
      color: text(row.color) || "#3d5333",
      sortOrder: Number(row.sort_order) || 0,
      description: text(row.description),
    }))
    .filter((row) => row.id)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const equipment = sheetRows(workbook, "Equipment")
    .map((row) => ({
      id: text(row.equipment_id),
      packageId: text(row.package_id),
      name: text(row.name),
    }))
    .filter((row) => row.id && row.packageId);

  const vendors = sheetRows(workbook, "Vendors")
    .map((row) => ({
      id: text(row.vendor_id),
      name: text(row.name),
    }))
    .filter((row) => row.id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const packageVendors = sheetRows(workbook, "PackageVendors")
    .map((row) => ({
      country: text(row.country),
      packageId: text(row.package_id),
      vendorId: text(row.vendor_id),
      equipmentId: text(row.equipment_id),
      leadTime: text(row.lead_time),
      cityFocus: text(row.city_focus),
    }))
    .filter((row) => row.country && row.packageId && row.vendorId);

  const locations = sheetRows(workbook, "Locations")
    .map((row) => {
      const lat = num(row.lat);
      const lng = num(row.lng);
      const verified = text(row.verified).toLowerCase() || "no";
      const hasCoords = lat != null && lng != null;
      return {
        id: text(row.location_id),
        vendorId: text(row.vendor_id),
        name: text(row.name),
        address: text(row.address),
        city: text(row.city),
        country: text(row.country),
        lat,
        lng,
        entityType: text(row.entity_type) || "Local Partner",
        verified,
        notes: text(row.notes),
        hasCoords,
        plottable: hasCoords && verified !== "no",
      };
    })
    .filter((row) => row.id && row.vendorId);

  const sites = sheetRows(workbook, "Sites")
    .map((row) => ({
      id: text(row.site_id),
      name: text(row.name),
      city: text(row.city),
      country: text(row.country),
      lat: num(row.lat),
      lng: num(row.lng),
      role: text(row.role),
    }))
    .filter((row) => row.id);

  return normalizeCatalog({
    packages,
    equipment,
    vendors,
    packageVendors,
    locations,
    sites,
  });
}

export function withLocationFlags(location) {
  const lat = num(location.lat);
  const lng = num(location.lng);
  const verified = text(location.verified).toLowerCase() || "no";
  const hasCoords = lat != null && lng != null;
  return {
    ...location,
    lat,
    lng,
    verified,
    hasCoords,
    plottable: hasCoords && verified !== "no",
  };
}

export function normalizeCatalog(catalog) {
  const packages = [...(catalog.packages || [])].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name),
  );
  const vendors = [...(catalog.vendors || [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const packageVendors = catalog.packageVendors || [];
  const countries = [
    ...new Set(
      [
        ...packageVendors.map((row) => row.country),
        ...(catalog.countries || []),
        ...(catalog.locations || []).map((row) => row.country),
      ].filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    packages,
    equipment: catalog.equipment || [],
    vendors,
    packageVendors,
    locations: (catalog.locations || []).map(withLocationFlags),
    sites: catalog.sites || [],
    countries,
  };
}

export async function loadDashboardFromFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  return parseWorkbook(workbook);
}

/** Kept for older HMR bundles; dashboard now loads from IndexedDB. */
export async function loadDashboardFromUrl() {
  return normalizeCatalog({
    packages: [],
    equipment: [],
    vendors: [],
    packageVendors: [],
    locations: [],
    sites: [],
  });
}

export function packagesForCountry(data, country) {
  if (!country) return data.packages;
  const linkedIds = new Set(
    data.packageVendors
      .filter((row) => row.country === country)
      .map((row) => row.packageId),
  );
  const linkedAnywhere = new Set(
    data.packageVendors.map((row) => row.packageId),
  );
  // Show country-linked packages, plus brand-new packages not linked yet.
  return data.packages.filter(
    (pkg) => linkedIds.has(pkg.id) || !linkedAnywhere.has(pkg.id),
  );
}

export function nextId(prefix, existingIds) {
  let max = 0;
  for (const id of existingIds) {
    const match = String(id).match(/(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export function equipmentForPackage(data, packageId) {
  return data.equipment.filter((item) => item.packageId === packageId);
}

export function vendorsForPackage(data, country, packageId) {
  if (!country || !packageId) return [];
  const rows = data.packageVendors.filter(
    (row) => row.country === country && row.packageId === packageId,
  );
  const byVendor = new Map();
  for (const row of rows) {
    const vendor = data.vendors.find((item) => item.id === row.vendorId);
    if (!vendor) continue;
    const equipment = data.equipment.find((item) => item.id === row.equipmentId);
    const entry = byVendor.get(vendor.id) || {
      ...vendor,
      supplies: [],
      leadTimes: [],
      cities: [],
    };
    if (equipment) entry.supplies.push(equipment.name);
    if (row.leadTime) entry.leadTimes.push(row.leadTime);
    if (row.cityFocus) entry.cities.push(row.cityFocus);
    byVendor.set(vendor.id, entry);
  }
  return [...byVendor.values()].map((vendor) => ({
    ...vendor,
    supplies: [...new Set(vendor.supplies)],
    leadTimes: [...new Set(vendor.leadTimes)],
    cities: [...new Set(vendor.cities)],
  }));
}

export function locationsForVendor(data, vendorId, country) {
  return data.locations.filter(
    (loc) =>
      loc.vendorId === vendorId && (!country || loc.country === country),
  );
}

export function downloadDashboardExcel(data, filename = "vendor-packages.xlsx") {
  const packages = data.packages.map((row) => ({
    package_id: row.id,
    name: row.name,
    color: row.color,
    sort_order: row.sortOrder,
    description: row.description,
  }));
  const equipment = data.equipment.map((row) => ({
    equipment_id: row.id,
    package_id: row.packageId,
    name: row.name,
  }));
  const vendors = data.vendors.map((row) => ({
    vendor_id: row.id,
    name: row.name,
  }));
  const packageVendors = data.packageVendors.map((row) => ({
    country: row.country,
    package_id: row.packageId,
    vendor_id: row.vendorId,
    equipment_id: row.equipmentId,
    lead_time: row.leadTime,
    city_focus: row.cityFocus,
  }));
  const locations = data.locations.map((row) => ({
    location_id: row.id,
    vendor_id: row.vendorId,
    name: row.name,
    address: row.address,
    city: row.city,
    country: row.country,
    lat: row.lat ?? "",
    lng: row.lng ?? "",
    entity_type: row.entityType,
    verified: row.verified,
    notes: row.notes,
  }));
  const sites = (data.sites || []).map((row) => ({
    site_id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    lat: row.lat ?? "",
    lng: row.lng ?? "",
    role: row.role,
  }));

  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries({
    Packages: packages,
    Equipment: equipment,
    Vendors: vendors,
    PackageVendors: packageVendors,
    Locations: locations,
    Sites: sites,
  })) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
  }
  XLSX.writeFile(wb, filename);
}
