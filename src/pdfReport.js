import { jsPDF } from "jspdf";

const PAGE = { width: 595.28, height: 841.89, margin: 48 };

function reportId() {
  return `PA-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`;
}

function addFooter(pdf, page) {
  pdf.setDrawColor(222, 221, 211);
  pdf.line(PAGE.margin, 795, PAGE.width - PAGE.margin, 795);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 105, 96);
  pdf.text("PIN ATLAS  |  LOCATION REPORT", PAGE.margin, 812);
  pdf.text(`PAGE ${page}`, PAGE.width - PAGE.margin, 812, { align: "right" });
}

function addImageContain(pdf, data, x, y, width, height) {
  const props = pdf.getImageProperties(data);
  const ratio = Math.min(width / props.width, height / props.height);
  const imageWidth = props.width * ratio;
  const imageHeight = props.height * ratio;
  pdf.addImage(data, "PNG", x + (width - imageWidth) / 2, y, imageWidth, imageHeight);
  return imageHeight;
}

function countryMapImage(country, pins) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 720;
  const context = canvas.getContext("2d");
  const [west, south, east, north] = country.feature.bbox;
  const cardColumn = 315;
  const mapBounds = { x: cardColumn + 44, y: 48, width: 790, height: 625 };
  const centerLongitude = (west + east) / 2;
  const centerLatitude = (south + north) / 2;
  let viewWidth = (east - west) * 1.65;
  let viewHeight = (north - south) * 1.65;
  const mapAspect = mapBounds.width / mapBounds.height;
  if (viewWidth / viewHeight < mapAspect) viewWidth = viewHeight * mapAspect;
  else viewHeight = viewWidth / mapAspect;
  const viewWest = centerLongitude - viewWidth / 2;
  const viewNorth = centerLatitude + viewHeight / 2;
  const viewEast = centerLongitude + viewWidth / 2;
  const viewSouth = centerLatitude - viewHeight / 2;
  const ratio = mapBounds.width / viewWidth;
  const project = ([longitude, latitude]) => [
    mapBounds.x + (longitude - viewWest) * ratio,
    mapBounds.y + (viewNorth - latitude) * ratio,
  ];
  const drawFeature = (feature, fill, stroke) => {
    const polygons = feature.geometry.type === "Polygon"
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates;
    context.beginPath();
    polygons.forEach((polygon) => {
      polygon.forEach((ring) => {
        ring.forEach((coordinate, index) => {
          const [x, y] = project(coordinate);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.closePath();
      });
    });
    context.fillStyle = fill;
    context.fill("evenodd");
    if (stroke) {
      context.strokeStyle = stroke;
      context.lineWidth = 3;
      context.stroke();
    }
  };

  context.fillStyle = "#6eb4ea";
  context.fillRect(0, 0, canvas.width, canvas.height);
  (country.features || [country.feature])
    .filter((feature) => {
      const [featureWest, featureSouth, featureEast, featureNorth] = feature.bbox || [];
      return featureEast >= viewWest && featureWest <= viewEast && featureNorth >= viewSouth && featureSouth <= viewNorth;
    })
    .forEach((feature) => drawFeature(feature, "#6f9c65", null));
  drawFeature(country.feature, "#6f9c65", "#355a30");

  const cardGap = 12;
  const cardHeight = Math.min(112, (canvas.height - 52 - cardGap * (pins.length - 1)) / pins.length);
  pins.forEach((pin, index) => {
    const y = 26 + index * (cardHeight + cardGap);
    const [pinX, pinY] = project([pin.lng, pin.lat]);
    const cardRight = cardColumn - 18;
    const cardMidY = y + cardHeight / 2;
    context.strokeStyle = pin.color || "#ef5b3f";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(cardRight, cardMidY);
    context.lineTo(pinX - 18, cardMidY);
    context.lineTo(pinX - 18, pinY);
    context.lineTo(pinX, pinY);
    context.stroke();
    context.fillStyle = pin.color || "#ef5b3f";
    context.beginPath();
    context.arc(pinX, pinY, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff";
    context.beginPath();
    context.arc(pinX, pinY, 5, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#fffefa";
    context.strokeStyle = pin.color || "#ef5b3f";
    context.lineWidth = 4;
    context.fillRect(20, y, cardRight - 20, cardHeight);
    context.strokeRect(20, y, cardRight - 20, cardHeight);
    context.fillStyle = pin.color || "#ef5b3f";
    context.beginPath();
    context.arc(40, y + 24, 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#20241e";
    context.font = "700 18px Arial";
    context.fillText(pin.title || "Untitled place", 56, y + 30);
    context.fillStyle = "#596055";
    context.font = "15px Arial";
    const note = pin.description || "No description recorded.";
    const words = note.split(/\s+/);
    let line = "";
    let noteY = y + 57;
    words.forEach((word) => {
      const candidate = `${line}${line ? " " : ""}${word}`;
      if (context.measureText(candidate).width > cardRight - 54 && line) {
        context.fillText(line, 40, noteY);
        noteY += 19;
        line = word;
      } else line = candidate;
    });
    if (line && noteY <= y + cardHeight - 12) context.fillText(line, 40, noteY);
  });
  return canvas.toDataURL("image/png");
}

function drawDetailHeader(pdf, page, countryName) {
  pdf.setFillColor(61, 83, 51);
  pdf.rect(0, 0, PAGE.width, 10, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(61, 83, 51);
  pdf.text(countryName ? `${countryName.toUpperCase()} - LOCATION DETAILS` : "LOCATION DETAILS", PAGE.margin, 48);
  pdf.setDrawColor(222, 221, 211);
  pdf.line(PAGE.margin, 59, PAGE.width - PAGE.margin, 59);
  addFooter(pdf, page);
}

function detailCardHeight(pdf, pin) {
  const width = PAGE.width - PAGE.margin * 2;
  const notes = pdf.splitTextToSize(pin.description || "No description recorded.", pin.image?.startsWith("data:image/") ? 275 : width - 28);
  const imageHeight = pin.image?.startsWith("data:image/") ? 92 : 0;
  return Math.max(116, notes.length * 13 + 68, imageHeight + 24);
}

function drawDetailCard(pdf, pin, index, y, id) {
  const x = PAGE.margin;
  const width = PAGE.width - PAGE.margin * 2;
  const notes = pdf.splitTextToSize(pin.description || "No description recorded.", pin.image?.startsWith("data:image/") ? 275 : width - 28);
  const imageHeight = pin.image?.startsWith("data:image/") ? 92 : 0;
  const height = detailCardHeight(pdf, pin);
  pdf.setFillColor(255, 255, 254);
  pdf.setDrawColor(222, 221, 211);
  pdf.roundedRect(x, y, width, height, 4, 4, "FD");
  pdf.setFillColor(pin.color || "#ef5b3f");
  pdf.circle(x + 16, y + 18, 5, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(32, 36, 30);
  pdf.text(pin.title || "Untitled place", x + 29, y + 22, { maxWidth: 255 });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(100, 105, 96);
  pdf.text(`${id}-${String(index + 1).padStart(2, "0")}  |  ${Number(pin.lat).toFixed(5)}, ${Number(pin.lng).toFixed(5)}`, x + 29, y + 37);
  pdf.setFontSize(9);
  pdf.setTextColor(50, 55, 48);
  pdf.text(notes, x + 16, y + 58, { lineHeightFactor: 1.4 });

  if (imageHeight) {
    try {
      addImageContain(pdf, pin.image, x + width - 128, y + 12, 112, imageHeight);
    } catch {
      // An invalid embedded image should not stop the report from downloading.
    }
  }
  return height;
}

function drawCountryPage(pdf, group, page, id, generated) {
  const { country, pins } = group;
  pdf.setFillColor(61, 83, 51);
  pdf.rect(0, 0, PAGE.width, 14, "F");
  pdf.setFont("times", "bold");
  pdf.setFontSize(24);
  pdf.setTextColor(32, 36, 30);
  pdf.text("Pin Atlas", PAGE.margin, 66);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(61, 83, 51);
  pdf.text(`${country.name.toUpperCase()} LOCATION REPORT`, PAGE.margin, 84);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(90, 95, 86);
  pdf.text(`Prepared  ${generated}`, PAGE.width - PAGE.margin, 66, { align: "right" });
  pdf.setDrawColor(222, 221, 211);
  pdf.line(PAGE.margin, 104, PAGE.width - PAGE.margin, 104);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(32, 36, 30);
  pdf.text(`MAP OF ${country.name.toUpperCase()}`, PAGE.margin, 134);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(90, 95, 86);
  pdf.text(`${pins.length} selected location${pins.length === 1 ? "" : "s"}`, PAGE.margin, 151);
  pdf.setDrawColor(222, 221, 211);
  pdf.roundedRect(PAGE.margin, 166, PAGE.width - PAGE.margin * 2, 260, 4, 4, "S");
  addImageContain(pdf, countryMapImage(country, pins), PAGE.margin + 8, 174, PAGE.width - PAGE.margin * 2 - 16, 244);

  let y = 458;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(61, 83, 51);
  pdf.text("LOCATION RECORDS", PAGE.margin, y);
  y += 14;
  pins.slice(0, 5).forEach((pin, index) => {
    pdf.setFillColor(255, 255, 254);
    pdf.setDrawColor(222, 221, 211);
    pdf.roundedRect(PAGE.margin, y, PAGE.width - PAGE.margin * 2, 42, 3, 3, "FD");
    pdf.setFillColor(pin.color || "#ef5b3f");
    pdf.circle(PAGE.margin + 14, y + 15, 4, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(32, 36, 30);
    pdf.text(pin.title || "Untitled place", PAGE.margin + 25, y + 18);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(90, 95, 86);
    pdf.text(`${Number(pin.lat).toFixed(4)}, ${Number(pin.lng).toFixed(4)}`, 240, y + 18);
    const summary = pdf.splitTextToSize(pin.description || "No description recorded.", 410);
    pdf.text(summary[0], PAGE.margin + 25, y + 32);
    y += 50;
  });
  if (pins.length > 5) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 105, 96);
    pdf.text(`${pins.length - 5} additional location records are included in a continuation report.`, PAGE.margin, y + 6);
  }
  addFooter(pdf, page);
}

function downloadCountryGroups(groups) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const id = reportId();
  const generated = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());
  groups.forEach((group, index) => {
    if (index) pdf.addPage();
    drawCountryPage(pdf, group, index + 1, id, generated);
  });
  pdf.save(`pin-atlas-country-reports-${id.toLowerCase()}.pdf`);
}

export function downloadPinReport({ pins, mapImage, country, countryName }) {
  if (Array.isArray(country)) {
    downloadCountryGroups(country);
    return;
  }
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const id = reportId();
  const reportMapImage = country ? countryMapImage(country, pins) : mapImage;
  const generated = new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  pdf.setFillColor(61, 83, 51);
  pdf.rect(0, 0, PAGE.width, 14, "F");
  pdf.setFont("times", "bold");
  pdf.setFontSize(25);
  pdf.setTextColor(32, 36, 30);
  pdf.text("Pin Atlas", PAGE.margin, 70);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(61, 83, 51);
  pdf.text(countryName ? `${countryName.toUpperCase()} LOCATION REPORT` : "LOCATION MAP REPORT", PAGE.margin, 89);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(90, 95, 86);
  pdf.text(`Report reference  ${id}`, PAGE.width - PAGE.margin, 70, { align: "right" });
  pdf.text(`Prepared  ${generated}`, PAGE.width - PAGE.margin, 86, { align: "right" });
  pdf.setDrawColor(222, 221, 211);
  pdf.line(PAGE.margin, 108, PAGE.width - PAGE.margin, 108);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(32, 36, 30);
  pdf.text(countryName ? `MAP OF ${countryName.toUpperCase()}` : "MAP EXHIBIT", PAGE.margin, 137);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(90, 95, 86);
  pdf.text(`${pins.length} selected location${pins.length === 1 ? "" : "s"} shown with map cards`, PAGE.margin, 154);
  pdf.setDrawColor(222, 221, 211);
  pdf.roundedRect(PAGE.margin, 175, PAGE.width - PAGE.margin * 2, 318, 4, 4, "S");
  addImageContain(pdf, reportMapImage, PAGE.margin + 8, 183, PAGE.width - PAGE.margin * 2 - 16, 302);
  pdf.setFontSize(8);
  pdf.setTextColor(100, 105, 96);
  pdf.text(countryName ? `The full boundary of ${countryName} is shown with the selected location cards.` : "Map extent automatically framed to the selected location cards.", PAGE.margin, 520);
  addFooter(pdf, 1);

  let page = 2;
  let y = 84;
  pdf.addPage();
  drawDetailHeader(pdf, page, countryName);
  pins.forEach((pin, index) => {
    const height = detailCardHeight(pdf, pin);
    if (y + height > 770 && y !== 84) {
      pdf.addPage();
      page += 1;
      y = 84;
      drawDetailHeader(pdf, page, countryName);
    }
    drawDetailCard(pdf, pin, index, y, id);
    y += height + 14;
  });

  pdf.save(`pin-atlas-location-report-${id.toLowerCase()}.pdf`);
}
