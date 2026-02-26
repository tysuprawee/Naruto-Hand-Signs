import * as THREE from 'three';
import { SelfieSegmentation } from "@mediapipe/selfie_segmentation";
import { FaceLandmarker, HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { CROW_BRUSH_INDEX, getMoveById } from './moves';
import { bindSlider, createSettingsPanels, PRESET_SYNC_SLIDER_IDS } from './settings-panel';
import './style.css';

const moveId = document.body.dataset.moveId;
const activeMove = getMoveById(moveId);
const PRESET_STORAGE_KEY = `particle_preset_${activeMove.id}`;
const particlesEnabled = activeMove.particlesEnabled !== false;
const useLandmarkers = activeMove.useLandmarkers !== false;
const useForegroundSegmentation = activeMove.useForegroundSegmentation !== false;
const shadowCloneConfig = activeMove.shadowClone ?? null;
const isShadowCloneMove = Boolean(shadowCloneConfig);
const rasenganConfig = activeMove.rasengan ?? null;
const isRasenganMove = Boolean(rasenganConfig);
const lockedBrushIndex = activeMove.lockedBrushIndex ?? CROW_BRUSH_INDEX;
const triggerMode = activeMove.triggerMode ?? 'manual';
const isManualTrigger = triggerMode === 'manual';
const isChargedTrigger = triggerMode === 'charged';
const manualTriggerLabel = activeMove.triggerButtonLabel ?? 'Trigger Skill';
const manualDisableLabel = activeMove.disableButtonLabel ?? 'Disable Skill';
let manualSkillActive = !isManualTrigger;
let manualTriggerStartTime = 0;
let shadowBlinkSettlePending = false;
let shadowBlinkPhasePrev = null;
let updateTriggerSkillButton = () => {};
document.title = `${activeMove.name} | Particle Moves`;

function didPassPhase(prevPhase, currentPhase, targetPhase) {
  if (prevPhase === null || prevPhase === undefined) {
    return false;
  }

  if (prevPhase <= currentPhase) {
    return prevPhase <= targetPhase && targetPhase <= currentPhase;
  }

  return prevPhase <= targetPhase || targetPhase <= currentPhase;
}

// DOM Elements
const video = document.getElementById('webcam');
const bgImage = document.getElementById('bg-image');
const eyesImg = new Image();
eyesImg.src = '/eyes.png';
const smokeFrames = [];
const SMOKE_BASE_NAME = '/smoke/cf7378e5-58a9-4967-af50-904b2d11ecdd-';
const SMOKE_FRAME_START = 0;
const SMOKE_FRAME_END = 55;
const bloodFrames = [];
const bloodBaseName = '/eyeblood/f4aa41aa-86ca-4142-a969-2024f75bdf7b-';
const BLOOD_FRAME_RATE = 24;
for (let i = 11; i <= 199; i++) {
  const img = new Image();
  img.src = `${bloodBaseName}${i}.png`;
  bloodFrames.push(img);
}
const BLOOD_LAST_FRAME_INDEX = bloodFrames.length - 1;
const appContainer = document.getElementById('app');

if (isShadowCloneMove) {
  video.style.opacity = '1';
  bgImage.style.opacity = '0';

  for (let i = SMOKE_FRAME_START; i <= SMOKE_FRAME_END; i++) {
    const img = new Image();
    img.src = `${SMOKE_BASE_NAME}${i}.png`;
    smokeFrames.push(img);
  }
}

// Three.js Setup
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.0);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 50;

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
appContainer.appendChild(renderer.domElement);

const sceneFront = new THREE.Scene();
sceneFront.fog = new THREE.FogExp2(0x000000, 0.0);

const rendererFront = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
rendererFront.setSize(window.innerWidth, window.innerHeight);
rendererFront.setPixelRatio(Math.min(window.devicePixelRatio, 2));
rendererFront.domElement.id = 'app-front';
rendererFront.domElement.style.position = 'absolute';
rendererFront.domElement.style.top = '0';
rendererFront.domElement.style.left = '0';
rendererFront.domElement.style.width = '100vw';
rendererFront.domElement.style.height = '100vh';
rendererFront.domElement.style.zIndex = '4';
rendererFront.domElement.style.pointerEvents = 'none';
document.body.appendChild(rendererFront.domElement);

const MAX_PARTICLES = 50000;

// Arrays for performant updates
const basePosArray = new Float32Array(MAX_PARTICLES * 3);
const posArray = new Float32Array(MAX_PARTICLES * 3);
const baseColorsArray = new Float32Array(MAX_PARTICLES * 3);
const shiftedColorsArray = new Float32Array(MAX_PARTICLES * 3);
const phaseArray = new Float32Array(MAX_PARTICLES);

// Generate random points on a sphere volume
for (let i = 0; i < MAX_PARTICLES; i++) {
  const ix = i * 3;
  const r = 80 * Math.cbrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const phi = Math.acos(2 * Math.random() - 1);

  basePosArray[ix] = r * Math.sin(phi) * Math.cos(theta);
  basePosArray[ix + 1] = r * Math.sin(phi) * Math.sin(theta);
  basePosArray[ix + 2] = r * Math.cos(phi);

  posArray[ix] = basePosArray[ix];
  posArray[ix + 1] = basePosArray[ix + 1];
  posArray[ix + 2] = basePosArray[ix + 2];

  phaseArray[i] = Math.random() * Math.PI * 2;

  // Premium look - cyan / purple / pink mix
  const colorType = Math.random();
  let cr, cg, cb;
  if (colorType > 0.6) {
    cr = 0.1; cg = Math.random() * 0.5 + 0.5; cb = 1.0;
  } else if (colorType > 0.3) {
    cr = 1.0; cg = Math.random() * 0.2 + 0.1; cb = Math.random() * 0.5 + 0.5;
  } else {
    cr = 0.8 + Math.random() * 0.2; cg = 0.8 + Math.random() * 0.2; cb = 1.0;
  }

  baseColorsArray[ix] = cr; baseColorsArray[ix + 1] = cg; baseColorsArray[ix + 2] = cb;
  shiftedColorsArray[ix] = cr; shiftedColorsArray[ix + 1] = cg; shiftedColorsArray[ix + 2] = cb;
}

// Textures
function getCircleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// --- SETTINGS STATE ---
const BASE_PARAMS = {
  brushIndex: lockedBrushIndex,
  amount: 10000,
  frontAmount: 1500,
  size: 2.0,
  opacity: 0.8,
  overallScale: 1.0,
  handDistanceOverallControl: 0.0,
  handDistanceOverallInvert: false,
  spread: 1.0,
  spinSpeed: 1.0,
  noiseStrength: 0.0,
  noiseSpeed: 1.0,
  mouseForce: 0.05,
  handIntensity: 1.0,
  handSpreadControl: 1.0,
  handSizeControl: 1.0,
  handForeOffsetForward: 0.18,
  handForeOffsetSide: 0.0,
  hue: 0.0,
  saturation: 1.0,
  brightness: 1.0,
  twinkle: 0.0,
  fog: 0.0,
  loopSpeed: 5.0,
  animOffset: 5.0, // New param for Time Shift!
  closeBlur: 0.0,
  additive: true,
  bloodScaleW: 4.5,
  bloodScaleH: 4.5,
  bloodOffsetX: 0.0,
  bloodOffsetY: -0.1,
  bloodEnabled: true,
  bloodBend: 0.0,
  bloodDarkness: 1.0,
  bloodLightness: 1.0,
  eyeBlend: 0.65,
  eyeShadow: 0.4,
  eyeLight: 0.95,
  eyeGlow: 0.6,
  eyeReflect: 0.35
};

const DEFAULT_PARAMS = {
  ...BASE_PARAMS,
  ...activeMove.preset,
  brushIndex: lockedBrushIndex
};

let savedParams = null;
try {
  const rawPreset = localStorage.getItem(PRESET_STORAGE_KEY);
  savedParams = rawPreset ? JSON.parse(rawPreset) : null;
} catch (error) {
  savedParams = null;
}
let params = savedParams
  ? { ...DEFAULT_PARAMS, ...savedParams, brushIndex: lockedBrushIndex }
  : { ...DEFAULT_PARAMS };
params.handDistanceOverallInvert = Boolean(params.handDistanceOverallInvert);

const textureLoader = new THREE.TextureLoader();
const brushes = [
  { name: 'Default Glow', maps: [getCircleTexture()] },
  { name: 'Cloud', maps: [textureLoader.load('/cloud.png')] },
  { name: 'Fire', maps: [textureLoader.load('/fire.png')] },
  { name: 'Fire 2', maps: [textureLoader.load('/fire2.png')] },
  { name: 'Crow', maps: [textureLoader.load('/crow.png'), textureLoader.load('/crow2.png')] }
];
let currentBrushIndex = lockedBrushIndex;

