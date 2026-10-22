(function(root){
  const rad = n => n * Math.PI / 180;

  function distance(a, b) {
    const dlat = rad(b.lat - a.lat);
    const dlon = rad(b.lng - a.lng);
    const h = Math.sin(dlat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function calories(met, kg, seconds) {
    return met * 3.5 * kg / 200 * seconds / 60;
  }

  function analyzeTrack(points, totalSeconds) {
    const valid = Array.isArray(points)
      ? points.filter(p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Number.isFinite(p.t) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
      : [];

    if (!valid.length) {
      return { avgSpeed: 0, segments: 0, lineDistance: 0, maxAdjacentSpeed: 0 };
    }

    let currentSegment = 0;
    const segmentMap = new Map();
    for (let i = 0; i < valid.length; i++) {
      const p = valid[i];
      const prev = valid[i - 1];

      if (i > 0 && (p.break === true || (p.t - prev.t) / 1000 > 30)) {
        currentSegment += 1;
      }

      if (Number.isInteger(p.segment)) {
        currentSegment = p.segment;
      }

      if (!segmentMap.has(currentSegment)) {
        segmentMap.set(currentSegment, []);
      }
      segmentMap.get(currentSegment).push(p);
    }

    const segments = segmentMap.size || 1;
    let totalDistance = 0;
    for (let i = 1; i < valid.length; i++) {
      totalDistance += distance(valid[i - 1], valid[i]);
    }

    const movingTime = Number.isFinite(totalSeconds) ? Math.max(0, totalSeconds) : 0;
    const avgSpeed = movingTime > 0 ? Number(((totalDistance / movingTime) * 3.6).toFixed(2)) : 0;
    const first = valid[0];
    const last = valid[valid.length - 1];
    const lineDistance = valid.length > 1 ? Number(distance(first, last).toFixed(2)) : 0;

    let maxAdjacentSpeed = 0;
    for (const pts of segmentMap.values()) {
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1];
        const curr = pts[i];
        const dt = (curr.t - prev.t) / 1000;
        if (dt <= 0) continue;
        const speed = distance(prev, curr) / dt;
        if (speed > maxAdjacentSpeed) {
          maxAdjacentSpeed = speed;
        }
      }
    }

    return {
      avgSpeed,
      segments,
      lineDistance,
      maxAdjacentSpeed: Number(maxAdjacentSpeed.toFixed(2))
    };
  }

  function accept(previous, p) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng) || !Number.isFinite(p.t) || !Number.isFinite(p.accuracy) || Math.abs(p.lat) > 90 || Math.abs(p.lng) > 180 || p.accuracy < 0 || p.accuracy > 20) {
      return { ok: false, reason: 'GPS 精度不符合門檻：' + p.accuracy + 'm' };
    }
    if (!previous) return { ok: true, meters: 0, break: true };

    const dt = (p.t - previous.t) / 1000;
    if (dt <= 0) return { ok: false, reason: '時間倒退' };
    if (dt > 30) return { ok: true, meters: 0, break: true };

    const d = distance(previous, p);
    if (d / dt > 8) return { ok: false, reason: 'GPS 速度過快：' + d / dt + 'm/s' };
    if (d < Math.max(4, Math.min(12, (p.accuracy + previous.accuracy) * 0.25))) return { ok: false, reason: 'GPS 位置移動太短' };

    return { ok: true, meters: d, break: false };
  }

  const api = { distance, calories, accept, analyzeTrack };
  if (typeof module !== 'undefined') module.exports = api;
  else root.MoveCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
