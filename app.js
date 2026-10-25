const MAP_CONFIG = {
  center: [25.0175, 121.5398],
  zoom: 16,
  minZoom: 14,
  maxZoom: 19
};

const CAMPUS_PRESETS = [
  {
    id: "main-loop",
    name: "椰林大道路線",
    desc: "平坦筆直，適合新手配速與漸速跑練習。",
    difficulty: "入門",
    distanceKm: 2.4,
    points: [
      [25.0172, 121.5342],
      [25.0174, 121.5375],
      [25.0175, 121.5412],
      [25.0176, 121.5448],
      [25.0163, 121.5446],
      [25.0162, 121.5398],
      [25.0165, 121.5345]
    ]
  },
  {
    id: "lake-loop",
    name: "生態池環湖步道",
    desc: "彎道多，微幅上下起伏，夜跑景觀極佳。",
    difficulty: "中階",
    distanceKm: 3.6,
    points: [
      [25.0142, 121.5378],
      [25.0135, 121.5401],
      [25.0128, 121.5422],
      [25.0138, 121.5435],
      [25.0151, 121.5428],
      [25.0156, 121.5399],
      [25.0146, 121.5381]
    ]
  },
  {
    id: "challenge-loop",
    name: "校園外環長距離",
    desc: "長距離節奏跑，模擬路跑賽道配速。",
    difficulty: "進階",
    distanceKm: 5.1,
    points: [
      [25.0215, 121.5352],
      [25.0212, 121.5438],
      [25.0176, 121.5458],
      [25.0125, 121.5442],
      [25.0118, 121.5379],
      [25.0148, 121.5341],
      [25.0192, 121.5346]
    ]
  }
];

const state = {
  map: null,
  drawLayer: null,
  routeLayer: null,
  userLayer: null,
  drawnPoints: [],
  activePresetId: CAMPUS_PRESETS[0].id,
  targetDistanceKm: CAMPUS_PRESETS[0].distanceKm,
  targetPaceSec: 330,
  trackingWatchId: null,
  trackedRoute: [],
  isTracking: false
};

const dom = {
  targetDistance: document.getElementById("targetDistance"),
  targetPace: document.getElementById("targetPace"),
  targetTimeDisplay: document.getElementById("targetTimeDisplay"),
  presetSelect: document.getElementById("presetSelect"),
  applyPresetBtn: document.getElementById("applyPresetBtn"),
  clearRouteBtn: document.getElementById("clearRouteBtn"),
  exportCsvBtn: document.getElementById("exportCsvBtn"),
  exportMetricsCsvBtn: document.getElementById("exportMetricsCsvBtn"),
  startTrackBtn: document.getElementById("startTrackBtn"),
  stopTrackBtn: document.getElementById("stopTrackBtn"),
  clearTrackBtn: document.getElementById("clearTrackBtn"),
  plannedDistance: document.getElementById("plannedDistance"),
  estimatedDuration: document.getElementById("estimatedDuration"),
  requiredPace: document.getElementById("requiredPace"),
  splitTableBody: document.getElementById("splitTableBody"),
  trackingStatus: document.getElementById("trackingStatus"),
  trackedPointsCount: document.getElementById("trackedPointsCount"),
  trackingAccuracy: document.getElementById("trackingAccuracy")
};

// ==================== 距離演算法工具 ====================

/**
 * 計算兩點經緯度之球面直線距離 (Haversine 公式)
 * @returns {number} 距離 (公里)
 */
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半徑 (km)
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==================== 初始化 ====================

function init() {
  initMap();
  populatePresets();
  bindEvents();
  applyPreset(state.activePresetId);
  updateCalculations();
}

function initMap() {
  state.map = L.map("map").setView(MAP_CONFIG.center, MAP_CONFIG.zoom);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(state.map);

  state.drawLayer = L.featureGroup().addTo(state.map);
  state.routeLayer = L.featureGroup().addTo(state.map);
  state.userLayer = L.featureGroup().addTo(state.map);

  state.map.on("click", onMapClick);
}

function populatePresets() {
  dom.presetSelect.innerHTML = CAMPUS_PRESETS.map(
    (preset) => `<option value="${preset.id}">${preset.name}（${preset.distanceKm} km / ${preset.difficulty}）</option>`
  ).join("");
}

function bindEvents() {
  dom.targetDistance.addEventListener("input", () => {
    state.targetDistanceKm = parseFloat(dom.targetDistance.value) || 0;
    updateCalculations();
  });

  dom.targetPace.addEventListener("change", () => {
    state.targetPaceSec = parseInt(dom.targetPace.value, 10);
    updateCalculations();
  });

  dom.applyPresetBtn.addEventListener("click", () => {
    applyPreset(dom.presetSelect.value);
  });

  dom.clearRouteBtn.addEventListener("click", clearDrawnRoute);
  dom.exportCsvBtn.addEventListener("click", exportRouteAsCsv);
  dom.exportMetricsCsvBtn.addEventListener("click", exportMetricsAsCsv);

  dom.startTrackBtn.addEventListener("click", startGpsTracking);
  dom.stopTrackBtn.addEventListener("click", stopGpsTracking);
  dom.clearTrackBtn.addEventListener("click", clearTrackedRoute);
}

function onMapClick(e) {
  const latlng = [e.latlng.lat, e.latlng.lng];
  state.drawnPoints.push(latlng);
  renderDrawnRoute();

  const measuredKm = calculatePointsDistance(state.drawnPoints);
  if (measuredKm > 0) {
    state.targetDistanceKm = parseFloat(measuredKm.toFixed(2));
    dom.targetDistance.value = state.targetDistanceKm;
    updateCalculations();
  }
}

function renderDrawnRoute() {
  state.drawLayer.clearLayers();

  if (state.drawnPoints.length === 0) return;

  state.drawnPoints.forEach((pt, index) => {
    const isStart = index === 0;
    const isEnd = index === state.drawnPoints.length - 1 && state.drawnPoints.length > 1;

    const marker =
