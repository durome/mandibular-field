/**
 * EDUARDO ROMAGUERA (2026)
 * Mandibular Field — Coherence & Repair (Visual)
 *
 * Experiencia audiovisual generativa adaptativa al territorio.
 * Nota: obra/experiencia artística (no es dispositivo médico).
 *
 * Incluye:
 * - Territorio vivo: geolocalización (opcional) + Open-Meteo
 * - Variantes de movimiento por temperatura (cada click = variante nueva)
 * - “Química simbólica” (hidratación/energía/estrés/redox/pH como metáfora)
 * - Audio seguro: carrier + subgrave + ruido + AM proxy 1–20 Hz (traducción perceptiva)
 *
 * PARCHE AUDIO (p5.js):
 * - mousePressed() async con ctx.resume()
 * - beep 440Hz de confirmación
 * - estado AudioContext en HUD
 * - master.amp más alto para pruebas
 */

let particles = [];
let started = false;
let paused = false;

const TITLE = "Mandibular Field — Coherence & Repair (Visual)";
const SIGN_LINE_1 = "EDUARDO ROMAGUERA (2026)";
const SIGN_LINE_2 = "regeneración celular"; // conceptual/poético

// ===================== VISUAL / TIEMPO =====================
let intensity = 0.68; // ↑/↓
let cohesion = 0.0;
const MAX_PARTICLES_BASE = 720;
const SESSION_SECONDS = 120;
const BREATH_HZ = 0.1;

let sessionStartMs = 0;

// ===================== TERRITORIO =====================
let territory = {
  lat: 39.47, lon: -0.38, hasGeo: false,
  temp: 20, humidity: 55, wind: 2, solar: 300,
  densityMul: 1.0, driftMul: 1.0,
  toneBase: 174, subBase: 38, noiseAmp: 0.008
};

// ===================== QUÍMICA SIMBÓLICA =====================
let chemicalMode = true;
let chem = {
  hydration: 0.6, // 0..1
  energy: 0.5,    // 0..1
  stress: 0.3,    // 0..1
  redox: 0.5,     // 0..1
  pH: 7.0         // simbólico
};

// ===================== VARIANTES POR TEMPERATURA =====================
let variantSeed = 1;
let motionMode = 0;     // 0..3
let flowScale = 0.002;
let swirl = 0.6;
let jitter = 0.2;
let snapToLocus = 1.0;

// ===================== AUDIO =====================
let master, comp;
let carrierOsc, subOsc, airNoise;

// AM proxy 1–20 Hz (traducción perceptiva en altavoces)
let amCarrierOsc = null;
let amCarrierGain = null;
let _amParams = null;

// ===================== SETUP / DRAW =====================

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  initParticles(MAX_PARTICLES_BASE);
  requestTerritory();
}

function draw() {
  background(0, 28);

  if (!started) {
    drawStartScreen();
    drawSignature();
    return;
  }
  if (paused) {
    drawPaused();
    drawSignature();
    return;
  }

  const t = (millis() - sessionStartMs) / 1000;
  const progress = constrain(t / SESSION_SECONDS, 0, 1);
  cohesion = easeInOut(progress) * intensity;

  const breath = (sin(TWO_PI * BREATH_HZ * t - HALF_PI) + 1) * 0.5;

  const locus = mandibleLocus(breath);

  drawMandibleArc(breath, cohesion);
  drawGingivalMist(breath, cohesion);
  drawChemicalLightLayer(breath, cohesion);

  const targetCount = Math.floor(MAX_PARTICLES_BASE * territory.densityMul);
  adjustParticleCount(targetCount);

  for (const p of particles) {
    p.update(locus, breath, cohesion);
    p.render(cohesion);
  }

  if (progress >= 1) drawCompletionGlow();

  updateAudio(t, breath, cohesion);
  updateInfrasoundProxy();

  drawHUD(t);
  drawSignature();
}

