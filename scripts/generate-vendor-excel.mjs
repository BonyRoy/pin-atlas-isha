import * as XLSX from "xlsx";
import { writeFileSync } from "fs";

// Rebuild public/data/vendor-packages.xlsx from the India supply-chain dataset.
// Run: node scripts/generate-vendor-excel.mjs

const packages = [
  { package_id: "PKG01", name: "SKID & TX", color: "#8B1E1E", sort_order: 1, description: "Skid packages and transformers" },
  { package_id: "PKG02", name: "MV Panel", color: "#1E4F9C", sort_order: 2, description: "Medium voltage switchgear panels" },
  { package_id: "PKG03", name: "DG (Genset)", color: "#D97706", sort_order: 3, description: "Diesel generator sets" },
  { package_id: "PKG04", name: "CRAC (FWU & PAHU)", color: "#1F1F1F", sort_order: 4, description: "Computer room air conditioning" },
  { package_id: "PKG05", name: "Chiller", color: "#6B21A8", sort_order: 5, description: "Chilled water plants" },
  { package_id: "PKG06", name: "PDU", color: "#DC2626", sort_order: 6, description: "Power distribution units" },
  { package_id: "PKG07", name: "BMS", color: "#0F766E", sort_order: 7, description: "Building management systems" },
  { package_id: "PKG08", name: "Networking & IT", color: "#4B5563", sort_order: 8, description: "Network and IT infrastructure" },
  { package_id: "PKG09", name: "UPS", color: "#9D174D", sort_order: 9, description: "Uninterruptible power supply" },
];

const equipment = [
  { equipment_id: "EQ01", package_id: "PKG01", name: "Transformer Skid" },
  { equipment_id: "EQ02", package_id: "PKG01", name: "Power Transformer" },
  { equipment_id: "EQ03", package_id: "PKG02", name: "MV Switchgear" },
  { equipment_id: "EQ04", package_id: "PKG02", name: "MV Panel Board" },
  { equipment_id: "EQ05", package_id: "PKG03", name: "Diesel Genset" },
  { equipment_id: "EQ06", package_id: "PKG04", name: "CRAC Unit" },
  { equipment_id: "EQ07", package_id: "PKG04", name: "FWU / PAHU" },
  { equipment_id: "EQ08", package_id: "PKG05", name: "Chiller Plant" },
  { equipment_id: "EQ09", package_id: "PKG06", name: "Rack PDU" },
  { equipment_id: "EQ10", package_id: "PKG07", name: "BMS Controller" },
  { equipment_id: "EQ11", package_id: "PKG08", name: "Network Switch Stack" },
  { equipment_id: "EQ12", package_id: "PKG09", name: "UPS Module" },
];

const vendors = [
  { vendor_id: "V01", name: "Schneider Electric" },
  { vendor_id: "V02", name: "Eaton" },
  { vendor_id: "V03", name: "Vertiv" },
  { vendor_id: "V04", name: "Socomec" },
  { vendor_id: "V05", name: "ABB" },
  { vendor_id: "V06", name: "Siemens" },
  { vendor_id: "V07", name: "Cummins" },
  { vendor_id: "V08", name: "Legrand" },
];