// --- DYNAMIC MESH LAYERS ---
// To support animating independent points seamlessly, we create multiple meshes
// that share the same fast Position buffer but possess unique Color (Alpha) buffers!
const MAX_FRAMES = 2; // Supported animation frames
const layerColors = [];
const layerMeshes = [];
const layerMeshesFront = [];
const particlesGroup = new THREE.Group();
const particlesGroupFront = new THREE.Group();
scene.add(particlesGroup);
sceneFront.add(particlesGroupFront);
const sharedPositionAttribute = new THREE.BufferAttribute(posArray, 3);

const closeBlurUniform = { value: params.closeBlur };

for (let j = 0; j < MAX_FRAMES; j++) {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', sharedPositionAttribute);

  const colArray = new Float32Array(MAX_PARTICLES * 4); // RGBA to allow hiding points via alpha
  geom.setAttribute('color', new THREE.BufferAttribute(colArray, 4));
  layerColors.push(colArray);

  const mat = new THREE.PointsMaterial({
    size: params.size,
    map: brushes[currentBrushIndex].maps[0], // Assigned properly in animation loop
    vertexColors: true,
    transparent: true,
    opacity: params.opacity,
    blending: params.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: false
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uCloseBlur = closeBlurUniform;

    shader.vertexShader = `varying float vCamDist;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      `#include <project_vertex>`,
      `#include <project_vertex>\n      vCamDist = -mvPosition.z;`
    );

    shader.fragmentShader = `uniform float uCloseBlur;\nvarying float vCamDist;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <map_particle_fragment>`,
      `
      #if defined( USE_MAP ) || defined( USE_ALPHAMAP )
        vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
      #endif
      #ifdef USE_MAP
        // Blur particles that get extremely close to the camera (< 40 units)
        float blurLevel = smoothstep(40.0, 10.0, vCamDist) * uCloseBlur;
        if (blurLevel > 0.001) {
          vec4 texColor = vec4(0.0);
          float b = blurLevel * 0.15; // spread size of blur

          // Basic 3x3 Gaussian approximation
          texColor += texture2D( map, uv + vec2(-b, -b) ) * 0.077847;
          texColor += texture2D( map, uv + vec2(0.0, -b) ) * 0.123317;
          texColor += texture2D( map, uv + vec2(b, -b) ) * 0.077847;
          texColor += texture2D( map, uv + vec2(-b, 0.0) ) * 0.123317;
          texColor += texture2D( map, uv + vec2(0.0, 0.0) ) * 0.195346;
          texColor += texture2D( map, uv + vec2(b, 0.0) ) * 0.123317;
          texColor += texture2D( map, uv + vec2(-b, b) ) * 0.077847;
          texColor += texture2D( map, uv + vec2(0.0, b) ) * 0.123317;
          texColor += texture2D( map, uv + vec2(b, b) ) * 0.077847;

          diffuseColor *= texColor;
        } else {
          diffuseColor *= texture2D( map, uv );
        }
      #endif
      #ifdef USE_ALPHAMAP
        diffuseColor.a *= texture2D( alphaMap, uv ).g;
      #endif
      `
    );
  };

  const mesh = new THREE.Points(geom, mat);
  layerMeshes.push(mesh);
  particlesGroup.add(mesh);

  const geomFront = new THREE.BufferGeometry();
  geomFront.setAttribute('position', sharedPositionAttribute);
  geomFront.setAttribute('color', geom.getAttribute('color'));
  const meshFront = new THREE.Points(geomFront, mat);
  layerMeshesFront.push(meshFront);
  particlesGroupFront.add(meshFront);
}

// --- UI GENERATION ---
const { controlsContainer } = createSettingsPanels({
  params,
  maxParticles: MAX_PARTICLES,
  moveName: activeMove.name,
  lockedBrushName: particlesEnabled ? brushes[lockedBrushIndex].name : 'Off'
});

if (!particlesEnabled) {
  particlesGroup.visible = false;
  particlesGroupFront.visible = false;
  renderer.domElement.style.display = 'none';
  rendererFront.domElement.style.display = 'none';

  const blendButton = document.getElementById('toggle-blend-btn');
  if (blendButton) {
    blendButton.disabled = true;
    blendButton.innerText = 'Blend: Disabled';
  }
}

if (particlesEnabled && (isChargedTrigger || isManualTrigger)) {
  particlesGroup.visible = false;
  particlesGroupFront.visible = false;
}

if (isManualTrigger) {
  const triggerSkillButton = document.createElement('button');
  triggerSkillButton.id = 'trigger-skill-btn';
  triggerSkillButton.className = 'skill-trigger-btn';
  document.body.appendChild(triggerSkillButton);

  updateTriggerSkillButton = () => {
    triggerSkillButton.innerText = manualSkillActive ? manualDisableLabel : manualTriggerLabel;
    triggerSkillButton.classList.toggle('is-active', manualSkillActive);
  };

  updateTriggerSkillButton();
  triggerSkillButton.addEventListener('click', () => {
    manualSkillActive = !manualSkillActive;
    if (particlesEnabled) {
      const shouldShowParticles = manualSkillActive && (!isRasenganMove || hasTrackedHand);
      particlesGroup.visible = shouldShowParticles;
      particlesGroupFront.visible = shouldShowParticles;
    }
    if (manualSkillActive) {
      manualTriggerStartTime = performance.now();
      shadowBlinkSettlePending = true;
      shadowBlinkPhasePrev = null;
    } else {
      manualTriggerStartTime = 0;
      shadowBlinkSettlePending = false;
      shadowBlinkPhasePrev = null;
    }
    updateTriggerSkillButton();
  });
}

// Minimize toggle logic
document.getElementById('panel-header').addEventListener('click', (e) => {
  if (e.target.id === 'minimize-btn') {
    controlsContainer.style.display = 'none';
  }
});

document.getElementById('home-btn').addEventListener('click', () => {
  window.location.href = '/';
});

// Press 'o' to bring it back!
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'o') {
    controlsContainer.style.display = controlsContainer.style.display === 'none' ? 'flex' : 'none';
  } else if (e.key.toLowerCase() === 'e') {
    if (particlesEnabled && !isManualTrigger) {
      particlesGroup.visible = !particlesGroup.visible;
    }
  } else if (e.key.toLowerCase() === 'r') {
    superMode = false;
    eyeOpenAnimTime = 0;
    bloodAnimStartTime = 0;
    bloodHoldFrameIndex = -1;
    if (particlesEnabled && isChargedTrigger) {
      particlesGroup.visible = false;
      particlesGroupFront.visible = false;
    }
    if (isManualTrigger) {
      manualSkillActive = false;
      manualTriggerStartTime = 0;
      shadowBlinkSettlePending = false;
      shadowBlinkPhasePrev = null;
      if (particlesEnabled) {
        particlesGroup.visible = false;
        particlesGroupFront.visible = false;
      }
      updateTriggerSkillButton();
    }
    bgImage.style.opacity = '0';
    video.style.opacity = '1';
  } else if (e.key.toLowerCase() === 'f') {
    showFaceMesh = !showFaceMesh;
  } else if (e.key.toLowerCase() === 'm') {
    if (typeof meshMode === 'undefined') window.meshMode = false;
    window.meshMode = !window.meshMode;
    const ui = document.getElementById('mesh-ui');
    if (ui) ui.style.display = window.meshMode ? 'block' : 'none';
  }
});

// --- EVENT LISTENERS ---
const updateBaseColors = () => {
  const c = new THREE.Color();
  for (let i = 0; i < params.amount; i++) {
    const ix = i * 3;
    c.setRGB(baseColorsArray[ix], baseColorsArray[ix + 1], baseColorsArray[ix + 2]);
    let hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl);
    hsl.h = (hsl.h + params.hue) % 1.0;
    hsl.s = Math.max(0, Math.min(1, hsl.s * params.saturation));
    hsl.l = Math.max(0, Math.min(1, hsl.l * params.brightness));
    c.setHSL(hsl.h, hsl.s, hsl.l);
    shiftedColorsArray[ix] = c.r;
    shiftedColorsArray[ix + 1] = c.g;
    shiftedColorsArray[ix + 2] = c.b;
  }
};