// ✅ PARCHE: mousePressed async + resume()
async function mousePressed() {
  const ctx = getAudioContext();
  if (ctx.state !== "running") {
    await ctx.resume();
  }

  if (!started) {
    started = true;
    paused = false;
    sessionStartMs = millis();

    // Variante inicial
    reseedVariant();

    // Audio
    initAudio();

    setTimeout(() => {
      fadeOutAudio();
      stopInfrasoundProxy();
    }, SESSION_SECONDS * 1000);

    return;
  }

  // Clicks posteriores: nueva variante visual
  if (!paused) reseedVariant();
}

function keyPressed() {
  if (key === ' ') {
    if (!started) return;
    paused = !paused;
    if (paused) fadeOutAudio();
    else fadeInAudio();
  }
  if (key === 'r' || key === 'R') {
    initParticles(Math.floor(MAX_PARTICLES_BASE * territory.densityMul));
    sessionStartMs = millis();
  }
  if (keyCode === UP_ARROW) intensity = constrain(intensity + 0.05, 0, 1);
  if (keyCode === DOWN_ARROW) intensity = constrain(intensity - 0.05, 0, 1);

  if (key === 'c' || key === 'C') chemicalMode = !chemicalMode;
  if (key === 'v' || key === 'V') reseedVariant();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ===================== UI / FIRMA =====================

function drawStartScreen() {
  background(0);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text(TITLE, width / 2, height / 2 - 28);

  textSize(13);
  fill(190);
  const geoMsg = territory.hasGeo
    ? "Territorio: geolocalización activa"
    : "Territorio: valores por defecto (sin geolocalización)";

  text(
    "Click para iniciar (audio requiere interacción)\n" +
    geoMsg + "\n" +
    "Espacio: pausar · R: reiniciar · ↑/↓: intensidad · C: química · V: variante",
    width / 2, height / 2 + 34
  );
}

function drawPaused() {
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("Pausado — pulsa ESPACIO", width / 2, height / 2);
}

function drawHUD(t) {
  const secLeft = max(0, ceil(SESSION_SECONDS - t));
  const ctxState = getAudioContext().state;

  fill(255, 140);
  textAlign(LEFT, TOP);
  textSize(12);

  const modeName = ["lattice", "laminar", "swirl", "burst"][motionMode] || "mix";

  text(
    `AudioContext: ${ctxState}\n` +
    `Tiempo: ${secLeft}s · Cohesión: ${cohesion.toFixed(2)} · Int: ${intensity.toFixed(2)} · Var: ${modeName}\n` +
    `Temp: ${Math.round(territory.temp)}°C  Hum: ${Math.round(territory.humidity)}%  Viento: ${territory.wind.toFixed(1)}m/s  Solar: ${Math.round(territory.solar)}W/m²\n` +
    (chemicalMode
      ? `Química simbólica → Hyd:${chem.hydration.toFixed(2)}  Redox:${chem.redox.toFixed(2)}  pH:${chem.pH.toFixed(2)}`
      : `Química simbólica desactivada`),
    16, 16
  );
}

function drawSignature() {
  push();
  textAlign(RIGHT, BOTTOM);
  textSize(11);
  noStroke();
  const alpha = 115 + 35 * sin(frameCount * 0.01);
  fill(255, alpha);
  text(SIGN_LINE_1, width - 14, height - 28);
  fill(200, alpha * 0.75);
  text(SIGN_LINE_2, width - 14, height - 14);
  pop();
}

// ===================== TERRITORIO: GEO + METEO =====================

function requestTerritory() {
  if (!navigator.geolocation) {
    deriveTerritoryParams();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      territory.lat = pos.coords.latitude;
      territory.lon = pos.coords.longitude;
      territory.hasGeo = true;
      fetchWeather();
    },
    () => {
      territory.hasGeo = false;
      deriveTerritoryParams();
    },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 600000 }
  );
}

