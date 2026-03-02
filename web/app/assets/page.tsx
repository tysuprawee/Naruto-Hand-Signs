"use client";

import Link from "next/link";
import FireShader from "../components/fire-shader";

type AssetDef = {
  id: string;
  name: string;
  note: string;
};

const ASSETS: AssetDef[] = [
  { id: "black_fire_landing", name: "Black Fire (Landing)", note: "Hero-style masked black fire plume." },
  { id: "chakra_orb", name: "Chakra Orb", note: "Palm energy sphere with pulse halo." },
  { id: "fireball_core", name: "Fireball Core", note: "Compressed flame core with ember drift." },
  { id: "chidori_arc", name: "Chidori Arc", note: "Lightning spikes with unstable flicker." },
  { id: "shadow_clone_echo", name: "Shadow Clone Echo", note: "Layered clone after-images." },
  { id: "smoke_substitution", name: "Smoke Substitution", note: "Fast smoke puffs and fade." },
  { id: "seal_ring", name: "Seal Ring", note: "Rotating chakra seal rings." },
  { id: "shuriken_spin", name: "Shuriken Spin", note: "Multi-star rotational throw loop." },
  { id: "reaper_aura", name: "Reaper Aura", note: "Dark-red vortex aura backdrop." },
  { id: "water_whorl", name: "Water Whorl", note: "Rotating water current with spray ripples." },
  { id: "wind_sickle", name: "Wind Sickle", note: "Cutting wind crescents in orbital sweep." },
  { id: "earth_pillar", name: "Earth Pillar", note: "Stone pillars rising with dust shake." },
  { id: "lightning_web", name: "Lightning Web", note: "Crackling electric net around a core." },
  { id: "crow_swarm", name: "Crow Swarm", note: "Dark flock silhouettes circling target." },
  { id: "paper_talisman", name: "Paper Talisman", note: "Floating seals with ritual drift." },
  { id: "moon_blade", name: "Moon Blade", note: "Lunar crescent slash arc." },
  { id: "lava_burst", name: "Lava Burst", note: "Molten core eruption with hot droplets." },
  { id: "frost_bloom", name: "Frost Bloom", note: "Ice crystal expansion ring." },
  { id: "poison_mist", name: "Poison Mist", note: "Toxic vapor cloud with pulse glow." },
  { id: "sand_vortex", name: "Sand Vortex", note: "Desert spiral with grain stream." },
  { id: "phoenix_wing", name: "Phoenix Wing", note: "Flaming wing flare and feather embers." },
];