bindSlider({ id: 'amount', paramKey: 'amount', params, callback: updateBaseColors, format: (v) => Math.round(v) });
bindSlider({ id: 'frontAmount', paramKey: 'frontAmount', params, format: (v) => Math.round(v) });
bindSlider({ id: 'size', paramKey: 'size', params, callback: (v) => {
  layerMeshes.forEach(m => m.material.size = v);
  layerMeshesFront.forEach(m => m.material.size = v);
} });
bindSlider({ id: 'opacity', paramKey: 'opacity', params, callback: (v) => {
  layerMeshes.forEach(m => m.material.opacity = v);
  layerMeshesFront.forEach(m => m.material.opacity = v);
} });
bindSlider({ id: 'overallScale', paramKey: 'overallScale', params });
bindSlider({ id: 'handDistanceOverallControl', paramKey: 'handDistanceOverallControl', params });
bindSlider({ id: 'spread', paramKey: 'spread', params, callback: (v) => {
  particlesGroup.scale.set(v, v, v);
  particlesGroupFront.scale.set(v, v, v);
} });
bindSlider({ id: 'spin', paramKey: 'spinSpeed', params, format: (v) => v + 'x' });
bindSlider({ id: 'noiseStrength', paramKey: 'noiseStrength', params });
bindSlider({ id: 'noiseSpeed', paramKey: 'noiseSpeed', params });
bindSlider({ id: 'twinkle', paramKey: 'twinkle', params });
bindSlider({ id: 'handIntensity', paramKey: 'handIntensity', params });
bindSlider({ id: 'handSpreadControl', paramKey: 'handSpreadControl', params });
bindSlider({ id: 'handSizeControl', paramKey: 'handSizeControl', params });
bindSlider({ id: 'handForeOffsetForward', paramKey: 'handForeOffsetForward', params });
bindSlider({ id: 'handForeOffsetSide', paramKey: 'handForeOffsetSide', params });
bindSlider({ id: 'mouseForce', paramKey: 'mouseForce', params, format: (v) => Number(v).toFixed(3) });
bindSlider({ id: 'hue', paramKey: 'hue', params, callback: updateBaseColors });
bindSlider({ id: 'saturation', paramKey: 'saturation', params, callback: updateBaseColors });
bindSlider({ id: 'brightness', paramKey: 'brightness', params, callback: updateBaseColors });
bindSlider({ id: 'fog', paramKey: 'fog', params, callback: (v) => scene.fog.density = v, format: (v) => Number(v).toFixed(3) });
bindSlider({ id: 'loopSpeed', paramKey: 'loopSpeed', params });
bindSlider({ id: 'animOffset', paramKey: 'animOffset', params });
bindSlider({ id: 'closeBlur', paramKey: 'closeBlur', params, callback: (v) => closeBlurUniform.value = v });
bindSlider({ id: 'bloodScaleW', paramKey: 'bloodScaleW', params });
bindSlider({ id: 'bloodScaleH', paramKey: 'bloodScaleH', params });
bindSlider({ id: 'bloodOffsetX', paramKey: 'bloodOffsetX', params });
bindSlider({ id: 'bloodOffsetY', paramKey: 'bloodOffsetY', params });
bindSlider({ id: 'bloodBend', paramKey: 'bloodBend', params });
bindSlider({ id: 'bloodDarkness', paramKey: 'bloodDarkness', params });
bindSlider({ id: 'bloodLightness', paramKey: 'bloodLightness', params });
bindSlider({ id: 'eyeBlend', paramKey: 'eyeBlend', params });
bindSlider({ id: 'eyeShadow', paramKey: 'eyeShadow', params });
bindSlider({ id: 'eyeLight', paramKey: 'eyeLight', params });
bindSlider({ id: 'eyeGlow', paramKey: 'eyeGlow', params });
bindSlider({ id: 'eyeReflect', paramKey: 'eyeReflect', params });

document.getElementById('toggle-blood-btn').addEventListener('click', (e) => {
  params.bloodEnabled = !params.bloodEnabled;
  e.target.innerText = params.bloodEnabled ? 'Blood FX: ON' : 'Blood FX: OFF';
  if (!params.bloodEnabled) {
    bloodAnimStartTime = -1;
    bloodHoldFrameIndex = -1;
  }
});

document.getElementById('toggle-blend-btn').addEventListener('click', (e) => {
  if (!particlesEnabled) {
    return;
  }

  params.additive = !params.additive;

  const blendingType = params.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  layerMeshes.forEach(m => {
    m.material.blending = blendingType;
    m.material.needsUpdate = true;
  });
  layerMeshesFront.forEach(m => {
    m.material.blending = blendingType;
    m.material.needsUpdate = true;
  });
  e.target.innerText = params.additive ? 'Blend: Additive' : 'Blend: Normal';
});

const handDistInvertButton = document.getElementById('toggle-hand-dist-invert-btn');
if (handDistInvertButton) {
  handDistInvertButton.addEventListener('click', (e) => {
    params.handDistanceOverallInvert = !Boolean(params.handDistanceOverallInvert);
    e.target.innerText = params.handDistanceOverallInvert ? 'Hand Dist: Inverse' : 'Hand Dist: Normal';
  });
}

// A helper function to apply any loaded preset object
function applyPreset(loadedParams) {
  Object.assign(params, DEFAULT_PARAMS, loadedParams, { brushIndex: lockedBrushIndex });
  params.handDistanceOverallInvert = Boolean(params.handDistanceOverallInvert);
  currentBrushIndex = lockedBrushIndex;

  PRESET_SYNC_SLIDER_IDS.forEach(id => {
    let key = id === 'spin' ? 'spinSpeed' : id;
    const slider = document.getElementById(id);
    if (slider) {
      slider.value = params[key];
      slider.dispatchEvent(new Event('input'));
    }
  });

  const bloodBtn = document.getElementById('toggle-blood-btn');
  if (bloodBtn) {
    bloodBtn.innerText = params.bloodEnabled !== false ? 'Blood FX: ON' : 'Blood FX: OFF';
  }

  const toggleBtn = document.getElementById('toggle-blend-btn');
  if (particlesEnabled) {
    toggleBtn.innerText = params.additive ? 'Blend: Additive' : 'Blend: Normal';
  } else {
    toggleBtn.innerText = 'Blend: Disabled';
  }

  const handDistBtn = document.getElementById('toggle-hand-dist-invert-btn');
  if (handDistBtn) {
    handDistBtn.innerText = params.handDistanceOverallInvert ? 'Hand Dist: Inverse' : 'Hand Dist: Normal';
  }

  const blendingType = params.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  layerMeshes.forEach(m => {
    m.material.blending = blendingType;
    m.material.needsUpdate = true;
  });
  layerMeshesFront.forEach(m => {
    m.material.blending = blendingType;
    m.material.needsUpdate = true;
  });
}

document.getElementById('save-preset-btn').addEventListener('click', (e) => {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(params));
  e.target.innerText = "Saved!";
  e.target.style.background = "rgba(40, 200, 40, 0.4)";
  setTimeout(() => {
    e.target.innerText = "Save Browser";
    e.target.style.background = "";
  }, 1500);
});

document.getElementById('reset-btn').addEventListener('click', () => {
  localStorage.removeItem(PRESET_STORAGE_KEY);
  applyPreset(DEFAULT_PARAMS);
});

document.getElementById('export-preset-btn').addEventListener('click', () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(params, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", `particle_preset_${activeMove.id}.json`);
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
});

document.getElementById('import-preset-btn').addEventListener('click', () => {
  document.getElementById('import-preset-file').click();
});

document.getElementById('import-preset-file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const loadedParams = JSON.parse(e.target.result);
      applyPreset(loadedParams);
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(params));
    } catch (err) {
      alert("Invalid JSON preset file!");
    }
  };
  reader.readAsText(file);
});

// --- Mouse Interaction Setup ---
let mouseX = 0, mouseY = 0;
let targetX = 0, targetY = 0;
let windowHalfX = window.innerWidth / 2, windowHalfY = window.innerHeight / 2;

document.addEventListener('mousemove', (e) => {
  if (isRasenganMove) {
    return;
  }
  mouseX = (e.clientX - windowHalfX);
  mouseY = (e.clientY - windowHalfY);
});
document.addEventListener('touchmove', (e) => {
  if (isRasenganMove) {
    return;
  }
  if (e.touches.length > 0) {
    mouseX = (e.touches[0].clientX - windowHalfX);
    mouseY = (e.touches[0].clientY - windowHalfY);
  }
}, { passive: true });

window.addEventListener('resize', () => {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  updateHandDepthScale();
  renderer.setSize(window.innerWidth, window.innerHeight);
  rendererFront.setSize(window.innerWidth, window.innerHeight);
});

// --- Webcam & MediaPipe AI ---
const fgCanvas = document.getElementById('fg-canvas');
const fgCtx = fgCanvas.getContext('2d');
const shadowCloneCanvas = document.createElement('canvas');
const shadowCloneCtx = shadowCloneCanvas.getContext('2d');
const shadowSmokeCanvas = document.createElement('canvas');
const shadowSmokeCtx = shadowSmokeCanvas.getContext('2d');

