import { useEffect, useState } from "react";
import { getPins } from "./db";

function MapsIcon() {
  return (
    <span className="saas-icon saas-icon-maps" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M5.5 9.2 13 6.8l6.2 3.1 7.3-2.6v16.7l-7.3 2.6L13 23.5l-7.5 2.7V9.2Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M13 6.8v16.7M19.2 9.9v16.1"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M17.2 14.4c0-1.7-1.3-3-3-3s-3 1.3-3 3c0 2.4 3 5.2 3 5.2s3-2.8 3-5.2Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

function DataIcon() {
  return (
    <span className="saas-icon saas-icon-data" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <ellipse
          cx="16"
          cy="8.4"
          rx="9.2"
          ry="3.3"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M6.8 8.4v5.4c0 1.8 4.1 3.3 9.2 3.3s9.2-1.5 9.2-3.3V8.4"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <path
          d="M6.8 13.8v5.4c0 1.8 4.1 3.3 9.2 3.3s9.2-1.5 9.2-3.3v-5.4"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      </svg>
    </span>
  );
}

function DashboardIcon() {
  return (
    <span className="saas-icon saas-icon-dash" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <rect
          x="5"
          y="5"
          width="9"
          height="9"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <rect
          x="18"
          y="5"
          width="9"
          height="13"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <rect
          x="5"
          y="18"
          width="9"
          height="9"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.7"
        />
        <rect
          x="18"
          y="22"
          width="9"
          height="5"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      </svg>
    </span>
  );
}

export default function Home() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    getPins()
      .then((pins) => setCount(pins.length))
      .catch(() => setCount(0));
  }, []);

  return (
    <main className="home-shell">
      <header className="home-topbar">
        <div className="brand">
          <span className="brand-mark">⌖</span>
          <span>pin atlas</span>
        </div>
        <div className="saved-state">
          <i></i>
          Offline on this device
        </div>
      </header>

      <section className="home-hero">
        <p className="home-kicker">YOUR OFFLINE ATLAS</p>
        <h1>Maps and memories, kept locally.</h1>
        <p className="home-lead">
          Drop pins on the map, review local IndexedDB data, or open the
          equipment package and vendor mapping dashboard.
        </p>

        <div className="home-tiles">
          <a className="saas-tile" href="#maps">
            <MapsIcon />
            <span className="saas-tile-copy">
              <strong>Maps</strong>
              <small>Open the world map and drop pins</small>
            </span>
            <span className="saas-tile-arrow">→</span>
          </a>

          <a className="saas-tile" href="#data">
            <DataIcon />
            <span className="saas-tile-copy">
              <strong>My Data</strong>
              <small>
                {count == null
                  ? "Loading saved pins…"
                  : count === 1
                    ? "1 pin saved locally"
                    : `${count} pins saved locally`}
              </small>
            </span>
            <span className="saas-tile-arrow">→</span>
          </a>

          <a className="saas-tile" href="#dashboard">
            <DashboardIcon />
            <span className="saas-tile-copy">
              <strong>Dashboard</strong>
              <small>Packages, vendors, and factory map from Excel</small>
            </span>
            <span className="saas-tile-arrow">→</span>
          </a>
        </div>
      </section>
    </main>
  );
}