const packageVendors = [
  { country: "India", package_id: "PKG04", vendor_id: "V03", equipment_id: "EQ06", lead_time: "12-16 wks", city_focus: "Pune" },
  { country: "India", package_id: "PKG05", vendor_id: "V03", equipment_id: "EQ08", lead_time: "14-18 wks", city_focus: "Pune" },
  { country: "India", package_id: "PKG02", vendor_id: "V01", equipment_id: "EQ03", lead_time: "10-14 wks", city_focus: "Pune" },
  { country: "India", package_id: "PKG09", vendor_id: "V02", equipment_id: "EQ12", lead_time: "8-12 wks", city_focus: "Pune" },
  { country: "India", package_id: "PKG04", vendor_id: "V03", equipment_id: "EQ07", lead_time: "12-16 wks", city_focus: "Bangalore" },
  { country: "India", package_id: "PKG09", vendor_id: "V04", equipment_id: "EQ12", lead_time: "10-14 wks", city_focus: "Bangalore" },
  { country: "India", package_id: "PKG06", vendor_id: "V02", equipment_id: "EQ09", lead_time: "8-10 wks", city_focus: "Bangalore" },
  { country: "India", package_id: "PKG02", vendor_id: "V01", equipment_id: "EQ04", lead_time: "12-16 wks", city_focus: "Bangalore" },
  { country: "India", package_id: "PKG09", vendor_id: "V04", equipment_id: "EQ12", lead_time: "10-12 wks", city_focus: "Chennai" },
  { country: "India", package_id: "PKG03", vendor_id: "V07", equipment_id: "EQ05", lead_time: "16-20 wks", city_focus: "Chennai" },
  { country: "India", package_id: "PKG01", vendor_id: "V05", equipment_id: "EQ01", lead_time: "18-22 wks", city_focus: "Chennai" },
  { country: "India", package_id: "PKG07", vendor_id: "V01", equipment_id: "EQ10", lead_time: "8-12 wks", city_focus: "Gurgaon" },
  { country: "India", package_id: "PKG08", vendor_id: "V08", equipment_id: "EQ11", lead_time: "6-10 wks", city_focus: "Gurgaon" },
  { country: "India", package_id: "PKG05", vendor_id: "V03", equipment_id: "EQ08", lead_time: "14-18 wks", city_focus: "Vadodara" },
  { country: "India", package_id: "PKG02", vendor_id: "V06", equipment_id: "EQ03", lead_time: "12-16 wks", city_focus: "Vadodara" },
  { country: "India", package_id: "PKG01", vendor_id: "V05", equipment_id: "EQ02", lead_time: "16-20 wks", city_focus: "Silvassa" },
  { country: "India", package_id: "PKG03", vendor_id: "V07", equipment_id: "EQ05", lead_time: "14-18 wks", city_focus: "Goa" },
  { country: "India", package_id: "PKG06", vendor_id: "V02", equipment_id: "EQ09", lead_time: "8-12 wks", city_focus: "Hosur" },
  { country: "India", package_id: "PKG04", vendor_id: "V03", equipment_id: "EQ06", lead_time: "12-14 wks", city_focus: "Pondicherry" },
  { country: "India", package_id: "PKG09", vendor_id: "V02", equipment_id: "EQ12", lead_time: "10-14 wks", city_focus: "Ambernath" },
  { country: "India", package_id: "PKG07", vendor_id: "V01", equipment_id: "EQ10", lead_time: "8-10 wks", city_focus: "Navi Mumbai" },
  { country: "India", package_id: "PKG08", vendor_id: "V08", equipment_id: "EQ11", lead_time: "6-8 wks", city_focus: "Navi Mumbai" },
];