if (!useForegroundSegmentation) {
  fgCanvas.style.display = 'none';
}

let isEyesClosed = false;
let superMode = false;
let blinkStartTime = 0;
let faceLandmarker;
let handLandmarker;
let currentFaceLandmarks = null;
let showFaceMesh = false;
let eyeOpenAnimTime = 0; // Trigger for particle explosion!
let bloodAnimStartTime = 0; // Independent blood sequence timer
let bloodHoldFrameIndex = -1; // Last decoded frame, held after sequence completes

// Hardware Depth Tracking overrides
let handSizeScalar = 0;
let hasTrackedHand = false;
const MIRROR_VIDEO = true;
const HAND_Z_DEPTH_MUL = 0.85;
const HAND_Z_CLAMP = 35;
let HAND_Z_WORLD_SCALE = 1;
const trackedPalmWorld = new THREE.Vector3();
const trackedForeWorld = new THREE.Vector3(0, -1, 0);
const trackedSideWorld = new THREE.Vector3(1, 0, 0);
const trackedNormalWorld = new THREE.Vector3(0, 0, 1);
let trackedHandSpanWorld = 1.0;
let trackedHandednessLabel = 'Right';
let hasTrackedPalmNormal = false;
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _prevPalmNormal = new THREE.Vector3(0, 0, 1);
const _viewDir = new THREE.Vector3();
const _targetRasenganWorld = new THREE.Vector3();
let lastHandSeenAtMs = -1;
let smoothHandSize = 0;
let smoothSpreadMult = 1.0;
let smoothSizeMult = 1.0;
let smoothOverallDistanceMult = 1.0;

function normalizedToWorldAtZ(normX, normY, targetZ = 0) {
  const distance = camera.position.z - targetZ;
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
  const halfWidth = halfHeight * camera.aspect;
  return {
    x: normX * halfWidth,
    y: -normY * halfHeight
  };
}

function getHalfDimsAtZ(z) {
  const distance = camera.position.z - z;
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance;
  const halfW = halfH * camera.aspect;
  return { halfW, halfH };
}

function updateHandDepthScale() {
  const { halfW } = getHalfDimsAtZ(0);
  HAND_Z_WORLD_SCALE = (2 * halfW) * HAND_Z_DEPTH_MUL;
}
updateHandDepthScale();

function mpZToWorld(zNorm) {
  const zWorld = (-zNorm) * HAND_Z_WORLD_SCALE;
  return Math.max(-HAND_Z_CLAMP, Math.min(HAND_Z_CLAMP, zWorld));
}

function lmToWorld(lm) {
  const z = mpZToWorld(lm.z);
  const nx = (MIRROR_VIDEO ? (1 - lm.x) : lm.x) * 2.0 - 1.0;
  const ny = (lm.y * 2.0) - 1.0;
  const xy = normalizedToWorldAtZ(nx, ny, z);
  return _vC.set(xy.x, xy.y, z).clone();
}

// EMA Smoothing trackers for seamless eyes
let smoothLeftEye = { x: 0, y: 0, s: 0 };
let smoothRightEye = { x: 0, y: 0, s: 0 };

// 1. Setup the Background Extractor
const selfieSegmentation = new SelfieSegmentation({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
  }
});
selfieSegmentation.setOptions({
  modelSelection: 1, // 1 is landscape (fast), 0 is general (more accurate)
});