function AssetPreview({ id }: { id: string }) {
  return (
    <div className={`preview ${id}`}>
      {id === "black_fire_landing" && (
        <div className="black-fire">
          <div className="black-fire-mask">
            <FireShader className="black-fire-canvas" height="100%" opacity={1} enableAudio={false} />
          </div>
          <div className="black-fire-fade" />
        </div>
      )}

      {id === "chakra_orb" && (
        <>
          <div className="fx chakra-glow" />
          <div className="fx chakra-core" />
          <div className="fx chakra-ring chakra-ring-a" />
          <div className="fx chakra-ring chakra-ring-b" />
        </>
      )}

      {id === "fireball_core" && (
        <>
          <div className="fx fire-core" />
          <div className="fx fire-heat" />
          <div className="fx ember ember-a" />
          <div className="fx ember ember-b" />
          <div className="fx ember ember-c" />
        </>
      )}

      {id === "chidori_arc" && (
        <>
          <div className="fx chidori-core" />
          <div className="fx bolt bolt-a" />
          <div className="fx bolt bolt-b" />
          <div className="fx bolt bolt-c" />
          <div className="fx bolt bolt-d" />
        </>
      )}

      {id === "shadow_clone_echo" && (
        <>
          <div className="fx clone clone-main" />
          <div className="fx clone clone-left" />
          <div className="fx clone clone-right" />
        </>
      )}

      {id === "smoke_substitution" && (
        <>
          <div className="fx smoke smoke-a" />
          <div className="fx smoke smoke-b" />
          <div className="fx smoke smoke-c" />
          <div className="fx smoke smoke-d" />
        </>
      )}

      {id === "seal_ring" && (
        <>
          <div className="fx seal seal-outer" />
          <div className="fx seal seal-mid" />
          <div className="fx seal seal-inner" />
          <div className="fx seal-dot" />
        </>
      )}

      {id === "shuriken_spin" && (
        <>
          <div className="fx star star-a" />
          <div className="fx star star-b" />
          <div className="fx star star-c" />
        </>
      )}

      {id === "reaper_aura" && (
        <>
          <div className="fx reaper-vortex" />
          <div className="fx reaper-ring reaper-ring-a" />
          <div className="fx reaper-ring reaper-ring-b" />
          <div className="fx reaper-core" />
        </>
      )}

      {id === "water_whorl" && (
        <>
          <div className="fx water-core" />
          <div className="fx water-ring water-ring-a" />
          <div className="fx water-ring water-ring-b" />
          <div className="fx water-stream water-stream-a" />
          <div className="fx water-stream water-stream-b" />
        </>
      )}

      {id === "wind_sickle" && (
        <>
          <div className="fx wind-sweep wind-sweep-a" />
          <div className="fx wind-sweep wind-sweep-b" />
          <div className="fx wind-sweep wind-sweep-c" />
          <div className="fx wind-dot" />
        </>
      )}

      {id === "earth_pillar" && (
        <>
          <div className="fx earth-pillar earth-pillar-a" />
          <div className="fx earth-pillar earth-pillar-b" />
          <div className="fx earth-pillar earth-pillar-c" />
          <div className="fx earth-dust" />
        </>
      )}

      {id === "lightning_web" && (
        <>
          <div className="fx web-core" />
          <div className="fx web-line web-line-a" />
          <div className="fx web-line web-line-b" />
          <div className="fx web-line web-line-c" />
          <div className="fx web-line web-line-d" />
          <div className="fx web-ring" />
        </>
      )}

      {id === "crow_swarm" && (
        <>
          <div className="fx crow crow-a" />
          <div className="fx crow crow-b" />
          <div className="fx crow crow-c" />
          <div className="fx crow crow-d" />
          <div className="fx crow-shadow" />
        </>
      )}

      {id === "paper_talisman" && (
        <>
          <div className="fx talisman talisman-a" />
          <div className="fx talisman talisman-b" />
          <div className="fx talisman talisman-c" />
          <div className="fx talisman talisman-d" />
          <div className="fx talisman-glow" />
        </>
      )}

      {id === "moon_blade" && (
        <>
          <div className="fx moon-core" />
          <div className="fx moon-crescent" />
          <div className="fx moon-slash moon-slash-a" />
          <div className="fx moon-slash moon-slash-b" />
        </>
      )}

      {id === "lava_burst" && (
        <>
          <div className="fx lava-core" />
          <div className="fx lava-bubble lava-bubble-a" />
          <div className="fx lava-bubble lava-bubble-b" />
          <div className="fx lava-bubble lava-bubble-c" />
          <div className="fx lava-wave" />
        </>
      )}

      {id === "frost_bloom" && (
        <>
          <div className="fx frost-core" />
          <div className="fx frost-ray frost-ray-a" />
          <div className="fx frost-ray frost-ray-b" />
          <div className="fx frost-ray frost-ray-c" />
          <div className="fx frost-ray frost-ray-d" />
          <div className="fx frost-ring" />
        </>
      )}

      {id === "poison_mist" && (
        <>
          <div className="fx poison-core" />
          <div className="fx poison-cloud poison-cloud-a" />
          <div className="fx poison-cloud poison-cloud-b" />
          <div className="fx poison-cloud poison-cloud-c" />
          <div className="fx poison-cloud poison-cloud-d" />
        </>
      )}

      {id === "sand_vortex" && (
        <>
          <div className="fx sand-core" />
          <div className="fx sand-ring sand-ring-a" />
          <div className="fx sand-ring sand-ring-b" />
          <div className="fx sand-grain sand-grain-a" />
          <div className="fx sand-grain sand-grain-b" />
          <div className="fx sand-grain sand-grain-c" />
        </>
      )}

      {id === "phoenix_wing" && (
        <>
          <div className="fx phoenix-core" />
          <div className="fx phoenix-wing phoenix-wing-left" />
          <div className="fx phoenix-wing phoenix-wing-right" />
          <div className="fx phoenix-feather phoenix-feather-a" />
          <div className="fx phoenix-feather phoenix-feather-b" />
        </>
      )}
    </div>
  );
}

