let countriesPromise;

function pointInRing([longitude, latitude], ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    const crosses = y > latitude !== previousY > latitude;
    if (crosses && longitude < ((previousX - x) * (latitude - y)) / (previousY - y) + x) inside = !inside;
  }
  return inside;
}

function includesPoint(geometry, point) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(([outer, ...holes]) => pointInRing(point, outer) && !holes.some((hole) => pointInRing(point, hole)));
}

async function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch(`${import.meta.env.BASE_URL}countries-110m.geojson`).then((response) => {
      if (!response.ok) throw new Error("Country boundaries unavailable");
      return response.json();
    });
  }
  return countriesPromise;
}

export async function countriesForPins(pins) {
  const data = await loadCountries();
  const groups = new Map();
  pins.forEach((pin) => {
    const feature = data.features.find((item) =>
      includesPoint(item.geometry, [pin.lng, pin.lat]),
    );
    const key = feature?.properties.ADM0_A3 || "unmapped";
    if (!groups.has(key)) {
      groups.set(key, {
        country: feature
          ? {
              feature,
              features: data.features,
              name: feature.properties.NAME_EN || feature.properties.NAME,
            }
          : null,
        pins: [],
      });
    }
    groups.get(key).pins.push(pin);
  });
  return [...groups.values()];
}

export async function countryForPins(pins) {
  const groups = await countriesForPins(pins);
  return groups.length === 1 ? groups[0].country : null;
}