selfieSegmentation.onResults((results) => {
  if (fgCanvas.width !== video.videoWidth) {
    fgCanvas.width = video.videoWidth;
    fgCanvas.height = video.videoHeight;
  }

  if (isShadowCloneMove) {
    if (shadowCloneCanvas.width !== fgCanvas.width) {
      shadowCloneCanvas.width = fgCanvas.width;
      shadowCloneCanvas.height = fgCanvas.height;
    }
    if (shadowSmokeCanvas.width !== fgCanvas.width) {
      shadowSmokeCanvas.width = fgCanvas.width;
      shadowSmokeCanvas.height = fgCanvas.height;
    }

    shadowCloneCtx.clearRect(0, 0, shadowCloneCanvas.width, shadowCloneCanvas.height);
    shadowCloneCtx.drawImage(results.segmentationMask, 0, 0, shadowCloneCanvas.width, shadowCloneCanvas.height);
    shadowCloneCtx.globalCompositeOperation = 'source-in';
    shadowCloneCtx.drawImage(results.image, 0, 0, shadowCloneCanvas.width, shadowCloneCanvas.height);
    shadowCloneCtx.globalCompositeOperation = 'source-over';

    const cloneOffset = shadowCloneConfig?.offsetRatio ?? 0.3;
    const cloneScale = shadowCloneConfig?.scale ?? 1.0;
    const cloneOpacity = shadowCloneConfig?.opacity ?? 0.92;
    const cloneEnterDurationMs = shadowCloneConfig?.enterDurationMs ?? 650;
    const cloneBlinkSpeed = shadowCloneConfig?.blinkSpeed ?? 8.0;
    const cloneBlinkDepth = Math.max(0, Math.min(0.95, shadowCloneConfig?.blinkDepth ?? 0.5));
    const smokeEnabled = shadowCloneConfig?.smokeEnabled !== false;
    const smokeOpacity = Math.max(0, Math.min(1, shadowCloneConfig?.smokeOpacity ?? 0.65));
    const smokeScale = Math.max(0.1, shadowCloneConfig?.smokeScale ?? 1.2);
    const smokeRise = shadowCloneConfig?.smokeRise ?? 0.14;
    const smokeMaskToClone = shadowCloneConfig?.smokeMaskToClone !== false;
    const drawWidth = fgCanvas.width * cloneScale;
    const drawHeight = fgCanvas.height * cloneScale;
    const centeredX = (fgCanvas.width - drawWidth) * 0.5;
    const centeredY = (fgCanvas.height - drawHeight) * 0.5;
    const sideOffsetPx = fgCanvas.width * cloneOffset;

    if (!manualSkillActive) {
      shadowBlinkSettlePending = false;
      shadowBlinkPhasePrev = null;
      fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
      return;
    }

    const now = performance.now();
    const elapsedSinceTrigger = manualTriggerStartTime > 0 ? now - manualTriggerStartTime : cloneEnterDurationMs;
    const entranceT = Math.min(1, elapsedSinceTrigger / cloneEnterDurationMs);
    const entranceEaseOut = 1 - Math.pow(1 - entranceT, 3);
    const animatedOffset = sideOffsetPx * entranceEaseOut;
    let smokeFrame = null;
    if (smokeEnabled && entranceT < 1 && smokeFrames.length > 0) {
      const targetFrameIndex = Math.max(0, Math.min(
        smokeFrames.length - 1,
        Math.floor(entranceT * (smokeFrames.length - 1))
      ));
      for (let i = targetFrameIndex; i >= 0; i--) {
        const candidate = smokeFrames[i];
        if (candidate.complete && candidate.naturalWidth > 0) {
          smokeFrame = candidate;
          break;
        }
      }
    }
    const blinkPhase = (now * 0.001 * cloneBlinkSpeed) % (Math.PI * 2);
    const blinkPulse = (Math.sin(blinkPhase) + 1) * 0.5;
    const blinkOpacity = cloneOpacity * (1 - cloneBlinkDepth * blinkPulse);

    let leftAlpha = cloneOpacity;
    let rightAlpha = cloneOpacity;

    if (entranceT < 1) {
      shadowBlinkSettlePending = true;
      leftAlpha = blinkOpacity;
      rightAlpha = blinkOpacity;
    } else if (shadowBlinkSettlePending) {
      leftAlpha = blinkOpacity;
      rightAlpha = blinkOpacity;

      const fullOpacityPhase = (Math.PI * 3) / 2;
      if (didPassPhase(shadowBlinkPhasePrev, blinkPhase, fullOpacityPhase)) {
        shadowBlinkSettlePending = false;
        shadowBlinkPhasePrev = null;
        leftAlpha = cloneOpacity;
        rightAlpha = cloneOpacity;
      }
    }

    if (entranceT < 1 || shadowBlinkSettlePending) {
      shadowBlinkPhasePrev = blinkPhase;
    }

    const drawCloneWithSmoke = (x, alpha) => {
      fgCtx.globalCompositeOperation = 'source-over';
      fgCtx.globalAlpha = alpha;
      fgCtx.drawImage(shadowCloneCanvas, x, centeredY, drawWidth, drawHeight);

      const smokeIsReady = Boolean(smokeFrame);
      if (!smokeEnabled || !smokeIsReady) {
        return;
      }

      const smokeW = drawWidth * smokeScale;
      const smokeH = drawHeight * smokeScale;
      const smokeX = x - (smokeW - drawWidth) * 0.5;
      const smokeY = centeredY - (smokeH * smokeRise);

      if (smokeMaskToClone) {
        shadowSmokeCtx.clearRect(0, 0, shadowSmokeCanvas.width, shadowSmokeCanvas.height);
        shadowSmokeCtx.globalCompositeOperation = 'source-over';
        shadowSmokeCtx.drawImage(smokeFrame, smokeX, smokeY, smokeW, smokeH);
        shadowSmokeCtx.globalCompositeOperation = 'destination-in';
        shadowSmokeCtx.drawImage(shadowCloneCanvas, x, centeredY, drawWidth, drawHeight);
        shadowSmokeCtx.globalCompositeOperation = 'source-over';
      }

      // Sprite sheet already has transparency, so draw raw smoke with no color filtering.
      fgCtx.globalCompositeOperation = 'source-over';
      fgCtx.globalAlpha = Math.min(1, alpha * smokeOpacity);
      if (smokeMaskToClone) {
        fgCtx.drawImage(shadowSmokeCanvas, 0, 0);
      } else {
        fgCtx.drawImage(smokeFrame, smokeX, smokeY, smokeW, smokeH);
      }
    };

    fgCtx.save();
    fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);
    drawCloneWithSmoke(centeredX - animatedOffset, leftAlpha);
    drawCloneWithSmoke(centeredX + animatedOffset, rightAlpha);
    fgCtx.restore();
    return;
  }

  fgCtx.save();
  fgCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);

  // Draw the mask (white for person, black for background)
  fgCtx.drawImage(results.segmentationMask, 0, 0, fgCanvas.width, fgCanvas.height);

  // Composite original video over the white person mask
  fgCtx.globalCompositeOperation = 'source-in';
  fgCtx.drawImage(results.image, 0, 0, fgCanvas.width, fgCanvas.height);

  // Render superMode eyes completely seamlessly inside the human face!
  if (superMode && currentFaceLandmarks) {
    const leftIris = currentFaceLandmarks[468];
    const rightIris = currentFaceLandmarks[473];

    // Compute separate realistic sizes via absolute eyelid-corner distances per eye
    const pt1 = currentFaceLandmarks[33], pt2 = currentFaceLandmarks[133];
    let eyeSizeL = Math.sqrt(Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2)) * fgCanvas.width * 0.42; // Scaled down!

    const pt3 = currentFaceLandmarks[362], pt4 = currentFaceLandmarks[263];
    let eyeSizeR = Math.sqrt(Math.pow(pt3.x - pt4.x, 2) + Math.pow(pt3.y - pt4.y, 2)) * fgCanvas.width * 0.42;

    const leftSocketCenter = {
      x: (pt1.x + pt2.x) * 0.5,
      y: (pt1.y + pt2.y) * 0.5
    };
    const rightSocketCenter = {
      x: (pt3.x + pt4.x) * 0.5,
      y: (pt3.y + pt4.y) * 0.5
    };

    // Blood sticks to face geometry: eye-corner center + fixed downward cheek offset.
    const leftBloodAnchor = {
      x: leftSocketCenter.x,
      y: leftSocketCenter.y + (eyeSizeL / fgCanvas.width) * 0.48
    };
    const rightBloodAnchor = {
      x: rightSocketCenter.x,
      y: rightSocketCenter.y + (eyeSizeR / fgCanvas.width) * 0.48
    };

    // Eye texture tracks iris quickly.
    if (smoothLeftEye.s === 0) {
      smoothLeftEye = { x: leftIris.x, y: leftIris.y, s: eyeSizeL };
      smoothRightEye = { x: rightIris.x, y: rightIris.y, s: eyeSizeR };
    } else {
      smoothLeftEye.x += (leftIris.x - smoothLeftEye.x) * 1.0;
      smoothLeftEye.y += (leftIris.y - smoothLeftEye.y) * 1.0;
      smoothLeftEye.s += (eyeSizeL - smoothLeftEye.s) * 1.0;
      smoothRightEye.x += (rightIris.x - smoothRightEye.x) * 1.0;
      smoothRightEye.y += (rightIris.y - smoothRightEye.y) * 1.0;
      smoothRightEye.s += (eyeSizeR - smoothRightEye.s) * 1.0;
    }

    if (eyesImg.complete && eyesImg.naturalWidth > 0) {
      // Exact MediaPipe Polygon paths traversing perfectly around the upper/lower eyelid rims
      const leftEyeLid = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
      const rightEyeLid = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

      const faceAngle = Math.atan2(
        (rightSocketCenter.y - leftSocketCenter.y) * fgCanvas.height,
        (rightSocketCenter.x - leftSocketCenter.x) * fgCanvas.width
      );

      const drawSeamlessEye = (iris, size, lidIndices) => {
        fgCtx.save();

        // 1. Eyelid Occlusion Mask
        fgCtx.beginPath();
        for (let i = 0; i < lidIndices.length; i++) {
          const pt = currentFaceLandmarks[lidIndices[i]];
          if (i === 0) fgCtx.moveTo(pt.x * fgCanvas.width, pt.y * fgCanvas.height);
          else fgCtx.lineTo(pt.x * fgCanvas.width, pt.y * fgCanvas.height);
        }
        fgCtx.closePath();
        fgCtx.clip(); // Dynamically slices away ANY texture overlapping the skin!

        const cx = iris.x * fgCanvas.width;
        const cy = iris.y * fgCanvas.height;

        fgCtx.translate(cx, cy);
        fgCtx.rotate(faceAngle);

        const eyeBlend = Math.min(1, Math.max(0, params.eyeBlend));

        // 1.5 Ambient Red Glow (Bleeds out into the whites of the eye when charged!)
        fgCtx.globalCompositeOperation = 'screen';
        const glowGrad = fgCtx.createRadialGradient(0, 0, 0, 0, 0, size * 0.8);
        glowGrad.addColorStop(0, `rgba(255, 0, 0, ${params.eyeGlow * eyeBlend})`);
        glowGrad.addColorStop(0.4, `rgba(255, 0, 0, ${(params.eyeGlow * 0.33) * eyeBlend})`);
        glowGrad.addColorStop(1, 'rgba(255, 0, 0, 0)');
        fgCtx.fillStyle = glowGrad;
        fgCtx.fillRect(-size, -size, size * 2, size * 2);

        // 2. Multiply softly extracts the room lighting/shadows from your real eye socket
        fgCtx.globalCompositeOperation = 'multiply';
        fgCtx.globalAlpha = params.eyeShadow * eyeBlend;
        fgCtx.drawImage(eyesImg, -size / 2, -size / 2, size, size);

        // 3. Hard-Light violently re-injects the raw brightness and glowing saturated color
        fgCtx.globalCompositeOperation = 'hard-light';
        fgCtx.globalAlpha = params.eyeLight * eyeBlend;
        fgCtx.drawImage(eyesImg, -size / 2, -size / 2, size, size);

        // 4. Specular reflections to make the iris read as a wet curved surface
        const reflectionStrength = Math.min(1, Math.max(0, params.eyeReflect * eyeBlend));
        if (reflectionStrength > 0) {
          fgCtx.globalCompositeOperation = 'screen';
          fgCtx.globalAlpha = reflectionStrength;

          fgCtx.beginPath();
          fgCtx.ellipse(-size * 0.16, -size * 0.18, size * 0.20, size * 0.12, -0.35, 0, Math.PI * 2);
          let specularGrad = fgCtx.createRadialGradient(
            -size * 0.18, -size * 0.19, 0,
            -size * 0.16, -size * 0.18, size * 0.22
          );
          specularGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
          specularGrad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
          specularGrad.addColorStop(1, 'rgba(255,255,255,0)');
          fgCtx.fillStyle = specularGrad;
          fgCtx.fill();

          fgCtx.globalAlpha = reflectionStrength * 0.6;
          fgCtx.beginPath();
          fgCtx.ellipse(size * 0.06, -size * 0.03, size * 0.06, size * 0.04, 0.2, 0, Math.PI * 2);
          specularGrad = fgCtx.createRadialGradient(
            size * 0.05, -size * 0.04, 0,
            size * 0.06, -size * 0.03, size * 0.08
          );
          specularGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
          specularGrad.addColorStop(1, 'rgba(255,255,255,0)');
          fgCtx.fillStyle = specularGrad;
          fgCtx.fill();
        }

        fgCtx.restore();
      };

      drawSeamlessEye(smoothLeftEye, smoothLeftEye.s, leftEyeLid);
      drawSeamlessEye(smoothRightEye, smoothRightEye.s, rightEyeLid);

      // Render Eyeblood Image Sequence directly streaming on faces!
      let currentBloodFrame = null;
      if (superMode && params.bloodEnabled !== false) {
        if (bloodAnimStartTime > 0 && bloodHoldFrameIndex < BLOOD_LAST_FRAME_INDEX) {
          const elapsed = performance.now() - bloodAnimStartTime;
          const targetFrameIndex = Math.min(
            BLOOD_LAST_FRAME_INDEX,
            Math.floor(elapsed / (1000 / BLOOD_FRAME_RATE))
          );

          // Scan backward to the newest decoded frame <= target frame.
          let resolvedFrameIndex = -1;
          for (let i = targetFrameIndex; i >= 0; i--) {
            if (bloodFrames[i].complete && bloodFrames[i].naturalWidth > 0) {
              resolvedFrameIndex = i;
              break;
            }
          }

          if (resolvedFrameIndex >= 0) {
            // Never allow frame regression once a newer frame is shown.
            bloodHoldFrameIndex = Math.max(bloodHoldFrameIndex, resolvedFrameIndex);
            if (bloodHoldFrameIndex >= BLOOD_LAST_FRAME_INDEX) {
              bloodAnimStartTime = -1;
            }
          }
        }

        if (bloodHoldFrameIndex >= 0) {
          const heldFrame = bloodFrames[bloodHoldFrameIndex];
          if (heldFrame.complete && heldFrame.naturalWidth > 0) {
            currentBloodFrame = heldFrame;
          }
        }
      }

      if (currentBloodFrame) {
        if (!window.bloodOffCanvas) {
          window.bloodOffCanvas = document.createElement('canvas');
        }
        window.bloodOffCanvas.width = fgCanvas.width;
        window.bloodOffCanvas.height = fgCanvas.height;
        const offCtx = window.bloodOffCanvas.getContext('2d');
        offCtx.clearRect(0, 0, fgCanvas.width, fgCanvas.height);

        const wL = smoothLeftEye.s * params.bloodScaleW;
        const hL = smoothLeftEye.s * params.bloodScaleH;
        const wR = smoothRightEye.s * params.bloodScaleW;
        const hR = smoothRightEye.s * params.bloodScaleH;

        // Cinematic 2D "Mesh Slicing" Warp effect with high-fidelity (20 slices) to eradicate blocky staircases!
        const slices = 20;
        const vW = currentBloodFrame.naturalWidth;
        const vH = currentBloodFrame.naturalHeight;

        const cxL = leftBloodAnchor.x * fgCanvas.width;
        const cyL = leftBloodAnchor.y * fgCanvas.height;
        const cxR = rightBloodAnchor.x * fgCanvas.width;
        const cyR = rightBloodAnchor.y * fgCanvas.height;

        for (let i = 0; i < slices; i++) {
          const t = i / (slices - 1);
          const bendAmt = Math.pow(t - 0.5, 2) * params.bloodBend;

          const sx = (i / slices) * vW;
          const sy = 0;
          const sw = vW / slices;
          const sh = vH;

          // Left Eye Slice Local Context Engine
          offCtx.save();
          offCtx.translate(cxL, cyL);
          offCtx.rotate(faceAngle);

          const dxL = -wL / 2 + (params.bloodOffsetX * wL) + (i / slices) * wL;
          const dyL = (params.bloodOffsetY * hL) + (bendAmt * hL);
          const dwL = (wL / slices) + 0.8; // increased subpixel padding to prevent tearing
          const dhL = hL;
          offCtx.drawImage(currentBloodFrame, sx, sy, sw, sh, dxL, dyL, dwL, dhL);
          offCtx.restore();

          // Right Eye Slice Local Context Engine
          offCtx.save();
          offCtx.translate(cxR, cyR);
          offCtx.rotate(faceAngle);

          const dxR = -wR / 2 + (params.bloodOffsetX * wR) + (i / slices) * wR;
          const dyR = (params.bloodOffsetY * hR) + (bendAmt * hR);
          const dwR = (wR / slices) + 0.8;
          const dhR = hR;
          offCtx.drawImage(currentBloodFrame, sx, sy, sw, sh, dxR, dyR, dwR, dhR);
          offCtx.restore();
        }

        // Feather the very top hard edge out of existence physically
        offCtx.globalCompositeOperation = 'destination-out';

        const fadeTopEdge = (cx, cy, w, h) => {
          offCtx.save();
          offCtx.translate(cx, cy);
          offCtx.rotate(faceAngle);

          const topY = (params.bloodOffsetY * h);
          const grad = offCtx.createLinearGradient(0, topY, 0, topY + h * 0.15);
          grad.addColorStop(0, 'rgba(0,0,0,1)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          offCtx.fillStyle = grad;
          offCtx.fillRect(-w, topY - h * 0.5, w * 2, h * 1.5);
          offCtx.restore();
        };

        fadeTopEdge(cxL, cyL, wL, hL);
        fadeTopEdge(cxR, cyR, wR, hR);

        offCtx.globalCompositeOperation = 'source-over';

        // Native Hardware Accelerated Compositing (Zero CPU Latency)
        fgCtx.save();
        fgCtx.globalCompositeOperation = 'source-over'; // Native transparent video rendering
        fgCtx.globalAlpha = params.bloodLightness;

        // Use native hardware filters to tune the red vibrancy without tanking framerate
        // Darkness slider controls brightness drop, Lightness controls overall alpha
        fgCtx.filter = `saturate(${params.bloodDarkness * 1.5}) brightness(${2.0 - params.bloodDarkness})`;

        fgCtx.drawImage(window.bloodOffCanvas, 0, 0);

        fgCtx.filter = 'none';
        fgCtx.restore();
      }
    }
  } else {
    smoothLeftEye.s = 0; // Reset smoothing memory when eyes are missing
  }

  // Render Face Landmarks if toggled on
  if (showFaceMesh && currentFaceLandmarks) {
    fgCtx.globalCompositeOperation = 'source-over';
    fgCtx.globalAlpha = 1.0;
    fgCtx.fillStyle = '#00ff00';
    for (const pt of currentFaceLandmarks) {
      fgCtx.beginPath();
      fgCtx.arc(pt.x * fgCanvas.width, pt.y * fgCanvas.height, 1, 0, Math.PI * 2);
      fgCtx.fill();
    }
  }

  fgCtx.globalAlpha = 1.0;
  fgCtx.restore();
});