export default function AssetsPage() {
  return (
    <main className="assets-page">
      <div className="assets-shell">
        <div className="assets-head">
          <div>
            <p className="kicker">Animation Sandbox</p>
            <h1>Ninja Assets</h1>
            <p className="sub">Autoplay previews with labels. Pick the IDs you want to keep.</p>
          </div>
          <Link href="/play" className="back-link">
            Back to Play
          </Link>
        </div>

        <div className="assets-grid">
          {ASSETS.map((asset) => (
            <article key={asset.id} className="asset-card">
              <AssetPreview id={asset.id} />
              <div className="asset-meta">
                <p className="asset-id">ID: {asset.id}</p>
                <p className="asset-name">{asset.name}</p>
                <p className="asset-note">{asset.note}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style jsx global>{`
        .assets-page {
          min-height: 100vh;
          background:
            radial-gradient(circle at 10% 10%, rgba(34, 211, 238, 0.08), transparent 34%),
            radial-gradient(circle at 90% 15%, rgba(251, 146, 60, 0.1), transparent 36%),
            linear-gradient(180deg, #0a0d16 0%, #06070d 100%);
          color: #f4f5f8;
          padding: 28px 16px 40px;
        }

        .assets-page .assets-shell {
          max-width: 1180px;
          margin: 0 auto;
        }

        .assets-page .assets-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .assets-page .kicker {
          margin: 0;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #67e8f9;
          font-weight: 800;
        }

        .assets-page h1 {
          margin: 6px 0 0;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.05;
          letter-spacing: -0.02em;
        }

        .assets-page .sub {
          margin: 8px 0 0;
          color: #9ca3af;
          font-size: 14px;
        }

        .assets-page .back-link {
          border: 1px solid rgba(110, 231, 255, 0.35);
          color: #c7f8ff;
          text-decoration: none;
          font-size: 13px;
          font-weight: 700;
          border-radius: 10px;
          padding: 9px 12px;
          background: rgba(8, 23, 33, 0.5);
          white-space: nowrap;
        }

        .assets-page .assets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 14px;
        }

        .assets-page .asset-card {
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 16px;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(17, 24, 39, 0.9), rgba(8, 10, 18, 0.95));
          box-shadow: 0 12px 34px rgba(0, 0, 0, 0.35);
        }

        .assets-page .preview {
          position: relative;
          height: 170px;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 30%, rgba(148, 163, 184, 0.08), transparent 46%),
            linear-gradient(180deg, rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.95));
          isolation: isolate;
        }

        .assets-page .asset-meta {
          margin-top: auto;
          padding: 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
        }

        .assets-page .black-fire {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(2, 6, 23, 0.45), rgba(2, 6, 23, 0.95));
          overflow: hidden;
        }

        .assets-page .black-fire-mask {
          position: absolute;
          inset: -26% -8% -18% -8%;
          mix-blend-mode: multiply;
          opacity: 1;
          -webkit-mask-image:
            linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0) 0%,
              rgba(0, 0, 0, 0.98) 20%,
              rgba(0, 0, 0, 0.92) 58%,
              rgba(0, 0, 0, 0.35) 78%,
              rgba(0, 0, 0, 0) 100%
            );
          mask-image:
            linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0) 0%,
              rgba(0, 0, 0, 0.98) 20%,
              rgba(0, 0, 0, 0.92) 58%,
              rgba(0, 0, 0, 0.35) 78%,
              rgba(0, 0, 0, 0) 100%
            );
        }

        .assets-page .black-fire-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .assets-page .black-fire-fade {
          position: absolute;
          inset: auto 0 0 0;
          height: 44%;
          background: linear-gradient(180deg, rgba(2, 6, 23, 0), rgba(2, 6, 23, 0.82) 56%, rgba(2, 6, 23, 1) 100%);
          pointer-events: none;
        }

        .assets-page .asset-id {
          margin: 0;
          color: #67e8f9;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .assets-page .asset-name {
          margin: 6px 0 0;
          font-size: 19px;
          font-weight: 800;
          line-height: 1.15;
        }

        .assets-page .asset-note {
          margin: 6px 0 0;
          color: #a1a1aa;
          font-size: 13px;
          line-height: 1.35;
        }

        .assets-page .fx {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
        }

        .assets-page .chakra-glow {
          width: 140px;
          height: 140px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(103, 232, 249, 0.45), rgba(34, 211, 238, 0) 72%);
          filter: blur(6px);
          animation: pulseSoft 1.8s ease-in-out infinite;
        }

        .assets-page .chakra-core {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 30%, #ffffff, #7dd3fc 40%, rgba(59, 130, 246, 0.15) 80%);
          box-shadow: 0 0 24px rgba(56, 189, 248, 0.8);
          animation: pulseHard 1s ease-in-out infinite;
        }

        .assets-page .chakra-ring {
          border: 1px solid rgba(103, 232, 249, 0.7);
          border-radius: 999px;
        }

        .assets-page .chakra-ring-a {
          width: 70px;
          height: 70px;
          animation: spin 2.2s linear infinite;
        }

        .assets-page .chakra-ring-b {
          width: 98px;
          height: 98px;
          animation: spinRev 2.6s linear infinite;
          opacity: 0.6;
        }

        .assets-page .fire-core {
          width: 60px;
          height: 60px;
          border-radius: 999px;
          background: radial-gradient(circle at 30% 25%, #fff7ed, #fb923c 35%, #ea580c 70%, rgba(239, 68, 68, 0.2) 92%);
          box-shadow: 0 0 32px rgba(249, 115, 22, 0.75);
          animation: pulseHard 0.7s ease-in-out infinite;
        }

        .assets-page .fire-heat {
          width: 116px;
          height: 90px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(249, 115, 22, 0.32), transparent 72%);
          filter: blur(9px);
          animation: breathe 1.1s ease-in-out infinite;
        }

        .assets-page .ember {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #fdba74;
          box-shadow: 0 0 14px rgba(251, 146, 60, 0.85);
          animation: emberRise 1.25s linear infinite;
        }

        .assets-page .ember-a {
          margin-left: -38px;
          animation-delay: 0.1s;
        }

        .assets-page .ember-b {
          margin-left: 20px;
          animation-delay: 0.55s;
        }

        .assets-page .ember-c {
          margin-left: 46px;
          animation-delay: 0.9s;
        }

        .assets-page .chidori-core {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          background: radial-gradient(circle, #ffffff 0%, #dbeafe 35%, #60a5fa 74%);
          box-shadow: 0 0 30px rgba(96, 165, 250, 0.95);
          animation: pulseHard 0.5s ease-in-out infinite;
        }

        .assets-page .bolt {
          width: 6px;
          height: 84px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(191, 219, 254, 0), #bfdbfe, rgba(191, 219, 254, 0));
          box-shadow: 0 0 12px rgba(96, 165, 250, 0.95);
          transform-origin: 50% 50%;
          animation: boltFlicker 0.2s steps(2, end) infinite;
        }

        .assets-page .bolt-a { transform: translate(-50%, -50%) rotate(10deg); }
        .assets-page .bolt-b { transform: translate(-50%, -50%) rotate(70deg); height: 74px; }
        .assets-page .bolt-c { transform: translate(-50%, -50%) rotate(125deg); }
        .assets-page .bolt-d { transform: translate(-50%, -50%) rotate(-40deg); height: 72px; }

        .assets-page .clone {
          width: 64px;
          height: 90px;
          border-radius: 999px 999px 22px 22px;
          background: linear-gradient(180deg, rgba(99, 102, 241, 0.5), rgba(30, 41, 59, 0.2));
          filter: blur(0.4px);
        }

        .assets-page .clone-main {
          box-shadow: 0 0 24px rgba(129, 140, 248, 0.4);
          animation: wobble 1.8s ease-in-out infinite;
        }

        .assets-page .clone-left {
          margin-left: -45px;
          opacity: 0.45;
          animation: cloneGhost 1.2s ease-in-out infinite;
        }

        .assets-page .clone-right {
          margin-left: 45px;
          opacity: 0.45;
          animation: cloneGhost 1.2s ease-in-out infinite reverse;
        }

        .assets-page .smoke {
          width: 56px;
          height: 56px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(226, 232, 240, 0.5), rgba(148, 163, 184, 0.06) 72%);
          filter: blur(2px);
          animation: smokeRise 1.45s ease-in-out infinite;
        }

        .assets-page .smoke-a { margin-left: -35px; }
        .assets-page .smoke-b { margin-left: 35px; animation-delay: 0.22s; }
        .assets-page .smoke-c { margin-left: -10px; margin-top: 16px; animation-delay: 0.42s; }
        .assets-page .smoke-d { margin-left: 16px; margin-top: 20px; animation-delay: 0.62s; }

        .assets-page .seal {
          border-radius: 999px;
          border: 1px solid rgba(250, 204, 21, 0.72);
        }

        .assets-page .seal-outer { width: 110px; height: 110px; animation: spin 2.6s linear infinite; }
        .assets-page .seal-mid {
          width: 76px;
          height: 76px;
          border-color: rgba(45, 212, 191, 0.75);
          animation: spinRev 2.1s linear infinite;
        }
        .assets-page .seal-inner {
          width: 44px;
          height: 44px;
          border-color: rgba(103, 232, 249, 0.8);
          animation: spin 1.35s linear infinite;
        }

        .assets-page .seal-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #fef08a;
          box-shadow: 0 0 10px rgba(253, 224, 71, 0.85);
        }

        .assets-page .star {
          width: 44px;
          height: 44px;
          background: linear-gradient(180deg, #cbd5e1, #64748b);
          clip-path: polygon(50% 0%, 63% 35%, 100% 50%, 63% 65%, 50% 100%, 37% 65%, 0% 50%, 37% 35%);
          box-shadow: 0 0 14px rgba(148, 163, 184, 0.6);
          animation: spin 0.8s linear infinite;
        }

        .assets-page .star-a { margin-left: -48px; }
        .assets-page .star-b { animation-duration: 0.65s; }
        .assets-page .star-c { margin-left: 48px; animation-duration: 0.92s; }

        .assets-page .reaper-vortex {
          width: 155px;
          height: 155px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(239, 68, 68, 0.28), rgba(127, 29, 29, 0.06) 70%);
          filter: blur(3px);
          animation: breathe 1.7s ease-in-out infinite;
        }

        .assets-page .reaper-ring {
          border-radius: 999px;
          border: 1px solid rgba(239, 68, 68, 0.6);
        }

        .assets-page .reaper-ring-a { width: 90px; height: 90px; animation: spin 2.5s linear infinite; }
        .assets-page .reaper-ring-b {
          width: 122px;
          height: 122px;
          animation: spinRev 3.2s linear infinite;
          opacity: 0.52;
        }

        .assets-page .reaper-core {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: radial-gradient(circle, #fee2e2, #ef4444 60%, #7f1d1d 100%);
          box-shadow: 0 0 22px rgba(239, 68, 68, 0.82);
        }

        .assets-page .water-core {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: radial-gradient(circle, #dbeafe, #38bdf8 65%, rgba(14, 116, 144, 0.4));
          box-shadow: 0 0 20px rgba(56, 189, 248, 0.8);
        }

        .assets-page .water-ring {
          border-radius: 999px;
          border: 2px solid rgba(125, 211, 252, 0.65);
        }

        .assets-page .water-ring-a { width: 84px; height: 84px; animation: spin 1.9s linear infinite; }
        .assets-page .water-ring-b {
          width: 120px;
          height: 120px;
          border-color: rgba(56, 189, 248, 0.45);
          animation: spinRev 2.7s linear infinite;
        }

        .assets-page .water-stream {
          width: 6px;
          height: 94px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(125, 211, 252, 0), rgba(125, 211, 252, 0.9), rgba(125, 211, 252, 0));
          box-shadow: 0 0 12px rgba(125, 211, 252, 0.8);
        }
        .assets-page .water-stream-a { transform: translate(-50%, -50%) rotate(36deg); }
        .assets-page .water-stream-b { transform: translate(-50%, -50%) rotate(132deg); }

        .assets-page .wind-sweep {
          border-radius: 999px;
          border: 2px solid rgba(186, 230, 253, 0.75);
          border-left-color: transparent;
          border-bottom-color: transparent;
          filter: drop-shadow(0 0 8px rgba(186, 230, 253, 0.7));
          animation: spin 1.4s linear infinite;
        }
        .assets-page .wind-sweep-a { width: 88px; height: 88px; }
        .assets-page .wind-sweep-b {
          width: 64px;
          height: 64px;
          animation-duration: 1.1s;
          animation-direction: reverse;
        }
        .assets-page .wind-sweep-c {
          width: 114px;
          height: 114px;
          opacity: 0.5;
          animation-duration: 1.8s;
        }
        .assets-page .wind-dot {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #f0f9ff;
          box-shadow: 0 0 10px rgba(226, 232, 240, 0.9);
          animation: bob 0.9s ease-in-out infinite;
        }

        .assets-page .earth-pillar {
          width: 20px;
          border-radius: 5px;
          background: linear-gradient(180deg, #a8a29e, #57534e);
          box-shadow: 0 0 8px rgba(113, 113, 122, 0.65);
          transform-origin: 50% 100%;
          animation: pillarRise 1.2s ease-in-out infinite;
        }
        .assets-page .earth-pillar-a { height: 70px; margin-left: -36px; animation-delay: 0s; }
        .assets-page .earth-pillar-b { height: 84px; animation-delay: 0.2s; }
        .assets-page .earth-pillar-c { height: 62px; margin-left: 36px; animation-delay: 0.4s; }
        .assets-page .earth-dust {
          width: 120px;
          height: 32px;
          margin-top: 46px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(212, 212, 216, 0.28), rgba(24, 24, 27, 0));
          animation: pulseSoft 1.1s ease-in-out infinite;
        }

        .assets-page .web-core {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: radial-gradient(circle, #f8fafc, #60a5fa 70%);
          box-shadow: 0 0 18px rgba(96, 165, 250, 0.8);
          animation: pulseHard 0.55s ease-in-out infinite;
        }

        .assets-page .web-line {
          width: 4px;
          height: 100px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(147, 197, 253, 0), rgba(147, 197, 253, 0.9), rgba(147, 197, 253, 0));
          box-shadow: 0 0 9px rgba(147, 197, 253, 0.75);
          animation: boltFlicker 0.24s steps(2, end) infinite;
        }
        .assets-page .web-line-a { transform: translate(-50%, -50%) rotate(0deg); }
        .assets-page .web-line-b { transform: translate(-50%, -50%) rotate(45deg); }
        .assets-page .web-line-c { transform: translate(-50%, -50%) rotate(90deg); }
        .assets-page .web-line-d { transform: translate(-50%, -50%) rotate(135deg); }

        .assets-page .web-ring {
          width: 118px;
          height: 118px;
          border-radius: 999px;
          border: 1px solid rgba(147, 197, 253, 0.45);
          animation: spin 2s linear infinite;
        }

        .assets-page .crow {
          width: 18px;
          height: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, #111827, #020617);
          box-shadow: 0 0 6px rgba(15, 23, 42, 0.9);
          transform-origin: 50% 50%;
        }
        .assets-page .crow-a { margin-left: -42px; margin-top: -14px; animation: orbitOne 1.9s linear infinite; }
        .assets-page .crow-b { margin-left: 40px; margin-top: -18px; animation: orbitOne 2.1s linear infinite reverse; }
        .assets-page .crow-c { margin-left: -8px; margin-top: 30px; animation: orbitOne 1.6s linear infinite; }
        .assets-page .crow-d { margin-left: 20px; margin-top: 18px; animation: orbitOne 1.7s linear infinite reverse; }
        .assets-page .crow-shadow {
          width: 126px;
          height: 126px;
          border-radius: 999px;
          border: 1px dashed rgba(30, 41, 59, 0.55);
          animation: spinRev 3.3s linear infinite;
        }

        .assets-page .talisman {
          width: 18px;
          height: 30px;
          border-radius: 3px;
          background: linear-gradient(180deg, #fefce8, #fde68a);
          border: 1px solid rgba(161, 98, 7, 0.45);
          box-shadow: 0 0 8px rgba(253, 230, 138, 0.65);
          animation: talismanDrift 1.4s ease-in-out infinite;
        }
        .assets-page .talisman-a { margin-left: -36px; animation-delay: 0s; }
        .assets-page .talisman-b { margin-left: 36px; animation-delay: 0.25s; }
        .assets-page .talisman-c { margin-left: -6px; margin-top: -22px; animation-delay: 0.5s; }
        .assets-page .talisman-d { margin-left: 10px; margin-top: 24px; animation-delay: 0.75s; }
        .assets-page .talisman-glow {
          width: 130px;
          height: 130px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0));
          filter: blur(2px);
          animation: pulseSoft 1.3s ease-in-out infinite;
        }

        .assets-page .moon-core {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          background: radial-gradient(circle, #f8fafc, #cbd5e1);
          box-shadow: 0 0 14px rgba(226, 232, 240, 0.8);
        }
        .assets-page .moon-crescent {
          width: 68px;
          height: 68px;
          border-radius: 999px;
          box-shadow: inset -18px 0 0 0 rgba(226, 232, 240, 0.9);
          animation: spin 4s linear infinite;
        }
        .assets-page .moon-slash {
          width: 126px;
          height: 5px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(226, 232, 240, 0), rgba(226, 232, 240, 0.9), rgba(226, 232, 240, 0));
          animation: slashSweep 1.6s ease-in-out infinite;
        }
        .assets-page .moon-slash-a { transform: translate(-50%, -50%) rotate(18deg); }
        .assets-page .moon-slash-b { transform: translate(-50%, -50%) rotate(-18deg); animation-delay: 0.45s; }

        .assets-page .lava-core {
          width: 42px;
          height: 42px;
          border-radius: 999px;
          background: radial-gradient(circle, #fed7aa, #f97316 52%, #7c2d12 100%);
          box-shadow: 0 0 24px rgba(249, 115, 22, 0.85);
          animation: pulseHard 0.85s ease-in-out infinite;
        }
        .assets-page .lava-bubble {
          width: 12px;
          height: 12px;
          border-radius: 999px;
          background: #fb923c;
          box-shadow: 0 0 8px rgba(249, 115, 22, 0.8);
          animation: bubblePop 1s ease-in-out infinite;
        }
        .assets-page .lava-bubble-a { margin-left: -28px; margin-top: 16px; animation-delay: 0s; }
        .assets-page .lava-bubble-b { margin-left: 18px; margin-top: 24px; animation-delay: 0.2s; }
        .assets-page .lava-bubble-c { margin-left: 34px; margin-top: 8px; animation-delay: 0.4s; }
        .assets-page .lava-wave {
          width: 136px;
          height: 34px;
          margin-top: 48px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(249, 115, 22, 0.35), rgba(124, 45, 18, 0));
          animation: pulseSoft 1.05s ease-in-out infinite;
        }

        .assets-page .frost-core {
          width: 16px;
          height: 16px;
          border-radius: 999px;
          background: #f0f9ff;
          box-shadow: 0 0 16px rgba(186, 230, 253, 0.9);
        }
        .assets-page .frost-ray {
          width: 4px;
          height: 100px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(186, 230, 253, 0), rgba(186, 230, 253, 0.9), rgba(186, 230, 253, 0));
          box-shadow: 0 0 10px rgba(186, 230, 253, 0.8);
          animation: spin 2.2s linear infinite;
        }
        .assets-page .frost-ray-a { transform: translate(-50%, -50%) rotate(0deg); }
        .assets-page .frost-ray-b { transform: translate(-50%, -50%) rotate(45deg); }
        .assets-page .frost-ray-c { transform: translate(-50%, -50%) rotate(90deg); }
        .assets-page .frost-ray-d { transform: translate(-50%, -50%) rotate(135deg); }
        .assets-page .frost-ring {
          width: 108px;
          height: 108px;
          border-radius: 999px;
          border: 1px solid rgba(186, 230, 253, 0.5);
          animation: pulseSoft 1.5s ease-in-out infinite;
        }

        .assets-page .poison-core {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          background: radial-gradient(circle, #dcfce7, #4ade80 55%, #166534 100%);
          box-shadow: 0 0 16px rgba(74, 222, 128, 0.8);
          animation: pulseHard 1.2s ease-in-out infinite;
        }
        .assets-page .poison-cloud {
          width: 48px;
          height: 48px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(74, 222, 128, 0.35), rgba(22, 101, 52, 0));
          filter: blur(1.5px);
          animation: smokeRise 1.8s ease-in-out infinite;
        }
        .assets-page .poison-cloud-a { margin-left: -32px; margin-top: 10px; }
        .assets-page .poison-cloud-b { margin-left: 30px; margin-top: 12px; animation-delay: 0.3s; }
        .assets-page .poison-cloud-c { margin-left: -10px; margin-top: -18px; animation-delay: 0.6s; }
        .assets-page .poison-cloud-d { margin-left: 14px; margin-top: 26px; animation-delay: 0.9s; }

        .assets-page .sand-core {
          width: 24px;
          height: 24px;
          border-radius: 999px;
          background: radial-gradient(circle, #fef3c7, #f59e0b 70%);
          box-shadow: 0 0 12px rgba(245, 158, 11, 0.8);
        }
        .assets-page .sand-ring {
          border-radius: 999px;
          border: 2px dashed rgba(251, 191, 36, 0.65);
        }
        .assets-page .sand-ring-a { width: 88px; height: 88px; animation: spin 2.1s linear infinite; }
        .assets-page .sand-ring-b { width: 120px; height: 120px; animation: spinRev 3s linear infinite; opacity: 0.55; }
        .assets-page .sand-grain {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #f59e0b;
          box-shadow: 0 0 6px rgba(251, 191, 36, 0.7);
          animation: orbitOne 1.3s linear infinite;
        }
        .assets-page .sand-grain-a { margin-left: -46px; }
        .assets-page .sand-grain-b { margin-left: 38px; animation-delay: 0.35s; }
        .assets-page .sand-grain-c { margin-top: 44px; animation-delay: 0.7s; }

        .assets-page .phoenix-core {
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: radial-gradient(circle, #fff7ed, #fb923c 55%, #ef4444 100%);
          box-shadow: 0 0 16px rgba(249, 115, 22, 0.85);
        }
        .assets-page .phoenix-wing {
          width: 62px;
          height: 94px;
          background: linear-gradient(180deg, rgba(251, 146, 60, 0.95), rgba(239, 68, 68, 0.35));
          border-radius: 75% 75% 40% 40%;
          filter: blur(0.3px);
          transform-origin: 50% 65%;
          animation: wingFlap 1.1s ease-in-out infinite;
        }
        .assets-page .phoenix-wing-left { margin-left: -34px; transform: translate(-50%, -50%) rotate(-28deg); }
        .assets-page .phoenix-wing-right {
          margin-left: 34px;
          transform: translate(-50%, -50%) rotate(28deg) scaleX(-1);
          animation-delay: 0.12s;
        }
        .assets-page .phoenix-feather {
          width: 8px;
          height: 18px;
          border-radius: 999px;
          background: linear-gradient(180deg, #fdba74, rgba(251, 113, 133, 0));
          box-shadow: 0 0 7px rgba(251, 146, 60, 0.75);
          animation: emberRise 1.1s linear infinite;
        }
        .assets-page .phoenix-feather-a { margin-left: -18px; margin-top: 26px; }
        .assets-page .phoenix-feather-b { margin-left: 20px; margin-top: 30px; animation-delay: 0.45s; }

        @keyframes spin {
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes spinRev {
          to { transform: translate(-50%, -50%) rotate(-360deg); }
        }

        @keyframes pulseSoft {
          0%, 100% { opacity: 0.52; transform: translate(-50%, -50%) scale(0.92); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        }

        @keyframes pulseHard {
          0%, 100% { transform: translate(-50%, -50%) scale(0.88); }
          50% { transform: translate(-50%, -50%) scale(1.08); }
        }

        @keyframes breathe {
          0%, 100% { transform: translate(-50%, -50%) scale(0.94); opacity: 0.7; }
          50% { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
        }

        @keyframes emberRise {
          0% { opacity: 0; transform: translate(-50%, -12%) scale(0.6); }
          22% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -220%) scale(1); }
        }

        @keyframes boltFlicker {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; filter: brightness(1.35); }
        }

        @keyframes wobble {
          0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
          50% { transform: translate(-50%, -52%) rotate(1.5deg); }
        }

        @keyframes cloneGhost {
          0%, 100% { transform: translate(-50%, -50%) scale(0.95); }
          50% { transform: translate(-50%, -47%) scale(1.02); }
        }

        @keyframes smokeRise {
          0% { opacity: 0.1; transform: translate(-50%, -40%) scale(0.76); }
          50% { opacity: 0.52; }
          100% { opacity: 0; transform: translate(-50%, -140%) scale(1.28); }
        }

        @keyframes bob {
          0%, 100% { transform: translate(-50%, -50%) translateY(0); }
          50% { transform: translate(-50%, -50%) translateY(-8px); }
        }

        @keyframes pillarRise {
          0%, 100% { transform: translate(-50%, -50%) scaleY(0.75); }
          45% { transform: translate(-50%, -50%) scaleY(1.05); }
        }

        @keyframes orbitOne {
          from { transform: translate(-50%, -50%) rotate(0deg) translateX(20px) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg) translateX(20px) rotate(-360deg); }
        }

        @keyframes talismanDrift {
          0%, 100% { transform: translate(-50%, -50%) rotate(-8deg) translateY(0); }
          50% { transform: translate(-50%, -50%) rotate(8deg) translateY(-12px); }
        }

        @keyframes slashSweep {
          0%, 100% { opacity: 0.2; transform: translate(-50%, -50%) scaleX(0.8); }
          45%, 65% { opacity: 1; transform: translate(-50%, -50%) scaleX(1.1); }
        }

        @keyframes bubblePop {
          0%, 100% { transform: translate(-50%, -50%) scale(0.55); opacity: 0.3; }
          55% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        }

        @keyframes wingFlap {
          0%, 100% { transform: translate(-50%, -50%) rotate(-26deg); }
          50% { transform: translate(-50%, -50%) rotate(-8deg); }
        }

        @media (max-width: 700px) {
          .assets-page .assets-head {
            flex-direction: column;
          }

          .assets-page .back-link {
            align-self: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
