import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { useMap, useMapEvents } from "react-leaflet";

const GAP = 10;
const PAD = 12;

function estimateCardHeight(pin) {
  return pin.image ? 102 : 64;
}

function cardWidthFor(size) {
  return size.x < 420 ? 108 : 132;
}

function stemFor(size) {
  return size.x < 420 ? 40 : 58;
}

function layoutLeaderCards(entries, size) {
  const width = size.x;
  const height = size.y;
  const cardW = cardWidthFor(size);
  const stem = stemFor(size);

  const items = entries.map(({ pin, point }) => ({
    id: pin.id,
    pin,
    px: point.x,
    py: point.y,
    w: cardW,
    h: estimateCardHeight(pin),
    side: point.x < width / 2 ? "left" : "right",
  }));

  for (const item of items) {
    if (item.side === "left" && item.px < PAD + item.w + 28) item.side = "right";
    if (item.side === "right" && item.px > width - PAD - item.w - 28)
      item.side = "left";
  }

  const pack = (side) => {
    const group = items
      .filter((item) => item.side === side)
      .sort((a, b) => a.py - b.py || a.px - b.px);
    if (!group.length) return;

    for (const item of group) {
      item.x =
        side === "left"
          ? Math.max(PAD, item.px - stem - item.w)
          : Math.min(width - PAD - item.w, item.px + stem);
      item.y = item.py - item.h / 2;
    }

    const total =
      group.reduce((sum, item) => sum + item.h, 0) +
      GAP * Math.max(0, group.length - 1);
    const available = Math.max(80, height - PAD * 2);
    let gap = GAP;
    if (total > available) {
      const scale = available / total;
      for (const item of group) item.h = Math.max(34, item.h * scale);
      gap = Math.max(4, GAP * scale);
    }

    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const cur = group[i];
      const minY = prev.y + prev.h + gap;
      if (cur.y < minY) cur.y = minY;
    }

    const last = group[group.length - 1];
    if (last.y + last.h > height - PAD) last.y = height - PAD - last.h;
    for (let i = group.length - 2; i >= 0; i--) {
      const next = group[i + 1];
      const cur = group[i];
      const maxY = next.y - cur.h - gap;
      if (cur.y > maxY) cur.y = maxY;
    }
    if (group[0].y < PAD) {
      const shift = PAD - group[0].y;
      for (const item of group) item.y += shift;
    }

    for (const item of group) {
      item.attachX = side === "left" ? item.x + item.w : item.x;
      item.attachY = item.y + Math.min(16, item.h / 2);
    }
  };

  pack("left");
  pack("right");
  return items;
}

function leaderPath(item) {
  const startX = item.px;
  const startY = item.py - 16;
  const endX = item.attachX;
  const endY = item.attachY;
  const bendX =
    item.side === "left"
      ? Math.min(startX - 18, endX + 14)
      : Math.max(startX + 18, endX - 14);
  return `M ${startX} ${startY} L ${bendX} ${startY} L ${bendX} ${endY} L ${endX} ${endY}`;
}

export default function LeaderCards({ pins, activeId, onSelect }) {
  const map = useMap();
  const frame = useRef(0);
  const layerRef = useRef(null);
  const [layout, setLayout] = useState([]);
  const [view, setView] = useState(() => map.getSize());

  const relayout = useCallback(() => {
    const size = map.getSize();
    const visible = pins
      .map((pin) => ({
        pin,
        point: map.latLngToContainerPoint([pin.lat, pin.lng]),
      }))
      .filter(
        ({ point }) =>
          point.x > -56 &&
          point.x < size.x + 56 &&
          point.y > -56 &&
          point.y < size.y + 56,
      );
    setView(size);
    setLayout(layoutLeaderCards(visible, size));
  }, [map, pins]);

  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      relayout();
    });
  }, [relayout]);

  // Run before paint when the checkbox mounts this overlay. This prevents the
  // initial empty layout from being left on screen until the map next moves.
  useLayoutEffect(() => {
    map.whenReady(relayout);
    schedule();
    return () => cancelAnimationFrame(frame.current);
  }, [map, relayout, schedule]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    L.DomEvent.disableClickPropagation(layer);
    L.DomEvent.disableScrollPropagation(layer);
  }, [layout.length]);

  useMapEvents({
    move: schedule,
    zoom: schedule,
    resize: schedule,
    moveend: relayout,
    zoomend: relayout,
  });

  if (!layout.length) return null;

  return createPortal(
    <div className="leader-layer" ref={layerRef}>
      <svg
        className="leader-lines"
        width={view.x}
        height={view.y}
        aria-hidden="true"
      >
        {layout.map((item) => (
          <g
            key={item.id}
            className={item.id === activeId ? "is-active" : ""}
          >
            <path d={leaderPath(item)} stroke={item.pin.color} />
            <circle
              cx={item.attachX}
              cy={item.attachY}
              r="2.6"
              fill={item.pin.color}
            />
          </g>
        ))}
      </svg>
      {layout.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`leader-card ${item.id === activeId ? "is-active" : ""}`}
          style={{
            left: item.x,
            top: item.y,
            width: item.w,
            height: item.h,
            borderColor: item.pin.color,
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(item.id);
          }}
          aria-label={item.pin.title || "Untitled place"}
        >
          <div className="map-card-top">
            <span style={{ background: item.pin.color }}></span>
            <strong>{item.pin.title || "Untitled place"}</strong>
          </div>
          {item.pin.image && <img src={item.pin.image} alt="" />}
          <p>{item.pin.description}</p>
        </button>
      ))}
    </div>,
    map.getContainer(),
  );
}