// 2. Setup the AI Trackers
async function setupLandmarkers() {
  if (!useLandmarkers) {
    return;
  }

  const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
      delegate: "GPU"
    },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 1
  });

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
}
if (useLandmarkers) {
  setupLandmarkers();
}

let lastVideoTime = -1;
async function segmentLoop() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    const startTimeMs = performance.now();
    lastVideoTime = video.currentTime;

    // Eye Blink & Face Tracking (Executed FIRST for zero-latency parameter updates!)
    if (faceLandmarker) {
      const results = faceLandmarker.detectForVideo(video, startTimeMs);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        currentFaceLandmarks = results.faceLandmarks[0];
      } else {
        currentFaceLandmarks = null;
      }

      if (isChargedTrigger && results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const blendshapes = results.faceBlendshapes[0].categories;
        const leftBlink = blendshapes.find(b => b.categoryName === "eyeBlinkLeft")?.score || 0;
        const rightBlink = blendshapes.find(b => b.categoryName === "eyeBlinkRight")?.score || 0;

        const newEyesClosed = (leftBlink > 0.4 && rightBlink > 0.4);

        if (newEyesClosed !== isEyesClosed) {
          isEyesClosed = newEyesClosed;

          if (isEyesClosed) {
            blinkStartTime = startTimeMs;
            video.style.transition = 'opacity 1.5s ease-in-out';
            bgImage.style.transition = 'opacity 1.5s ease-in-out';
            video.style.opacity = '0';
            bgImage.style.opacity = '0';
          } else {
            // Just opened eyes. Check duration of blink.
            video.style.transition = 'none';
            bgImage.style.transition = 'none';

            const duration = (startTimeMs - blinkStartTime) / 1000.0;
            if (duration > 1.5) {
              superMode = true; // Turn on red background mode
              const now = performance.now();
              eyeOpenAnimTime = now; // Trigger the burst animation ONLY on charged blink!
              bloodAnimStartTime = now; // Start full blood sequence
              bloodHoldFrameIndex = -1;
            }

            if (superMode) {
              video.style.opacity = '0';
              bgImage.style.opacity = '1';
              particlesGroup.visible = true; // Auto visible!
            } else {
              video.style.opacity = '1';
              bgImage.style.opacity = '0';
            }
          }
        }
      } else if (isChargedTrigger) {
        if (isEyesClosed) {
          isEyesClosed = false;
          video.style.transition = 'none';
          bgImage.style.transition = 'none';
          if (superMode) {
            video.style.opacity = '0';
            bgImage.style.opacity = '1';
          } else {
            video.style.opacity = '1';
            bgImage.style.opacity = '0';
          }
        }
      }
    }

    // Hand Tracking (Mouse Pull override & Depth Sensing)
    if (handLandmarker) {
      const handResults = handLandmarker.detectForVideo(video, startTimeMs);
      if (handResults.landmarks && handResults.landmarks.length > 0) {
        const hand = handResults.landmarks[0];
        // Middle Finger MCP (9) + Wrist (0)
        const pt9 = hand[9];
        const pt0 = hand[0];
        const pt5 = hand[5];
        const pt17 = hand[17];

        // Pythagorean distance on the normalized video plane
        const dx = pt9.x - pt0.x;
        const dy = pt9.y - pt0.y;
        handSizeScalar = Math.sqrt(dx * dx + dy * dy);

        // Override mouse rotation to magnetically pull toward physical hand!
        // (1.0 - x) solves the CSS webcam mirror flipping logic
        const visualX = 1.0 - pt9.x;
        mouseX = (visualX * window.innerWidth) - windowHalfX;
        mouseY = (pt9.y * window.innerHeight) - windowHalfY;

        hasTrackedHand = true;

        // Rasengan: 3D palm pose for side-view offset/parallax.
        if (isRasenganMove) {
          if (hasTrackedPalmNormal) {
            _prevPalmNormal.copy(trackedNormalWorld);
          }

          trackedHandednessLabel =
            handResults.handednesses?.[0]?.[0]?.categoryName ||
            handResults.handedness?.[0]?.[0]?.categoryName ||
            'Right';

          const WRIST = 0, INDEX_MCP = 5, MIDDLE_MCP = 9, RING_MCP = 13, PINKY_MCP = 17;
          const wristW = lmToWorld(hand[WRIST]);
          const idxW = lmToWorld(hand[INDEX_MCP]);
          const midW = lmToWorld(hand[MIDDLE_MCP]);
          const ringW = lmToWorld(hand[RING_MCP]);
          const pkyW = lmToWorld(hand[PINKY_MCP]);

          trackedPalmWorld
            .copy(wristW)
            .add(idxW)
            .add(midW)
            .add(ringW)
            .add(pkyW)
            .multiplyScalar(0.2);

          trackedHandSpanWorld = idxW.distanceTo(pkyW);

          trackedSideWorld.copy(idxW).sub(pkyW);
          if (trackedSideWorld.lengthSq() > 0.000001) {
            trackedSideWorld.normalize();
          } else {
            trackedSideWorld.set(1, 0, 0);
          }

          _vA.copy(idxW).sub(wristW);
          _vB.copy(pkyW).sub(wristW);
          trackedNormalWorld.copy(_vA.cross(_vB));
          if (trackedNormalWorld.lengthSq() > 0.000001) {
            trackedNormalWorld.normalize();
          } else {
            trackedNormalWorld.set(0, 0, 1);
          }

          const handednessLower = `${trackedHandednessLabel}`.toLowerCase();
          if (handednessLower.includes('left')) trackedNormalWorld.negate();
          if (MIRROR_VIDEO) trackedNormalWorld.negate();

          // Keep normal direction continuous so side views do not randomly jump
          // to the opposite side when handedness briefly misclassifies.
          if (hasTrackedPalmNormal && trackedNormalWorld.dot(_prevPalmNormal) < 0) {
            trackedNormalWorld.negate();
          }
          hasTrackedPalmNormal = true;

          trackedForeWorld.copy(trackedNormalWorld).cross(trackedSideWorld);
          if (trackedForeWorld.lengthSq() > 0.000001) {
            trackedForeWorld.normalize();
          } else {
            trackedForeWorld.set(0, -1, 0);
          }
          _vA.copy(midW).sub(wristW);
          if (trackedForeWorld.dot(_vA) < 0) trackedForeWorld.negate();
        }

        lastHandSeenAtMs = startTimeMs;
      } else {
        handSizeScalar = 0; // Hand missing
        // Keep the last valid hand lock very briefly to smooth detector dropouts.
        hasTrackedHand = (startTimeMs - lastHandSeenAtMs) < 140;
        if (!hasTrackedHand) {
          hasTrackedPalmNormal = false;
        }
      }
    }

    // Foreground compositing (optional per move).
    if (useForegroundSegmentation) {
      await selfieSegmentation.send({ image: video });
    }
  }
  requestAnimationFrame(segmentLoop);
}

