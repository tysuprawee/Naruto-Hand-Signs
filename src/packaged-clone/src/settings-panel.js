export const PRESET_SYNC_SLIDER_IDS = [
  'amount',
  'frontAmount',
  'size',
  'opacity',
  'overallScale',
  'handDistanceOverallControl',
  'spread',
  'spin',
  'noiseStrength',
  'noiseSpeed',
  'twinkle',
  'handIntensity',
  'handSpreadControl',
  'handSizeControl',
  'handForeOffsetForward',
  'handForeOffsetSide',
  'mouseForce',
  'hue',
  'saturation',
  'brightness',
  'fog',
  'loopSpeed',
  'animOffset',
  'closeBlur',
  'bloodScaleW',
  'bloodScaleH',
  'bloodOffsetX',
  'bloodOffsetY',
  'bloodBend',
  'bloodDarkness',
  'bloodLightness',
  'eyeBlend',
  'eyeShadow',
  'eyeLight',
  'eyeGlow',
  'eyeReflect'
];

export function createSlider(id, label, min, max, step, val, format = (v) => Number(v).toFixed(2)) {
  return `
    <div class="slider-container">
      <div class="slider-header"><label>${label}</label><span id="val-${id}">${format(val)}</span></div>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}">
    </div>
  `;
}