const locations = [
  { location_id: "L01", vendor_id: "V01", name: "Schneider Electric Bengaluru Works", address: "Electronic City Phase I", city: "Bangalore", country: "India", lat: 12.8399, lng: 77.677, entity_type: "Manufacturing", verified: "yes", notes: "MV panel / BMS manufacturing" },
  { location_id: "L02", vendor_id: "V01", name: "Schneider Channel Partner – Pune", address: "Hinjewadi Industrial Area", city: "Pune", country: "India", lat: 18.5912, lng: 73.7389, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L03", vendor_id: "V01", name: "Schneider Partner Hub – Gurgaon", address: "Udyog Vihar Phase IV", city: "Gurgaon", country: "India", lat: 28.5021, lng: 77.0869, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L04", vendor_id: "V01", name: "Schneider Support – Navi Mumbai", address: "Near Site 1 & 2", city: "Navi Mumbai", country: "India", lat: 19.033, lng: 73.0297, entity_type: "Local Partner", verified: "yes", notes: "Project site support" },
  { location_id: "L05", vendor_id: "V02", name: "Eaton Power Quality – Pune", address: "Chakan MIDC", city: "Pune", country: "India", lat: 18.7603, lng: 73.8631, entity_type: "Manufacturing", verified: "yes", notes: "UPS manufacturing" },
  { location_id: "L06", vendor_id: "V02", name: "Eaton Partner – Bangalore", address: "Peenya Industrial Area", city: "Bangalore", country: "India", lat: 13.0285, lng: 77.5197, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L07", vendor_id: "V02", name: "Eaton Works – Ambernath", address: "MIDC Ambernath", city: "Ambernath", country: "India", lat: 19.2094, lng: 73.1852, entity_type: "Manufacturing", verified: "yes", notes: "" },
  { location_id: "L08", vendor_id: "V02", name: "Eaton Partner – Hosur", address: "SIPCOT Industrial Complex", city: "Hosur", country: "India", lat: 12.7409, lng: 77.8253, entity_type: "Local Partner", verified: "partial", notes: "Address to be confirmed" },
  { location_id: "L09", vendor_id: "V03", name: "Vertiv Manufacturing – Pune", address: "Talegaon MIDC", city: "Pune", country: "India", lat: 18.735, lng: 73.675, entity_type: "Manufacturing", verified: "yes", notes: "CRAC / Chiller" },
  { location_id: "L10", vendor_id: "V03", name: "Vertiv Partner – Bangalore", address: "Whitefield", city: "Bangalore", country: "India", lat: 12.9698, lng: 77.75, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L11", vendor_id: "V03", name: "Vertiv Partner – Vadodara", address: "Makarpura GIDC", city: "Vadodara", country: "India", lat: 22.25, lng: 73.19, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L12", vendor_id: "V03", name: "Vertiv Partner – Pondicherry", address: "Sedarapet Industrial Estate", city: "Pondicherry", country: "India", lat: 11.9416, lng: 79.8083, entity_type: "Local Partner", verified: "no", notes: "Coordinates approximate – unverified" },
  { location_id: "L13", vendor_id: "V04", name: "Socomec India – Bangalore", address: "Bommasandra", city: "Bangalore", country: "India", lat: 12.805, lng: 77.697, entity_type: "Manufacturing", verified: "yes", notes: "UPS" },
  { location_id: "L14", vendor_id: "V04", name: "Socomec Partner – Chennai", address: "Ambattur Industrial Estate", city: "Chennai", country: "India", lat: 13.0982, lng: 80.162, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L15", vendor_id: "V05", name: "ABB Transformer Works – Silvassa", address: "Piparia Industrial Area", city: "Silvassa", country: "India", lat: 20.2762, lng: 73.0083, entity_type: "Manufacturing", verified: "yes", notes: "SKID & TX" },
  { location_id: "L16", vendor_id: "V05", name: "ABB Partner – Chennai", address: "Guindy Industrial Estate", city: "Chennai", country: "India", lat: 13.0108, lng: 80.215, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L17", vendor_id: "V06", name: "Siemens Switchgear – Vadodara", address: "Makarpura", city: "Vadodara", country: "India", lat: 22.27, lng: 73.2, entity_type: "Manufacturing", verified: "yes", notes: "MV Panel" },
  { location_id: "L18", vendor_id: "V06", name: "Siemens Partner Office – Navi Mumbai", address: "Vashi", city: "Navi Mumbai", country: "India", lat: 19.0771, lng: 73, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L19", vendor_id: "V07", name: "Cummins Powergen – Goa", address: "Verna Industrial Estate", city: "Goa", country: "India", lat: 15.3647, lng: 73.9381, entity_type: "Manufacturing", verified: "yes", notes: "DG Genset" },
  { location_id: "L20", vendor_id: "V07", name: "Cummins Partner – Chennai", address: "Sriperumbudur", city: "Chennai", country: "India", lat: 12.9675, lng: 79.9449, entity_type: "Local Partner", verified: "partial", notes: "Exact plant address pending" },
  { location_id: "L21", vendor_id: "V08", name: "Legrand Works – Navi Mumbai", address: "Taloja MIDC", city: "Navi Mumbai", country: "India", lat: 19.075, lng: 73.11, entity_type: "Manufacturing", verified: "yes", notes: "Networking & IT" },
  { location_id: "L22", vendor_id: "V08", name: "Legrand Partner – Gurgaon", address: "Sector 18", city: "Gurgaon", country: "India", lat: 28.495, lng: 77.088, entity_type: "Local Partner", verified: "yes", notes: "" },
  { location_id: "L23", vendor_id: "V03", name: "Vertiv – location TBD", address: "", city: "India (unspecified)", country: "India", lat: "", lng: "", entity_type: "Local Partner", verified: "no", notes: "Missing coordinates – do not plot on map" },
];

const sites = [
  { site_id: "S01", name: "Navi Mumbai (Site 1 & 2)", city: "Navi Mumbai", country: "India", lat: 19.033, lng: 73.0297, role: "Project Hub" },
];

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
writeFileSync("public/data/vendor-packages.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
console.log("Wrote public/data/vendor-packages.xlsx");
