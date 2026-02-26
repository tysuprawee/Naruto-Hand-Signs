"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface SharinganCrowOverlayProps {
  lowPower?: boolean;
}

const PRESET = {
  amount: 600,
  size: 15,
  opacity: 0.9,
  spread: 1.64,
  spinSpeed: 2.36,
  noiseStrength: 3.4,
  noiseSpeed: 5,
  twinkle: 0.9,
  loopSpeed: 5,
  animOffset: 5,
};

export default function SharinganCrowOverlay({ lowPower = false }: SharinganCrowOverlayProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !lowPower,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.z = 50;

    const textureLoader = new THREE.TextureLoader();
    const crowA = textureLoader.load("/crow.png");
    const crowB = textureLoader.load("/crow2.png");
    const frameMaps = [crowA, crowB];

    const particleCount = lowPower ? 280 : PRESET.amount;
    const layers = frameMaps.length;
    const positions = new Float32Array(particleCount * 3);
    const basePos = new Float32Array(particleCount * 3);
    const phase = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i += 1) {
      const i3 = i * 3;
      const r = 80 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((2 * Math.random()) - 1);
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      basePos[i3] = x;
      basePos[i3 + 1] = y;
      basePos[i3 + 2] = z;
      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;
      phase[i] = Math.random() * Math.PI * 2;
    }

    const sharedPosAttr = new THREE.BufferAttribute(positions, 3);
    const group = new THREE.Group();
    group.scale.setScalar(PRESET.spread);
    scene.add(group);

    const colorArrays: Float32Array[] = [];
    const colorAttrs: THREE.BufferAttribute[] = [];
    const meshes: THREE.Points[] = [];

    for (let layer = 0; layer < layers; layer += 1) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", sharedPosAttr);
      const colors = new Float32Array(particleCount * 4);
      const colorAttr = new THREE.BufferAttribute(colors, 4);
      geom.setAttribute("color", colorAttr);

      const mat = new THREE.PointsMaterial({
        size: lowPower ? PRESET.size * 0.72 : PRESET.size,
        map: frameMaps[layer],
        transparent: true,
        opacity: PRESET.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
        vertexColors: true,
      });

      const points = new THREE.Points(geom, mat);
      meshes.push(points);
      colorArrays.push(colors);
      colorAttrs.push(colorAttr);
      group.add(points);
    }

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      const t = clock.getElapsedTime();

      for (let i = 0; i < particleCount; i += 1) {
        const i3 = i * 3;
        const i4 = i * 4;

        const wobbleX = Math.sin((t * PRESET.noiseSpeed) + (phase[i] * 10)) * PRESET.noiseStrength;
        const wobbleY = Math.cos((t * PRESET.noiseSpeed) + (phase[i] * 10)) * PRESET.noiseStrength;
        const wobbleZ = Math.sin((t * PRESET.noiseSpeed) + (phase[i] * 5)) * PRESET.noiseStrength;
        positions[i3] = basePos[i3] + wobbleX;
        positions[i3 + 1] = basePos[i3 + 1] + wobbleY;
        positions[i3 + 2] = basePos[i3 + 2] + wobbleZ;

        const flicker = 1 - (((Math.sin((t * 5) + (phase[i] * 20)) * 0.5) + 0.5) * PRESET.twinkle);
        const red = Math.max(0.25, Math.min(1, 0.86 * flicker));
        const green = Math.max(0.05, Math.min(1, 0.18 * flicker));
        const blue = Math.max(0.05, Math.min(1, 0.1 * flicker));

        const frameIndex = Math.floor((t * PRESET.loopSpeed) + (phase[i] * PRESET.animOffset)) % layers;
        for (let layer = 0; layer < layers; layer += 1) {
          const colors = colorArrays[layer];
          const visible = layer === frameIndex;
          colors[i4] = visible ? red : 0;
          colors[i4 + 1] = visible ? green : 0;
          colors[i4 + 2] = visible ? blue : 0;
          colors[i4 + 3] = visible ? 1 : 0;
        }
      }

      sharedPosAttr.needsUpdate = true;
      for (const attr of colorAttrs) {
        attr.needsUpdate = true;
      }

      group.rotation.z -= 0.001 * PRESET.spinSpeed;
      group.rotation.y = Math.sin(t * 0.4) * 0.18;
      group.rotation.x = Math.cos(t * 0.35) * 0.1;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.PointsMaterial).dispose();
      }
      crowA.dispose();
      crowB.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [lowPower]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2]"
      style={{ filter: "drop-shadow(0 0 24px rgba(120, 20, 20, 0.4))" }}
    >
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