async function fetchWeather() {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${territory.lat}&longitude=${territory.lon}` +
      `&current=temperature_2m,wind_speed_10m,relative_humidity_2m,shortwave_radiation`;
    const r = await fetch(url);
    const data = await r.json();
    const c = data.current || {};

    territory.temp = c.temperature_2m ?? territory.temp;
    territory.wind = c.wind_speed_10m ?? territory.wind;
    territory.humidity = c.relative_humidity_2m ?? territory.humidity;
    territory.solar = (c.shortwave_radiation ?? territory.solar) || 1;

    deriveTerritoryParams();
  } catch (e) {
    deriveTerritoryParams();
  }
}

function deriveTerritoryParams() {
  const tempN = constrain(map(territory.temp, -5, 35, 0, 1), 0, 1);
  const humN  = constrain(map(territory.humidity, 10, 90, 0, 1), 0, 1);
  const windN = constrain(map(territory.wind, 0, 18, 0, 1), 0, 1);
  const solN  = constrain(map(territory.solar, 0, 900, 0, 1), 0, 1);

  territory.densityMul = lerp(0.85, 1.25, humN) * lerp(1.15, 0.9, windN);
  territory.driftMul   = lerp(0.85, 1.25, windN) * lerp(0.95, 1.10, solN);

  territory.toneBase = lerp(164, 220, tempN) * lerp(0.95, 1.05, humN);
  territory.subBase = lerp(28, 58, solN) * lerp(0.95, 1.05, windN);
  territory.noiseAmp = lerp(0.004, 0.014, windN);

  deriveChemicalLayer();
}

// ===================== QUÍMICA SIMBÓLICA =====================

function deriveChemicalLayer() {
  const humN  = constrain(map(territory.humidity, 10, 90, 0, 1), 0, 1);
  const solN  = constrain(map(territory.solar, 0, 900, 0, 1), 0, 1);
  const windN = constrain(map(territory.wind, 0, 18, 0, 1), 0, 1);
  const tempN = constrain(map(territory.temp, -5, 35, 0, 1), 0, 1);

  chem.hydration = constrain(0.65 * humN + 0.35 * (1 - abs(tempN - 0.55)), 0, 1);
  chem.energy = solN;
  chem.stress = windN;

  chem.redox = constrain(0.55 * chem.energy + 0.25 * chem.hydration - 0.35 * chem.stress + 0.25, 0, 1);

  chem.pH = 7.0 + (chem.redox - 0.5) * 0.8 - (chem.stress - 0.5) * 0.6;
  chem.pH = constrain(chem.pH, 6.2, 7.8);
}

function drawChemicalLightLayer(breath, coh) {
  if (!chemicalMode) return;

  push();
  blendMode(ADD);
  noStroke();

  const glow = (0.25 + 0.55 * chem.hydration + 0.35 * coh) * (1.0 - 0.35 * chem.stress);
  const pulse = lerp(0.75, 1.15, breath);

  const c1a = 10 + 40 * glow * pulse;
  fill(80, 220, 255, c1a);
  ellipse(width * 0.5, height * 0.55, width * 0.9, height * 0.55);

  const c2a = 8 + 30 * glow;
  fill(120, 180, 255, c2a);
  ellipse(width * 0.5, height * 0.68, width * 0.75, height * 0.40);

  blendMode(BLEND);
  pop();
}

// ===================== VARIANTES POR TEMPERATURA =====================

function reseedVariant() {
  variantSeed = Math.floor(random(1e9));
  randomSeed(variantSeed);
  noiseSeed(variantSeed);

  const tempN = constrain(map(territory.temp, -5, 35, 0, 1), 0, 1);
  const r = random();

  if (tempN < 0.35) motionMode = (r < 0.5) ? 0 : 1;
  else if (tempN < 0.7) motionMode = (r < 0.5) ? 1 : 2;
  else motionMode = (r < 0.5) ? 2 : 3;

  flowScale = lerp(0.0016, 0.0032, tempN);
  swirl     = lerp(0.35, 1.10, tempN);
  jitter    = lerp(0.08, 0.38, tempN);
  snapToLocus = lerp(1.20, 0.85, tempN);

  initParticles(Math.floor(MAX_PARTICLES_BASE * territory.densityMul));
  sessionStartMs = millis();
}

// ===================== VISUAL BASE =====================

function mandibleLocus(breath) {
  return createVector(width / 2, lerp(height * 0.62, height * 0.58, breath));
}

function drawMandibleArc(breath, coh) {
  const cx = width / 2;
  const cy = height * 0.68;
  const w = lerp(width * 0.42, width * 0.50, breath);
  const h = lerp(height * 0.18, height * 0.23, breath);
  const a = lerp(25, 95, coh);

  noFill();
  stroke(120, 190, 255, a);
  strokeWeight(2);

  beginShape();
  for (let ang = PI * 0.1; ang <= PI * 0.9; ang += 0.03) {
    vertex(cx + cos(ang) * w, cy + sin(ang) * h);
  }
  endShape();

  stroke(180, 255, 200, a * 0.65);
  strokeWeight(1.5);

  beginShape();
  for (let ang = PI * 0.12; ang <= PI * 0.88; ang += 0.03) {
    vertex(cx + cos(ang) * (w * 0.82), cy + sin(ang) * (h * 0.82) - 14);
  }
  endShape();

  noStroke();
}

function drawGingivalMist(breath, coh) {
  push();
  blendMode(ADD);
  noStroke();

  const humN = constrain(map(territory.humidity, 10, 90, 0, 1), 0, 1);
  const mistA = lerp(6, 22, coh) * lerp(0.8, 1.1, humN);

  const cx = width / 2;
  const cy = lerp(height * 0.56, height * 0.54, breath);

  for (let i = 0; i < 6; i++) {
    const rx = (width * 0.30) + i * 80;
    const ry = (height * 0.10) + i * 35;
    fill(120, 220, 255, mistA);
    ellipse(cx, cy, rx, ry);
  }

  blendMode(BLEND);
  pop();
}

function drawCompletionGlow() {
  push();
  blendMode(ADD);
  noStroke();
  const cx = width / 2;
  const cy = height * 0.62;
  for (let i = 0; i < 5; i++) {
    fill(120, 120, 255, 12);
    ellipse(cx, cy, 180 + i * 80, (180 + i * 80) * 0.55);
  }
  blendMode(BLEND);
  pop();
}

// ===================== PARTICULAS =====================

function initParticles(n) {
  particles = [];
  for (let i = 0; i < n; i++) particles.push(new Particle());
}

function adjustParticleCount(target) {
  target = constrain(target, 350, 1100);
  if (particles.length < target) {
    const add = min(12, target - particles.length);
    for (let i = 0; i < add; i++) particles.push(new Particle());
  } else if (particles.length > target) {
    particles.splice(0, min(12, particles.length - target));
  }
}

class Particle {
  constructor() {
    this.pos = createVector(random(width), random(height));
    this.vel = p5.Vector.random2D().mult(random(0.2, 1.2));
    this.seed = random(1000);
    this.life = random(0.4, 1.0);
  }

  update(locus, breath, coh) {
    const n = noise(
      this.pos.x * flowScale,
      this.pos.y * flowScale,
      (this.seed + variantSeed * 0.000001) + frameCount * 0.002
    );

    const ang = n * TWO_PI * 2.0;
    let flowDir = createVector(cos(ang), sin(ang));

    if (motionMode === 0) {
      const steps = 8;
      const q = Math.round((ang / TWO_PI) * steps) / steps;
      flowDir = createVector(cos(q * TWO_PI), sin(q * TWO_PI));
    } else if (motionMode === 2) {
      flowDir.rotate(swirl * 0.35);
    } else if (motionMode === 3) {
      const tt = (millis() - sessionStartMs) / 1000;
      const pulse = (sin(TWO_PI * BREATH_HZ * tt - HALF_PI) + 1) * 0.5;
      flowDir.mult(lerp(0.6, 1.35, pulse));
    }

    flowDir.add(p5.Vector.random2D().mult(jitter * 0.15));
    flowDir.mult(0.33 * territory.driftMul);

    const toCenter = p5.Vector.sub(locus, this.pos);
    const d = max(40, toCenter.mag());
    toCenter.normalize();

    let orderStrength = (0.12 + 1.55 * coh) * (1 / (d / 180)) * snapToLocus;
    if (motionMode === 0) orderStrength *= 1.15;
    if (motionMode === 3) orderStrength *= 0.95;

    const order = toCenter.mult(orderStrength);
    const accel = p5.Vector.lerp(flowDir, order, coh);

    this.vel.add(accel);

    const speedPulse = lerp(0.7, 1.2, breath) * lerp(0.9, 1.15, chem.energy);
    this.vel.limit(2.35 * speedPulse);

    this.pos.add(this.vel);

    if (this.pos.x < -20) this.pos.x = width + 20;
    if (this.pos.x > width + 20) this.pos.x = -20;
    if (this.pos.y < -20) this.pos.y = height + 20;
    if (this.pos.y > height + 20) this.pos.y = -20;
  }

  render(coh) {
    const a = lerp(16, 82, coh) * this.life;
    const s = lerp(1.1, 2.7, coh) * this.life;

    noStroke();
    fill(120, 190, 255, a);
    circle(this.pos.x, this.pos.y, s);

    if (coh > 0.28 && frameCount % int(lerp(26, 10, coh)) === 0) {
      stroke(180, 255, 200, a * 0.55);
      strokeWeight(1);
      const v = this.vel.copy().mult(7);
      line(this.pos.x, this.pos.y, this.pos.x + v.x, this.pos.y + v.y);
      noStroke();
    }

    if (chemicalMode && coh > 0.25) {
      const linkChance = 0.02 + 0.05 * chem.hydration + 0.04 * chem.redox;
      if (random() < linkChance) {
        stroke(200, 255, 220, 18 + 45 * coh);
        strokeWeight(1);
        const v = this.vel.copy().mult(10 + 8 * chem.energy);
        line(this.pos.x, this.pos.y, this.pos.x + v.x, this.pos.y + v.y);
        noStroke();
      }
    }
  }
}

// ===================== AUDIO =====================

function initAudio() {
  userStartAudio();

  master = new p5.Gain();
  master.amp(0.22); // ✅ más alto para prueba (luego baja a 0.14–0.18)

  comp = new p5.Compressor();
  comp.threshold(-24);
  comp.ratio(6);
  comp.attack(0.003);
  comp.release(0.25);

  master.connect(comp);
  comp.connect();

  carrierOsc = new p5.Oscillator('sine');
  carrierOsc.freq(territory.toneBase);
  carrierOsc.disconnect();
  carrierOsc.connect(master);
  carrierOsc.amp(0);
  carrierOsc.start();

  subOsc = new p5.Oscillator('sine');
  subOsc.freq(territory.subBase);
  subOsc.disconnect();
  subOsc.connect(master);
  subOsc.amp(0);
  subOsc.start();

  airNoise = new p5.Noise('pink');
  airNoise.disconnect();
  airNoise.connect(master);
  airNoise.amp(0);
  airNoise.start();

  startInfrasoundProxy({
    lfoHz: pickLfoHzFromTerritory(),
    carrierHz: pickCarrierHzFromTerritory(),
    depth: 0.78,
    baseAmp: 0.10 // ✅ más alto para prueba
  });

  // ✅ Beep confirmación (si lo oyes, initAudio se ejecutó bien)
  let test = new p5.Oscillator("sine");
  test.freq(440);
  test.disconnect();
  test.connect(master);
  test.amp(0);
  test.start();
  test.amp(0.12, 0.02);
  setTimeout(() => {
    test.amp(0, 0.08);
    setTimeout(() => test.stop(), 120);
  }, 250);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      fadeOutAudio();
      stopInfrasoundProxy();
    }
  });
}

function fadeOutAudio() {
  if (!carrierOsc) return;
  carrierOsc.amp(0, 0.2);
  subOsc.amp(0, 0.2);
  airNoise.amp(0, 0.2);
}

function fadeInAudio() {
  if (!carrierOsc) return;
  carrierOsc.amp(0.02, 0.2);
}

function updateAudio(t, breath, coh) {
  if (!carrierOsc || paused) return;

  const baseTone = territory.toneBase;
  const subF = territory.subBase;

  const solN = constrain(map(territory.solar, 0, 900, 0, 1), 0, 1);
  const drift = 5 * sin(TWO_PI * 0.02 * t) * lerp(0.7, 1.15, solN);

  carrierOsc.freq(baseTone + drift, 0.06);
  subOsc.freq(subF + (drift * 0.15), 0.08);

  const windN = constrain(map(territory.wind, 0, 18, 0, 1), 0, 1);
  const lfoHz = lerp(0.05, 0.18, windN);
  const lfoValue = (sin(TWO_PI * lfoHz * t - HALF_PI) + 1) * 0.5;

  const breathAmp = lerp(0.01, 0.06, breath) * lerp(0.65, 1.0, coh);
  const carrierAmp = breathAmp * (0.75 + 0.25 * lfoValue);

  const subAmp = (0.008 + 0.018 * coh) * (0.7 + 0.3 * lfoValue);

  carrierOsc.amp(carrierAmp, 0.08);
  subOsc.amp(subAmp, 0.12);
  airNoise.amp(territory.noiseAmp * (0.4 + 0.6 * lfoValue) * (0.6 + 0.6 * coh), 0.12);

  if (frameCount % 120 === 0 && _amParams) {
    _amParams.lfoHz = pickLfoHzFromTerritory();
    _amParams.carrierHz = pickCarrierHzFromTerritory();
    if (amCarrierOsc) amCarrierOsc.freq(_amParams.carrierHz, 0.2);
  }
}

function pickLfoHzFromTerritory() {
  const windN = constrain(map(territory.wind, 0, 18, 0, 1), 0, 1);
  const humN = constrain(map(territory.humidity, 10, 90, 0, 1), 0, 1);
  const hz = lerp(3, 14, windN) * lerp(0.9, 1.1, humN);
  return constrain(hz, 1, 20);
}

function pickCarrierHzFromTerritory() {
  const solN = constrain(map(territory.solar, 0, 900, 0, 1), 0, 1);
  return constrain(lerp(62, 88, solN), 50, 110);
}

// ===================== AM PROXY 1–20 Hz =====================

function startInfrasoundProxy({ lfoHz = 8, carrierHz = 80, depth = 0.6, baseAmp = 0.06 } = {}) {
  lfoHz = constrain(lfoHz, 1, 20);
  carrierHz = constrain(carrierHz, 40, 140);
  depth = constrain(depth, 0, 1);
  baseAmp = constrain(baseAmp, 0.0, 0.18);

  stopInfrasoundProxy();

  amCarrierGain = new p5.Gain();
  amCarrierGain.amp(0, 0.1);

  if (master) amCarrierGain.connect(master);
  else amCarrierGain.connect();

  amCarrierOsc = new p5.Oscillator("sine");
  amCarrierOsc.freq(carrierHz);
  amCarrierOsc.disconnect();
  amCarrierOsc.connect(amCarrierGain);
  amCarrierOsc.amp(1);
  amCarrierOsc.start();

  _amParams = { lfoHz, carrierHz, depth, baseAmp, startMs: millis() };
  amCarrierGain.amp(baseAmp, 0.3);
}

function updateInfrasoundProxy() {
  if (!_amParams || !amCarrierGain || paused) return;

  const t = (millis() - _amParams.startMs) / 1000;
  const lfo = (sin(TWO_PI * _amParams.lfoHz * t - HALF_PI) + 1) * 0.5;

  const g = _amParams.baseAmp * ((1 - _amParams.depth) + _amParams.depth * lfo);
  amCarrierGain.amp(g, 0.03);
}

function stopInfrasoundProxy() {
  if (amCarrierGain) amCarrierGain.amp(0, 0.2);
  if (amCarrierOsc) {
    try { amCarrierOsc.stop(); } catch (e) {}
  }
  amCarrierOsc = null;
  amCarrierGain = null;
  _amParams = null;
}

// ===================== UTIL =====================

function easeInOut(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2;
}
