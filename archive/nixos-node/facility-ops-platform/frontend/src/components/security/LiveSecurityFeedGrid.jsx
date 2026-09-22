import React, { useMemo } from 'react';
import { VideoOff, Video } from 'lucide-react';

const STATUS_STYLES = {
  Clear: { badge: 'bg-status-successMuted text-status-success', box: null },
  'Motion Detected': { badge: 'bg-status-warningMuted text-status-warning', box: 'border-status-warning' },
  'Off-Hours Activity': { badge: 'bg-status-warningMuted text-status-warning', box: 'border-status-warning' },
  'Unattended Object': { badge: 'bg-status-criticalMuted text-status-critical', box: 'border-status-critical' },
  Offline: { badge: 'bg-surface-sunken text-text-muted', box: null },
};

/**
 * Deterministic 0-1 pseudo-random value from a string, purely for
 * positioning the simulated bounding-box overlay consistently per
 * camera - not a security-relevant calculation, just visual jitter so
 * every tile's box isn't in the exact same spot.
 */
function pseudoRandom(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

function CameraTile({ camera }) {
  const style = STATUS_STYLES[camera.status] || STATUS_STYLES.Clear;
  const isOffline = !camera.isOnline;

  const box = useMemo(() => {
    if (!style.box) return null;
    const rx = pseudoRandom(`${camera.cameraId}-x`);
    const ry = pseudoRandom(`${camera.cameraId}-y`);
    return {
      left: `${10 + rx * 45}%`,
      top: `${15 + ry * 40}%`,
      width: `${25 + pseudoRandom(`${camera.cameraId}-w`) * 20}%`,
      height: `${25 + pseudoRandom(`${camera.cameraId}-h`) * 20}%`,
    };
  }, [camera.cameraId, style.box]);

  return (
    <div className="relative aspect-video rounded-md overflow-hidden bg-surface-sunken border border-border-muted">
      {/* Simulated video noise/scanline texture instead of a real feed */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {isOffline ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-surface-sunken/90">
          <VideoOff size={18} className="text-text-muted" />
          <span className="text-[10px] text-text-muted font-data">SIGNAL LOST</span>
        </div>
      ) : (
        <>
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 text-[10px] font-data text-text-secondary bg-surface-base/70 px-1.5 py-0.5 rounded">
            <Video size={10} /> {camera.cameraId}
          </div>
          <span className={`absolute top-1.5 right-1.5 pill text-[9px] px-1.5 py-0.5 ${style.badge}`}>{camera.status}</span>

          {box && (
            <div
              className={`absolute rounded-sm border-2 border-dashed ${style.box}`}
              style={box}
            />
          )}

          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between text-[10px] text-text-muted">
            <span className="truncate">{camera.location}</span>
            {camera.status !== 'Clear' && <span className="font-data">{camera.confidencePct}%</span>}
          </div>
        </>
      )}
    </div>
  );
}

export default function LiveSecurityFeedGrid({ cameras = [], loading }) {
  return (
    <div className="panel p-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-semibold text-text-primary">Live Security Feed</h3>
        <span className="text-[11px] text-text-muted">simulated CCTV analysis</span>
      </div>

      {loading && <p className="text-xs text-text-muted">Loading camera feeds…</p>}

      {!loading && !cameras.length && (
        <p className="text-xs text-text-muted">No cameras yet — seed security data to populate the feed.</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {cameras.map((camera) => (
          <CameraTile key={camera.cameraId} camera={camera} />
        ))}
      </div>
    </div>
  );
}