export function createSettingsPanels({
  params,
  maxParticles,
  moveName,
  lockedBrushName
}) {
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'controls-ui';

  controlsContainer.innerHTML = `
    <div class="panel-header" id="panel-header">
      <h3>${moveName}</h3>
      <button id="minimize-btn" type="button">_</button>
    </div>
    <div class="controls-group">
      <button id="home-btn" type="button">Back to Moves</button>
      <button id="locked-brush-btn" type="button" disabled>Brush Locked: ${lockedBrushName}</button>
      <button id="toggle-blend-btn" type="button">Blend: ${params.additive ? 'Additive' : 'Normal'}</button>
      <button id="toggle-hand-dist-invert-btn" type="button">Hand Dist: ${params.handDistanceOverallInvert ? 'Inverse' : 'Normal'}</button>

      <div style="display: flex; gap: 0.5rem; justify-content: space-between;">
        <button id="save-preset-btn" type="button" style="flex: 1;">Save Browser</button>
        <button id="reset-btn" type="button" style="flex: 1;">Reset</button>
      </div>

      <div style="display: flex; gap: 0.5rem; justify-content: space-between;">
        <button id="export-preset-btn" type="button" style="flex: 1; background: rgba(0, 200, 255, 0.2);">Export .json</button>
        <button id="import-preset-btn" type="button" style="flex: 1; background: rgba(0, 200, 255, 0.2);">Import .json</button>
      </div>
      <input type="file" id="import-preset-file" accept=".json" style="display: none;">
    </div>
    ${createSlider('amount', 'Back Amount', 100, maxParticles, 100, params.amount, v => Math.round(v))}
    ${createSlider('frontAmount', 'Front Amount', 0, maxParticles, 10, params.frontAmount, v => Math.round(v))}
    ${createSlider('size', 'Size', 0.1, 15.0, 0.1, params.size)}
    ${createSlider('opacity', 'Opacity', 0.0, 1.0, 0.01, params.opacity)}
    ${createSlider('overallScale', 'Overall Size', 0.1, 3.0, 0.01, params.overallScale)}
    ${createSlider('handDistanceOverallControl', 'Hand Dist Overall', 0.0, 2.0, 0.01, params.handDistanceOverallControl)}
    ${createSlider('spread', 'Spread', 0.1, 5.0, 0.01, params.spread)}
    ${createSlider('spin', 'Spin Speed', 0.0, 5.0, 0.01, params.spinSpeed, v => v + 'x')}
    ${createSlider('noiseStrength', 'Wobble', 0.0, 10.0, 0.1, params.noiseStrength)}
    ${createSlider('noiseSpeed', 'Wobble Speed', 0.1, 5.0, 0.1, params.noiseSpeed)}
    ${createSlider('twinkle', 'Twinkle', 0.0, 1.0, 0.01, params.twinkle)}
    ${createSlider('handIntensity', 'Hand Intensity', 0.0, 2.0, 0.01, params.handIntensity)}
    ${createSlider('handSpreadControl', 'Hand Spread', 0.0, 2.0, 0.01, params.handSpreadControl)}
    ${createSlider('handSizeControl', 'Hand Size', 0.0, 2.0, 0.01, params.handSizeControl)}
    ${createSlider('handForeOffsetForward', 'Forehand Fwd', -0.4, 0.6, 0.01, params.handForeOffsetForward)}
    ${createSlider('handForeOffsetSide', 'Forehand Side', -0.4, 0.4, 0.01, params.handForeOffsetSide)}
    ${createSlider('mouseForce', 'Mouse Pull', 0.0, 0.2, 0.001, params.mouseForce, v => Number(v).toFixed(3))}
    ${createSlider('hue', 'Hue Shift', 0.0, 1.0, 0.01, params.hue)}
    ${createSlider('saturation', 'Saturation', 0.0, 3.0, 0.01, params.saturation)}
    ${createSlider('brightness', 'Brightness', 0.0, 3.0, 0.01, params.brightness)}
    ${createSlider('fog', 'Fog Density', 0.0, 0.05, 0.001, params.fog, v => Number(v).toFixed(3))}
    ${createSlider('loopSpeed', 'Anim Speed', 0.0, 20.0, 0.5, params.loopSpeed)}
    ${createSlider('animOffset', 'Time Shift', 0.0, 50.0, 0.5, params.animOffset)}
    ${createSlider('closeBlur', 'Close Blur', 0.0, 1.0, 0.01, params.closeBlur)}
  `;
  document.body.appendChild(controlsContainer);

  const meshContainer = document.createElement('div');
  meshContainer.id = 'mesh-ui';
  meshContainer.style.display = 'none';
  meshContainer.style.position = 'absolute';
  meshContainer.style.bottom = '20px';
  meshContainer.style.right = '20px';
  meshContainer.style.background = 'rgba(0, 0, 0, 0.8)';
  meshContainer.style.padding = '1rem';
  meshContainer.style.color = '#fff';
  meshContainer.style.zIndex = '100';
  meshContainer.style.border = '1px solid #ff0000';
  meshContainer.innerHTML = `
    <h3 style="margin-top:0; color:#ff4444;">Blood Mesh Mapping</h3>
    <button id="toggle-blood-btn" type="button" style="width:100%; margin-bottom:0.5rem; padding:0.4rem; background:rgba(255,0,0,0.2); border:1px solid #ff4444; color:#fff; cursor:pointer;">Blood FX: ${params.bloodEnabled !== false ? 'ON' : 'OFF'}</button>
    ${createSlider('bloodScaleW', 'Scale X', 1.0, 10.0, 0.1, params.bloodScaleW)}
    ${createSlider('bloodScaleH', 'Scale Y', 1.0, 10.0, 0.1, params.bloodScaleH)}
    ${createSlider('bloodOffsetX', 'Offset X', -2.0, 2.0, 0.01, params.bloodOffsetX)}
    ${createSlider('bloodOffsetY', 'Offset Y', -2.0, 2.0, 0.01, params.bloodOffsetY)}
    ${createSlider('bloodBend', 'Mesh Bend', -5.0, 5.0, 0.1, params.bloodBend)}
    <h3 style="margin-top:1rem; margin-bottom:0.5rem; color:#ff4444;">Blood Blend</h3>
    ${createSlider('bloodDarkness', 'Darkness', 0.0, 2.0, 0.01, params.bloodDarkness)}
    ${createSlider('bloodLightness', 'Lightness', 0.0, 2.0, 0.01, params.bloodLightness)}
    <h3 style="margin-top:1rem; margin-bottom:0.5rem; color:#ff4444;">Eye Blend</h3>
    ${createSlider('eyeBlend', 'Blend', 0.0, 1.0, 0.01, params.eyeBlend)}
    ${createSlider('eyeShadow', 'Shadow', 0.0, 1.0, 0.01, params.eyeShadow)}
    ${createSlider('eyeLight', 'Light', 0.0, 1.0, 0.01, params.eyeLight)}
    ${createSlider('eyeGlow', 'Glow', 0.0, 2.0, 0.01, params.eyeGlow)}
    ${createSlider('eyeReflect', 'Reflection', 0.0, 1.0, 0.01, params.eyeReflect)}
  `;

  document.body.appendChild(meshContainer);

  return { controlsContainer, meshContainer };
}

export function bindSlider({
  id,
  paramKey,
  params,
  callback,
  format = (v) => Number(v).toFixed(2)
}) {
  const slider = document.getElementById(id);
  const valDisplay = document.getElementById(`val-${id}`);

  if (!slider || !valDisplay) {
    return;
  }

  slider.addEventListener('input', (e) => {
    params[paramKey] = parseFloat(e.target.value);
    valDisplay.innerText = format(params[paramKey]);
    if (callback) {
      callback(params[paramKey]);
    }
  });
}
