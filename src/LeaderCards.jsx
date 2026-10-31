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

function layoutLeaderCards(entries, size) {
  const width = size.x;
  const height = size.y;
  const cardW = cardWidthFor(size);
  const points = entries.map(({ point }) => point);
  const laneX = {
    left: PAD,
    right: width - PAD - cardW,
  };
  const sideFor = () => {
    const score = (side) =>
      points.filter(
        (other) =>
          other.x >= laneX[side] - 18 && other.x <= laneX[side] + cardW + 18,
      ).length;
    return score("left") <= score("right") ? "left" : "right";
  };

  const items = entries.map(({ pin, point }) => ({
    id: pin.id,
    pin,
    px: point.x,
    py: point.y,
    w: cardW,
    h: estimateCardHeight(pin),
    side: sideFor(),
  }));

  const pack = (side) => {
    const group = items
      .filter((item) => item.side === side)
      .sort((a, b) => a.py - b.py || a.px - b.px);
    if (!group.length) return;

    const placed = [];
    for (const item of group) {
      item.x = laneX[side];
      const maxY = Math.max(PAD, height - PAD - item.h);
      const clampY = (value) => Math.min(maxY, Math.max(PAD, value));
      const desiredY = clampY(item.py - item.h / 2);
      const candidates = [desiredY, PAD, maxY];
      for (const point of points) {
        candidates.push(clampY(point.y - item.h - 20));
        candidates.push(clampY(point.y + 20));
      }
      for (const previous of placed) {
        candidates.push(clampY(previous.y - item.h - GAP));
        candidates.push(clampY(previous.y + previous.h + GAP));
      }
      const clearsPins = (y) =>
        points.every(
          (point) =>
            point.x < item.x - 20 ||
            point.x > item.x + item.w + 20 ||
            point.y < y - 20 ||
            point.y > y + item.h + 20,
        );
      const clearsCards = (y) =>
        placed.every(
          (previous) => y + item.h + GAP <= previous.y || y >= previous.y + previous.h + GAP,
        );
      const openSlot = candidates
        .filter((y) => clearsPins(y) && clearsCards(y))
        .sort((a, b) => Math.abs(a - desiredY) - Math.abs(b - desiredY))[0];
      item.y = openSlot ?? desiredY;
      placed.push(item);
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
