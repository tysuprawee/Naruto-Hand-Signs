export const CROW_BRUSH_INDEX = 4;
export const DEFAULT_GLOW_BRUSH_INDEX = 0;

const SHARINGAN_PRESET = {
  brushIndex: CROW_BRUSH_INDEX,
  amount: 600,
  frontAmount: 0,
  size: 15,
  opacity: 0.9,
  spread: 1.64,
  spinSpeed: 2.36,
  noiseStrength: 3.4,
  noiseSpeed: 5,
  mouseForce: 0.008,
  hue: 0,
  saturation: 1,
  brightness: 1,
  twinkle: 0.9,
  fog: 0,
  loopSpeed: 5,
  animOffset: 5,
  closeBlur: 0.02,
  additive: true,
  bloodScaleW: 2.5,
  bloodScaleH: 7,
  bloodOffsetX: 0.02,
  bloodOffsetY: -0.33,
  bloodBend: -0.2,
  bloodDarkness: 1.38,
  bloodLightness: 2,
  eyeBlend: 0.83,
  eyeShadow: 0.4,
  eyeLight: 1,
  eyeGlow: 2,
  eyeReflect: 0.61
};

const SHADOW_CLONE_PRESET = {
  ...SHARINGAN_PRESET,
  amount: 600,
  frontAmount: 0
};

const RASENGAN_PRESET = {
  ...SHARINGAN_PRESET,
  brushIndex: DEFAULT_GLOW_BRUSH_INDEX,
  amount: 2200,
  frontAmount: 1200,
  size: 5.2,
  opacity: 0.95,
  spread: 0.42,
  spinSpeed: 4.4,
  noiseStrength: 2.2,
  noiseSpeed: 4.8,
  mouseForce: 0.01,
  hue: 0.53,
  saturation: 1.35,
  brightness: 1.28,
  twinkle: 0.2,
  fog: 0
};

export const MOVES = [
  {
    id: 'charingane',
    name: 'Charingan Move',
    description: 'Locked crow brush with your provided sharingan-style preset.',
    href: '/charingane.html',
    preset: SHARINGAN_PRESET,
    lockedBrushIndex: CROW_BRUSH_INDEX,
    triggerMode: 'charged',
    particlesEnabled: true,
    useLandmarkers: true,
    shadowClone: null
  },
  {
    id: 'shadowclone',
    name: 'Shadow Clone',
    description: 'Normal middle webcam with two side foreground clones and particles off.',
    href: '/shadowclone.html',
    preset: SHADOW_CLONE_PRESET,
    lockedBrushIndex: CROW_BRUSH_INDEX,
    triggerMode: 'manual',
    triggerButtonLabel: 'Trigger Shadow Clone',
    disableButtonLabel: 'Disable Shadow Clone',
    particlesEnabled: false,
    useLandmarkers: false,
    shadowClone: {
      offsetRatio: 0.3,
      scale: 1.0,
      opacity: 0.92,
      enterDurationMs: 650,
      blinkSpeed: 24.0,
      blinkDepth: 0.5,
      smokeEnabled: true,
      smokeOpacity: 0.65,
      smokeScale: 1.2,
      smokeRise: 0.14,
      smokeMaskToClone: false
    }
  },
  {
    id: 'rasengan',
    name: 'Rasengan',
    description: 'Manual trigger blue orb that follows your hand movement.',
    href: '/rasengan.html',
    preset: RASENGAN_PRESET,
    lockedBrushIndex: DEFAULT_GLOW_BRUSH_INDEX,
    triggerMode: 'manual',
    triggerButtonLabel: 'Trigger Rasengan',
    disableButtonLabel: 'Disable Rasengan',
    particlesEnabled: true,
    useLandmarkers: true,
    useForegroundSegmentation: false,
    shadowClone: null,
    rasengan: {
      orbRadius: 0.42,
      followStrength: 0.14,
      spinBoost: 1.9,
      handOffsetForward: 0.18,
      handOffsetSide: 0.0
    }
  }
];

export const DEFAULT_MOVE_ID = 'charingane';

export function getMoveById(moveId) {
  return MOVES.find((move) => move.id === moveId) ?? MOVES.find((move) => move.id === DEFAULT_MOVE_ID) ?? MOVES[0];
}
