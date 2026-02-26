"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface FireballThreeOverlayProps {
  leftPct: number;
  topPct: number;
  offsetXPct?: number;
  offsetYPct?: number;
  aimYaw?: number;
  aimPitch?: number;
  sizePx: number;
  lowPower?: boolean;
  mirroredInput?: boolean;
  sourceAspect?: number;
}

export default function FireballThreeOverlay({
  leftPct,
  topPct,
  offsetXPct = 0,
  offsetYPct = 0,
  aimYaw = 0,
  aimPitch = 0,
  sizePx,
  lowPower = false,
  mirroredInput = false,
  sourceAspect = 4 / 3,
}: FireballThreeOverlayProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const leftPctRef = useRef(leftPct);
  const topPctRef = useRef(topPct);
  const offsetXPctRef = useRef(offsetXPct);
  const offsetYPctRef = useRef(offsetYPct);
  const aimYawRef = useRef(aimYaw);
  const aimPitchRef = useRef(aimPitch);
  const sizePxRef = useRef(sizePx);
  const mirroredInputRef = useRef(mirroredInput);
  const sourceAspectRef = useRef(sourceAspect);

  useEffect(() => {
    leftPctRef.current = leftPct;
    topPctRef.current = topPct;
    offsetXPctRef.current = offsetXPct;
    offsetYPctRef.current = offsetYPct;
    aimYawRef.current = aimYaw;
    aimPitchRef.current = aimPitch;
    sizePxRef.current = sizePx;
    mirroredInputRef.current = mirroredInput;
    sourceAspectRef.current = sourceAspect;
  }, [leftPct, topPct, offsetXPct, offsetYPct, aimYaw, aimPitch, sizePx, mirroredInput, sourceAspect]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !lowPower,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.z = 7.2;
    const raycaster = new THREE.Raycaster();
    const anchorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const anchorTarget = new THREE.Vector3(0, 0, 0);
    const anchorWorld = new THREE.Vector3(0, 0, 0);
    const smoothedAim = new THREE.Vector2(0, 0);
    const ndc = new THREE.Vector2(0, 0);

    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    const textureLoader = new THREE.TextureLoader();
    const fireTexture = textureLoader.load("/fire2.png");

    const particleCount = lowPower ? 900 : 1600;
    const baseRadius = new Float32Array(particleCount);
    const phase = new Float32Array(particleCount);
    const drift = new Float32Array(particleCount);
    const spinOffset = new Float32Array(particleCount);
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const orangeA = new THREE.Color("#ffb347");
    const orangeB = new THREE.Color("#ff6a00");
    const orangeC = new THREE.Color("#ffd26a");

    for (let i = 0; i < particleCount; i += 1) {
      const i3 = i * 3;
      const r = Math.pow(Math.random(), 0.62);
      baseRadius[i] = r;
      phase[i] = Math.random() * Math.PI * 2;
      drift[i] = Math.random() * Math.PI * 2;
      spinOffset[i] = Math.random() * Math.PI * 2;
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;

      const mixA = Math.random();
      const mixB = Math.random();
      const c = orangeA.clone().lerp(orangeB, mixA).lerp(orangeC, mixB * 0.38);
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;
    }

    const orbGeometry = new THREE.BufferGeometry();
    const positionAttr = new THREE.BufferAttribute(positions, 3);
    orbGeometry.setAttribute("position", positionAttr);
    orbGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const orbMaterial = new THREE.PointsMaterial({
      size: lowPower ? 0.26 : 0.32,
      map: fireTexture,
      transparent: true,
      opacity: 0.93,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });

    const orbPoints = new THREE.Points(orbGeometry, orbMaterial);
    orbGroup.add(orbPoints);

    const emberCount = lowPower ? 260 : 460;
    const emberBase = new Float32Array(emberCount);
    const emberPhase = new Float32Array(emberCount);
    const emberPos = new Float32Array(emberCount * 3);
    const emberColor = new Float32Array(emberCount * 3);

    for (let i = 0; i < emberCount; i += 1) {
      const i3 = i * 3;
      emberBase[i] = Math.random();
      emberPhase[i] = Math.random() * Math.PI * 2;
      emberPos[i3] = 0;
      emberPos[i3 + 1] = 0;
      emberPos[i3 + 2] = 0;
      emberColor[i3] = 1.0;
      emberColor[i3 + 1] = 0.45 + Math.random() * 0.3;
      emberColor[i3 + 2] = 0.12;
    }

    const emberGeometry = new THREE.BufferGeometry();
    const emberPosAttr = new THREE.BufferAttribute(emberPos, 3);
    emberGeometry.setAttribute("position", emberPosAttr);
    emberGeometry.setAttribute("color", new THREE.BufferAttribute(emberColor, 3));

    const emberMaterial = new THREE.PointsMaterial({
      size: lowPower ? 0.09 : 0.12,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      sizeAttenuation: true,
    });
    const emberPoints = new THREE.Points(emberGeometry, emberMaterial);
    orbGroup.add(emberPoints);

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
      const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
      const rawX = clamp01((leftPctRef.current + offsetXPctRef.current) / 100);
      const rawY = clamp01((topPctRef.current + offsetYPctRef.current) / 100);
      const inputX = mirroredInputRef.current ? (1 - rawX) : rawX;

      const srcAspect = Math.max(0.1, Number(sourceAspectRef.current || (4 / 3)));
      const dstAspect = Math.max(0.1, camera.aspect || 1);
      let mappedX = inputX;
      let mappedY = rawY;
      if (srcAspect > dstAspect) {
        const renderedW = srcAspect / dstAspect;
        const cropX = (renderedW - 1) * 0.5;
        mappedX = (inputX * renderedW) - cropX;
      } else if (srcAspect < dstAspect) {
        const renderedH = dstAspect / srcAspect;
        const cropY = (renderedH - 1) * 0.5;
        mappedY = (rawY * renderedH) - cropY;
      }
      const tunedX = clamp01(0.5 + ((mappedX - 0.5) * 0.9));
      const tunedY = clamp01(0.5 + ((mappedY - 0.5) * 0.9));
      ndc.set((tunedX * 2) - 1, -((tunedY * 2) - 1));
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(anchorPlane, anchorTarget)) {
        anchorWorld.lerp(anchorTarget, 0.42);
      }

      const targetAimX = Math.max(-1, Math.min(1, aimYawRef.current || 0));
      const targetAimY = Math.max(-1, Math.min(1, aimPitchRef.current || 0));
      smoothedAim.x += (targetAimX - smoothedAim.x) * 0.2;
      smoothedAim.y += (targetAimY - smoothedAim.y) * 0.2;

      const pulse = 1 + (Math.sin(t * 8.2) * 0.07);

      for (let i = 0; i < particleCount; i += 1) {
        const i3 = i * 3;
        const swirl = (t * (2.1 + (baseRadius[i] * 2.5))) + spinOffset[i];
        const radius = (0.16 + (baseRadius[i] * 1.8)) * (0.82 + (Math.sin(t * 2.4 + phase[i]) * 0.18));
        const tube = Math.max(0.2, 1 - (baseRadius[i] * 0.55));
        const z = -2.8 + (((t * 3.8) + drift[i]) % 5.6);
        const travel = Math.max(0, Math.min(1, (z + 2.8) / 5.6));
        positions[i3] = (Math.cos(swirl) * radius) + (smoothedAim.x * travel * 2.25);
        positions[i3 + 1] = (Math.sin(swirl) * radius * tube) + (Math.sin(t * 1.8 + phase[i]) * 0.16) + (smoothedAim.y * travel * 1.6);
        positions[i3 + 2] = z;
      }
      positionAttr.needsUpdate = true;

      for (let i = 0; i < emberCount; i += 1) {
        const i3 = i * 3;
        const life = ((t * 1.15) + emberBase[i]) % 1;
        const dist = 0.35 + (life * 2.6);
        const ang = emberPhase[i] + (t * (0.7 + (emberBase[i] * 0.9)));
        emberPos[i3] = (Math.cos(ang) * dist * 0.7) + (smoothedAim.x * life * 1.8);
        emberPos[i3 + 1] = (Math.sin(ang) * dist * 0.45) + (smoothedAim.y * life * 1.25);
        emberPos[i3 + 2] = -2.4 + (life * 4.2);
      }
      emberPosAttr.needsUpdate = true;

      orbGroup.rotation.z = Math.sin(t * 1.5) * 0.17;
      orbGroup.rotation.y = (Math.cos(t * 1.2) * 0.14) + (smoothedAim.x * 0.42);
      orbGroup.rotation.x = (Math.sin(t * 1.1) * 0.05) - (smoothedAim.y * 0.34);
      orbGroup.position.copy(anchorWorld);
      const sizeScale = Math.max(0.6, Math.min(2.45, sizePxRef.current / 280));
      orbGroup.scale.setScalar(sizeScale * pulse);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      orbGeometry.dispose();
      orbMaterial.dispose();
      emberGeometry.dispose();
      emberMaterial.dispose();
      fireTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [lowPower]);

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        filter: "drop-shadow(0 0 28px rgba(255, 120, 20, 0.42))",
      }}
    >
      <div ref={mountRef} className="h-full w-full" />
    </div>
  );
}