async function initWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } }
    });
    video.srcObject = stream;
    video.onloadeddata = () => {
      segmentLoop(); // Start isolating human foreground
    };
  } catch (err) {
    console.error("Error accessing webcam: ", err);
  }
}

// --- Animation Loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsedTime = clock.getElapsedTime();

  if (!particlesEnabled) {
    return;
  }
  if (isManualTrigger && !manualSkillActive) {
    return;
  }

  // Hand Depth Smoothing Physics
  smoothHandSize += (handSizeScalar - smoothHandSize) * 0.1;

  // Dynamic Hand Tracking Particle Multipliers
  let targetSpreadMult = 1.0;
  let targetSizeMult = 1.0;
  let baseHandDistanceSpreadMult = 1.0;

  if (handSizeScalar > 0.01) {
    // Normal resting distance on the 2D plane is ~0.15. 
    // Hand pushing further away (or closing) makes the distance smaller!
    baseHandDistanceSpreadMult = 0.15 / handSizeScalar; // Smaller distance = ratio > 1 (Spreads Out!)
    targetSpreadMult = baseHandDistanceSpreadMult;
    targetSizeMult = handSizeScalar / 0.15;  // Smaller distance = ratio < 1 (Shrinks Size!)

    // Prevent math explosions
    baseHandDistanceSpreadMult = Math.min(baseHandDistanceSpreadMult, 10.0);
    targetSpreadMult = baseHandDistanceSpreadMult;
    targetSizeMult = Math.max(targetSizeMult, 0.05);
  }

  const handIntensity = Math.max(0, Math.min(2, params.handIntensity ?? 1.0));
  const handSpreadControl = Math.max(0, Math.min(2, params.handSpreadControl ?? 1.0));
  const handSizeControl = Math.max(0, Math.min(2, params.handSizeControl ?? 1.0));
  const handDistanceOverallControl = Math.max(0, Math.min(2, params.handDistanceOverallControl ?? 0.0));
  const handDistanceOverallInvert = Boolean(params.handDistanceOverallInvert);
  targetSpreadMult = 1.0 + (targetSpreadMult - 1.0) * handIntensity * handSpreadControl;
  targetSizeMult = 1.0 + (targetSizeMult - 1.0) * handIntensity * handSizeControl;
  let handDistanceBaseMult = baseHandDistanceSpreadMult;
  if (handDistanceOverallInvert) {
    handDistanceBaseMult = 1.0 / Math.max(0.1, handDistanceBaseMult);
  }
  handDistanceBaseMult = Math.max(0.1, Math.min(10.0, handDistanceBaseMult));
  const targetOverallDistanceMult = 1.0 + (handDistanceBaseMult - 1.0) * handDistanceOverallControl;

  // If hand spread control is off, disable hand-driven spread immediately (no lingering smoothing).
  if (handIntensity <= 0.001 || handSpreadControl <= 0.001) {
    smoothSpreadMult = 1.0;
  } else {
    // Smoothly interpolate the multiplier to prevent snapping.
    smoothSpreadMult += (targetSpreadMult - smoothSpreadMult) * 0.05;
  }
  if (handIntensity <= 0.001 || handSizeControl <= 0.001) {
    smoothSizeMult = 1.0;
  } else {
    smoothSizeMult += (targetSizeMult - smoothSizeMult) * 0.05;
  }
  if (handDistanceOverallControl <= 0.001) {
    smoothOverallDistanceMult = 1.0;
  } else {
    smoothOverallDistanceMult += (targetOverallDistanceMult - smoothOverallDistanceMult) * 0.08;
  }

  let currentSpread = params.spread * smoothSpreadMult;
  let currentSize = params.size * smoothSizeMult;

  // Burst Spread Animation when opening eyes (Overrides with eased scale logic)
  if (eyeOpenAnimTime > 0) {
    const elapsedAnim = (performance.now() - eyeOpenAnimTime) / 1000.0;
    if (elapsedAnim < 1.5) {
      // Cubic ease out math over 1.5 seconds: 1 - (1 - t/1.5)^3
      const t = elapsedAnim / 1.5;
      const easeOut = 1 - Math.pow(1 - t, 3);
      currentSpread = currentSpread * easeOut;
    } else {
      eyeOpenAnimTime = 0; // Animation finished
    }
  }

  if (isRasenganMove) {
    const orbRadius = rasenganConfig?.orbRadius ?? 0.42;
    const followStrength = THREE.MathUtils.clamp(rasenganConfig?.followStrength ?? 0.35, 0.2, 1.0);
    const spinBoost = rasenganConfig?.spinBoost ?? 1.9;
    const handOffsetForward = Math.max(-0.4, Math.min(0.6, params.handForeOffsetForward ?? rasenganConfig?.handOffsetForward ?? 0.18));
    const handOffsetSide = Math.max(-0.4, Math.min(0.4, params.handForeOffsetSide ?? rasenganConfig?.handOffsetSide ?? 0.0));
    const handDistOffsetStrength = Math.max(0, Math.min(2, rasenganConfig?.handDistanceOffsetStrength ?? 1.0));

    currentSpread = orbRadius;
    currentSize = Math.max(0.15, currentSize * 0.75);

    if (hasTrackedHand) {
      // Auto-scale forehand offsets by hand distance so ratio feels consistent in perspective.
      const rawHandDistanceOffsetScale = Math.max(0.55, Math.min(1.75, smoothHandSize / 0.15));
      const handDistanceOffsetScale = 1.0 + ((rawHandDistanceOffsetScale - 1.0) * handDistOffsetStrength);
      const { halfW, halfH } = getHalfDimsAtZ(trackedPalmWorld.z);
      const frustumScale = (halfW + halfH) * 0.5;
      const forwardWorld = (handOffsetForward * handDistanceOffsetScale) * frustumScale;
      const sideWorld = (handOffsetSide * handDistanceOffsetScale) * frustumScale;
      const hoverWorld = Math.max(0.5, trackedHandSpanWorld * 0.25);

      camera.getWorldDirection(_viewDir);
      const facing = Math.abs(trackedNormalWorld.dot(_viewDir));
      const frontBlend = facing * facing;
      const effectiveForward = forwardWorld * (1.0 - 0.9 * frontBlend);
      const frontNormalInfluence = forwardWorld * 0.55 * frontBlend;

      _targetRasenganWorld.copy(trackedPalmWorld)
        .addScaledVector(trackedForeWorld, effectiveForward)
        .addScaledVector(trackedSideWorld, sideWorld)
        .addScaledVector(trackedNormalWorld, hoverWorld + frontNormalInfluence);

      particlesGroup.position.lerp(_targetRasenganWorld, followStrength);
      particlesGroup.visible = true;
      particlesGroupFront.visible = true;
    } else {
      particlesGroup.visible = false;
      particlesGroupFront.visible = false;
    }

    particlesGroup.rotation.z -= 0.002 * params.spinSpeed * spinBoost;
  } else {
    particlesGroup.position.x += (0 - particlesGroup.position.x) * 0.08;
    particlesGroup.position.y += (0 - particlesGroup.position.y) * 0.08;
    particlesGroup.position.z += (0 - particlesGroup.position.z) * 0.08;
  }

  const overallScale = Math.max(0.1, Math.min(3.0, params.overallScale ?? 1.0));
  currentSpread *= overallScale * smoothOverallDistanceMult;

  particlesGroup.scale.set(currentSpread, currentSpread, currentSpread);
  particlesGroupFront.scale.set(currentSpread, currentSpread, currentSpread);

  targetX = mouseX * params.mouseForce;
  targetY = mouseY * params.mouseForce;

  particlesGroup.rotation.y += 0.05 * (targetX - particlesGroup.rotation.y);
  particlesGroup.rotation.x += 0.05 * (targetY - particlesGroup.rotation.x);
  if (!isRasenganMove) {
    particlesGroup.rotation.z -= 0.001 * params.spinSpeed;
  }

  particlesGroupFront.rotation.copy(particlesGroup.rotation);
  particlesGroupFront.position.copy(particlesGroup.position);
  particlesGroupFront.visible = particlesGroup.visible;

  // Handle Animated Brushes
  const activeBrush = brushes[lockedBrushIndex];
  const frameCount = activeBrush.maps.length;

  const totalWanted = Math.floor(params.amount);

  // Apply dynamic particle sizing synchronously to all active layers
  for (let i = 0; i < MAX_FRAMES; i++) {
    layerMeshes[i].material.size = currentSize;
    layerMeshesFront[i].material.size = currentSize;
  }

  // Dynamic Z-Depth Array Slicing: Only pull brushes to the absolute front layer if hands are large/close enough to the camera!
  // Normal hand size is ~0.15 on MediaPipe plane. Smoothly scale `frontAmount` slice between 0.1 (far) and 0.25 (close).
  const depthMultiplier = Math.max(0, Math.min(1, (smoothHandSize - 0.1) / 0.15));
  const dynamicFrontWanted = Math.floor(params.frontAmount * depthMultiplier);

  const actualFront = Math.min(dynamicFrontWanted, totalWanted);
  const actualBack = Math.max(0, totalWanted - actualFront);

  // Assign correct maps to layers
  for (let j = 0; j < MAX_FRAMES; j++) {
    layerMeshes[j].geometry.setDrawRange(0, actualBack);
    layerMeshesFront[j].geometry.setDrawRange(actualBack, actualFront);

    if (j < frameCount) {
      layerMeshes[j].visible = true;
      layerMeshesFront[j].visible = true;
      if (layerMeshes[j].material.map !== activeBrush.maps[j]) {
        layerMeshes[j].material.map = activeBrush.maps[j];
        layerMeshes[j].material.needsUpdate = true;

        layerMeshesFront[j].material.map = activeBrush.maps[j];
        layerMeshesFront[j].material.needsUpdate = true;
      }
    } else {
      layerMeshes[j].visible = false;
      layerMeshesFront[j].visible = false;
    }
  }

  let updatePositions = false;
  let updateColors = false;

  for (let i = 0; i < params.amount; i++) {
    const ix = i * 3;
    const ix4 = i * 4;
    const phi = phaseArray[i];

    // Wobble Simulation
    if (params.noiseStrength > 0) {
      const time = elapsedTime * params.noiseSpeed;
      posArray[ix] = basePosArray[ix] + Math.sin(time + phi * 10) * params.noiseStrength;
      posArray[ix + 1] = basePosArray[ix + 1] + Math.cos(time + phi * 10) * params.noiseStrength;
      posArray[ix + 2] = basePosArray[ix + 2] + Math.sin(time + phi * 5) * params.noiseStrength;
      updatePositions = true;
    } else {
      posArray[ix] = basePosArray[ix];
      posArray[ix + 1] = basePosArray[ix + 1];
      posArray[ix + 2] = basePosArray[ix + 2];
      if (elapsedTime < 1) updatePositions = true;
    }

    // Color & Twinkle
    let flicker = 1.0;
    if (params.twinkle > 0) {
      const time = elapsedTime * 5;
      flicker = 1.0 - (Math.sin(time + phi * 20) * 0.5 + 0.5) * params.twinkle;
      updateColors = true;
    } else if (elapsedTime < 1) {
      updateColors = true;
    }

    const r = shiftedColorsArray[ix] * flicker;
    const g = shiftedColorsArray[ix + 1] * flicker;
    const b = shiftedColorsArray[ix + 2] * flicker;

    // Time offset for out of sync animation!
    const timeOffset = phi * params.animOffset;
    const frameIndex = Math.floor(elapsedTime * params.loopSpeed + timeOffset) % frameCount;

    // Hide/Show layers via RGBA Alpha channel per particle
    for (let j = 0; j < frameCount; j++) {
      const colArray = layerColors[j];

      if (frameCount === 1 || j === frameIndex) {
        colArray[ix4] = r;
        colArray[ix4 + 1] = g;
        colArray[ix4 + 2] = b;
        colArray[ix4 + 3] = 1.0; // Visible
      } else {
        colArray[ix4] = 0.0;
        colArray[ix4 + 1] = 0.0;
        colArray[ix4 + 2] = 0.0;
        colArray[ix4 + 3] = 0.0; // Hidden via alpha!
      }
    }
  }

  if (updatePositions) sharedPositionAttribute.needsUpdate = true;
  if (updateColors || frameCount > 1 || params.loopSpeed > 0 || params.animOffset > 0) {
    for (let j = 0; j < frameCount; j++) {
      layerMeshes[j].geometry.attributes.color.needsUpdate = true;
    }
  }

  renderer.render(scene, camera);
  rendererFront.render(sceneFront, camera);
}

initWebcam();
animate();
