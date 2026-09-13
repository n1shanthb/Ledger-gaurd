"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import {
  Activity,
  Cpu,
  Gauge,
  Search,
  ShieldAlert,
  Truck,
  Zap,
} from "lucide-react";
import * as THREE from "three";
import type { AgentId } from "@/lib/agentEvents";
import type {
  AgentScene,
  ExternalId,
  SceneAgent,
  SceneEdge,
  SceneExternal,
} from "@/lib/agentScene";
import {
  GraphMark,
  HederaMark,
  LedgerMark,
  MessariMark,
} from "@/components/agent3d/BrandMarks";

/** Spread layout — six trust-boundary agents + docks */
export const NODE_POS: Record<AgentId | ExternalId, [number, number, number]> = {
  composer: [0, 1.45, -4.2],
  clerk: [-4.8, 1.15, 0.4],
  solver: [0, 1.15, 4.6],
  payer: [4.8, 1.15, 0.4],
  autopilot: [-3.0, 1.05, -2.0],
  driver: [3.0, 1.05, -2.0],
  graph: [-8.0, 0.65, 0.4],
  messari: [0, 0.6, 7.8],
  hedera: [8.0, 0.65, 0.4],
  /** HITL clear-sign — physical Ledger OLED */
  ledger: [5.8, 0.9, -3.6],
};

const COLORS = {
  hub: "#00f3ff",
  graph: "#00ff88",
  oracle: "#a855f7",
  broker: "#ff9900",
  autopilot: "#38bdf8",
  driver: "#f472b6",
  ledger: "#b8f000",
} as const;

function accentHex(accent: SceneAgent["accent"]) {
  return COLORS[accent];
}

function GridFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[22, 22]} />
        <meshStandardMaterial color="#101a2c" metalness={0.2} roughness={0.88} />
      </mesh>
      <gridHelper args={[22, 44, "#2563eb", "#152238"]} position={[0, 0.002, 0]} />
    </group>
  );
}

function GlassPlatform() {
  return (
    <group position={[0, 0.1, 0]}>
      <RoundedBox args={[14.5, 0.28, 12.5]} radius={0.14} smoothness={4}>
        <meshPhysicalMaterial
          color="#9ecce8"
          metalness={0.05}
          roughness={0.12}
          transmission={0.55}
          thickness={0.5}
          ior={1.4}
          transparent
          opacity={0.85}
        />
      </RoundedBox>
      <RoundedBox args={[14.7, 0.06, 12.7]} radius={0.12} smoothness={4} position={[0, -0.12, 0]}>
        <meshBasicMaterial color="#00f3ff" transparent opacity={0.4} />
      </RoundedBox>
    </group>
  );
}

function GlowPedestal({ color, hot }: { color: string; hot: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (!ring.current) return;
    ring.current.rotation.z += dt * (hot ? 1.2 : 0.3);
  });
  return (
    <group position={[0, -0.95, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.55, 0.78, 48]} />
        <meshBasicMaterial color={color} transparent opacity={hot ? 0.8 : 0.4} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.66, 0.035, 10, 48]} />
        <meshBasicMaterial color={color} transparent opacity={hot ? 1 : 0.55} />
      </mesh>
      <pointLight
        color={color}
        intensity={hot ? 1 : 0.4}
        distance={3.5}
        decay={2}
        position={[0, 0.25, 0]}
      />
    </group>
  );
}

function HudBadge({
  color,
  role,
  title,
  model,
  badge,
  hot,
  Icon,
}: {
  color: string;
  role: string;
  title: string;
  model?: string;
  badge: string;
  hot: boolean;
  Icon: typeof Cpu;
}) {
  return (
    <Html
      center
      distanceFactor={12}
      position={[0, 1.8, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
      zIndexRange={[20, 0]}
    >
      <div
        className="w-[76px] rounded-md border bg-slate-950/70 px-1.5 py-1 text-center shadow-md backdrop-blur-md"
        style={{
          borderColor: `${color}66`,
          boxShadow: hot ? `0 0 14px ${color}55` : undefined,
        }}
      >
        <div className="mb-0.5 flex items-center justify-center gap-0.5">
          <Icon className="h-2.5 w-2.5" style={{ color }} strokeWidth={2.25} />
          <p className="font-mono text-[5px] uppercase tracking-wider text-slate-400">{role}</p>
        </div>
        <p className="font-display text-[8px] font-semibold leading-tight text-white">{title}</p>
        {model && (
          <p className="mt-0.5 truncate font-mono text-[5px] text-slate-500">
            {model.split("/").pop()}
          </p>
        )}
        <p
          className="mt-0.5 line-clamp-2 font-mono text-[5px] uppercase leading-snug tracking-wide"
          style={{ color }}
        >
          {badge}
        </p>
      </div>
    </Html>
  );
}

/** Orchestrator: dual-ring octahedron + inner crystal */
function OrchestratorMesh({ hot, tool }: { hot: boolean; tool: boolean }) {
  const outer = useRef<THREE.Mesh>(null);
  const ringA = useRef<THREE.Mesh>(null);
  const ringB = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const color = COLORS.hub;
  const busy = hot || tool;

  useFrame((_, dt) => {
    const speed = tool ? 2.4 : hot ? 1.4 : 0.35;
    if (outer.current) outer.current.rotation.y += dt * speed;
    if (ringA.current) ringA.current.rotation.x += dt * speed * 1.2;
    if (ringB.current) ringB.current.rotation.z += dt * speed * 0.9;
    if (core.current) {
      const s = 1 + Math.sin(performance.now() * (busy ? 0.008 : 0.003)) * 0.08;
      core.current.scale.setScalar(s);
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        tool ? 2.5 : hot ? 1.6 : 0.7,
        0.1,
      );
    }
  });

  return (
    <group>
      <mesh ref={outer}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.85} />
      </mesh>
      <mesh ref={ringA} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.95, 0.02, 12, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
      <mesh ref={ringB}>
        <torusGeometry args={[0.85, 0.015, 12, 64]} />
        <meshBasicMaterial color="#67e8f9" transparent opacity={0.55} />
      </mesh>
      <mesh ref={core}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
          metalness={0.2}
          roughness={0.25}
        />
      </mesh>
      <pointLight color={color} intensity={busy ? 2.2 : 0.8} distance={7} decay={2} />
    </group>
  );
}

/** Sentinel: layered glass cube + matrix core + scanner toward Graph */
function SentinelMesh({ hot, tool }: { hot: boolean; tool: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const color = COLORS.graph;
  const busy = hot || tool;

  useFrame((_, dt) => {
    if (core.current) {
      core.current.rotation.y += dt * (tool ? 3.2 : hot ? 1.6 : 0.4);
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        tool ? 2.5 : hot ? 1.5 : 0.55,
        0.1,
      );
    }
    if (beam.current) {
      beam.current.visible = busy;
      if (busy) beam.current.rotation.y += dt * 2.5;
    }
  });

  // direction toward graph dock in local-ish space
  const graph = NODE_POS.graph;
  const self = NODE_POS.clerk;
  const beamDir = useMemo(() => {
    const d = new THREE.Vector3(graph[0] - self[0], 0, graph[2] - self[2]).normalize();
    return Math.atan2(d.x, d.z);
  }, [graph, self]);

  return (
    <group>
      <RoundedBox args={[0.95, 0.95, 0.95]} radius={0.1} smoothness={4}>
        <meshPhysicalMaterial
          color="#ecfdf5"
          metalness={0.05}
          roughness={0.12}
          transmission={0.7}
          thickness={0.45}
          transparent
          opacity={0.45}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </RoundedBox>
      <RoundedBox args={[0.7, 0.7, 0.7]} radius={0.06} smoothness={4}>
        <meshPhysicalMaterial
          color="#a7f3d0"
          transmission={0.5}
          roughness={0.2}
          transparent
          opacity={0.35}
        />
      </RoundedBox>
      <mesh ref={core}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
      <group rotation={[0, beamDir, 0]}>
        <mesh ref={beam} position={[0, 0, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.35, 2.4, 16, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <pointLight color={color} intensity={busy ? 2 : 0.7} distance={6} decay={2} />
    </group>
  );
}

/** Oracle: icosahedron + spinning torus */
function OracleMesh({ hot, tool }: { hot: boolean; tool: boolean }) {
  const ico = useRef<THREE.Mesh>(null);
  const torus = useRef<THREE.Mesh>(null);
  const color = COLORS.oracle;
  const busy = hot || tool;

  useFrame((_, dt) => {
    const speed = tool ? 3.5 : hot ? 1.8 : 0.45;
    if (ico.current) {
      ico.current.rotation.y += dt * speed;
      ico.current.rotation.x += dt * speed * 0.35;
      const mat = ico.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        tool ? 2.5 : hot ? 1.7 : 0.6,
        0.12,
      );
    }
    if (torus.current) torus.current.rotation.z += dt * speed * 0.8;
  });

  return (
    <group>
      <mesh ref={ico}>
        <icosahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.6}
          metalness={0.35}
          roughness={0.25}
        />
      </mesh>
      <mesh ref={torus} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.0, 0.02, 16, 100]} />
        <meshBasicMaterial color={color} transparent opacity={busy ? 1 : 0.65} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.78, 0]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.25} />
      </mesh>
      <pointLight color={color} intensity={busy ? 2.2 : 0.75} distance={6} decay={2} />
    </group>
  );
}

/** Broker: dodecahedron + ignition core */
function BrokerMesh({ hot, tool }: { hot: boolean; tool: boolean }) {
  const shell = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const color = COLORS.broker;
  const busy = hot || tool;

  useFrame((_, dt) => {
    const speed = tool ? 3 : hot ? 1.5 : 0.4;
    if (shell.current) shell.current.rotation.y += dt * speed;
    if (core.current) {
      core.current.rotation.x += dt * speed * 1.4;
      const mat = core.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = THREE.MathUtils.lerp(
        mat.emissiveIntensity,
        tool ? 2.5 : hot ? 1.8 : 0.7,
        0.1,
      );
      const pulse = 1 + Math.sin(performance.now() * (busy ? 0.01 : 0.003)) * 0.12;
      core.current.scale.setScalar(pulse);
    }
  });

  return (
    <group>
      <mesh ref={shell}>
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshPhysicalMaterial
          color="#ffd9a8"
          metalness={0.15}
          roughness={0.2}
          transmission={0.35}
          transparent
          opacity={0.55}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh ref={core}>
        <dodecahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.7}
          metalness={0.3}
          roughness={0.2}
        />
      </mesh>
      <pointLight color={color} intensity={busy ? 2.4 : 0.8} distance={6} decay={2} />
    </group>
  );
}

function AutopilotMesh({ hot, tool }: { hot: boolean; tool: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const color = COLORS.autopilot;
  const busy = hot || tool;
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * (busy ? 2.2 : 0.5);
  });
  return (
    <group>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.55, 0.08, 12, 48]} />
        <meshBasicMaterial color={color} transparent opacity={busy ? 1 : 0.55} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.35, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={busy ? 1.4 : 0.45}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

function DriverMesh({ hot, tool }: { hot: boolean; tool: boolean }) {
  const core = useRef<THREE.Mesh>(null);
  const color = COLORS.driver;
  const busy = hot || tool;
  useFrame((_, dt) => {
    if (core.current) {
      core.current.rotation.x += dt * (busy ? 2.5 : 0.4);
      core.current.rotation.y += dt * (busy ? 1.8 : 0.3);
    }
  });
  return (
    <group>
      <mesh ref={core}>
        <boxGeometry args={[0.7, 0.45, 0.9]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={busy ? 1.6 : 0.4}
          metalness={0.5}
          roughness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.35, 0]}>
        <coneGeometry args={[0.2, 0.35, 4]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function AgentBody({ agent }: { agent: SceneAgent }) {
  const hot = agent.hot;
  const tool = agent.state === "tool";
  const color = accentHex(agent.accent);
  const pos = NODE_POS[agent.id];

  const Icon =
    agent.id === "composer"
      ? Cpu
      : agent.id === "clerk"
        ? Search
        : agent.id === "solver"
          ? ShieldAlert
          : agent.id === "autopilot"
            ? Gauge
            : agent.id === "driver"
              ? Truck
              : Zap;

  return (
    <group position={pos}>
      <GlowPedestal color={color} hot={hot || tool} />
      {agent.id === "composer" && <OrchestratorMesh hot={hot} tool={tool} />}
      {agent.id === "clerk" && <SentinelMesh hot={hot} tool={tool} />}
      {agent.id === "solver" && <OracleMesh hot={hot} tool={tool} />}
      {agent.id === "payer" && <BrokerMesh hot={hot} tool={tool} />}
      {agent.id === "autopilot" && <AutopilotMesh hot={hot} tool={tool} />}
      {agent.id === "driver" && <DriverMesh hot={hot} tool={tool} />}
      <HudBadge
        color={color}
        role={agent.role}
        title={agent.title}
        model={agent.model}
        badge={agent.badge}
        hot={hot || tool}
        Icon={Icon}
      />
      {agent.id === "solver" && tool && (
        <Html center distanceFactor={14} position={[0, 2.35, 0]} style={{ pointerEvents: "none" }}>
          <Activity className="h-3 w-3 animate-pulse" style={{ color }} />
        </Html>
      )}
    </group>
  );
}

function LedgerDevice({ live }: { live: boolean }) {
  const oled = useRef<THREE.Mesh>(null);
  const color = COLORS.ledger;

  useFrame(() => {
    if (!oled.current) return;
    const mat = oled.current.material as THREE.MeshStandardMaterial;
    const pulse = live
      ? 0.7 + Math.sin(performance.now() * 0.008) * 0.5
      : 0.25;
    mat.emissiveIntensity = pulse;
  });

  return (
    <group rotation={[0.15, -0.4, 0]}>
      {/* Nano body */}
      <RoundedBox args={[0.55, 1.05, 0.18]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color="#0a0a0a" metalness={0.55} roughness={0.35} />
      </RoundedBox>
      {/* OLED */}
      <mesh ref={oled} position={[0, 0.12, 0.1]}>
        <planeGeometry args={[0.38, 0.42]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={live ? 1.2 : 0.25}
          toneMapped={false}
        />
      </mesh>
      {/* USB / contact edge */}
      <mesh position={[0, -0.48, 0.02]}>
        <boxGeometry args={[0.28, 0.08, 0.06]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* buttons */}
      <mesh position={[-0.14, -0.28, 0.1]}>
        <boxGeometry args={[0.08, 0.05, 0.03]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      <mesh position={[0.14, -0.28, 0.1]}>
        <boxGeometry args={[0.08, 0.05, 0.03]} />
        <meshBasicMaterial color="#222" />
      </mesh>
      <pointLight color={color} intensity={live ? 2 : 0.4} distance={4} decay={2} position={[0, 0.2, 0.4]} />
    </group>
  );
}

function LedgerDock({ ext }: { ext: SceneExternal }) {
  const pos = NODE_POS.ledger;
  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.6, 0.75, 0.16, 24]} />
        <meshStandardMaterial
          color="#111"
          metalness={0.6}
          roughness={0.4}
          emissive={COLORS.ledger}
          emissiveIntensity={ext.live ? 0.35 : 0.08}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.44, 0]}>
        <ringGeometry args={[0.45, 0.65, 32]} />
        <meshBasicMaterial
          color={COLORS.ledger}
          transparent
          opacity={ext.live ? 0.9 : 0.35}
        />
      </mesh>
      <group position={[0, 0.05, 0]}>
        <LedgerDevice live={ext.live} />
      </group>
      <Html
        center
        distanceFactor={12}
        position={[0, 1.85, 0]}
        style={{ pointerEvents: "none" }}
        zIndexRange={[15, 0]}
      >
        <div
          className="flex w-[78px] flex-col items-center rounded-md border bg-slate-950/70 px-1 py-1 backdrop-blur-md"
          style={{
            borderColor: ext.live ? `${COLORS.ledger}aa` : "#334155",
            boxShadow: ext.live ? `0 0 16px ${COLORS.ledger}55` : undefined,
          }}
        >
          <LedgerMark className="mb-0.5 h-5 w-5" />
          <p
            className="font-mono text-[5px] font-semibold uppercase leading-tight"
            style={{ color: COLORS.ledger }}
          >
            {ext.label}
          </p>
          <p className="mt-0.5 line-clamp-2 text-center font-mono text-[4px] text-slate-400">
            {ext.caption}
          </p>
          {ext.live && (
            <p className="mt-0.5 font-mono text-[5px] uppercase tracking-wide text-signal">
              Confirm on device
            </p>
          )}
        </div>
      </Html>
    </group>
  );
}

function ExternalDock({ ext }: { ext: SceneExternal }) {
  const pos = NODE_POS[ext.id];
  const body = useRef<THREE.Group>(null);

  const theme =
    ext.id === "graph"
      ? { color: "#6F4CFF", metal: "#2e1065", glass: "#c4b5fd" }
      : ext.id === "messari"
        ? { color: "#5B8DEF", metal: "#334155", glass: "#94a3b8" }
        : { color: "#C4A484", metal: "#78350f", glass: "#fdba74" };

  useFrame((_, dt) => {
    if (!body.current) return;
    body.current.rotation.y += dt * (ext.live ? 1.1 : 0.25);
    const t = ext.live ? 1.1 : 1;
    body.current.scale.setScalar(THREE.MathUtils.lerp(body.current.scale.x, t, 0.1));
  });

  const Mark =
    ext.id === "graph" ? GraphMark : ext.id === "messari" ? MessariMark : HederaMark;

  return (
    <group position={pos}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.55, 0.7, 0.18, 24]} />
        <meshStandardMaterial
          color={theme.metal}
          metalness={0.7}
          roughness={0.35}
          emissive={theme.color}
          emissiveIntensity={ext.live ? 0.45 : 0.15}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <ringGeometry args={[0.4, 0.58, 32]} />
        <meshBasicMaterial color={theme.color} transparent opacity={ext.live ? 0.85 : 0.4} />
      </mesh>
      <group ref={body} position={[0, 0.15, 0]}>
        <RoundedBox args={[0.7, 0.7, 0.7]} radius={0.08} smoothness={4}>
          <meshPhysicalMaterial
            color={theme.glass}
            metalness={ext.id === "messari" ? 0.6 : 0.1}
            roughness={ext.id === "messari" ? 0.25 : 0.15}
            transmission={ext.id === "messari" ? 0.15 : 0.5}
            transparent
            opacity={0.65}
            emissive={theme.color}
            emissiveIntensity={0.2}
          />
        </RoundedBox>
      </group>
      <pointLight
        color={theme.color}
        intensity={ext.live ? 1.6 : 0.45}
        distance={4}
        decay={2}
      />
      <Html
        center
        distanceFactor={12}
        position={[0, 1.8, 0]}
        style={{ pointerEvents: "none" }}
        zIndexRange={[15, 0]}
      >
        <div
          className="flex w-[70px] flex-col items-center rounded-md border bg-slate-950/70 px-1 py-1 backdrop-blur-md"
          style={{
            borderColor: ext.live ? `${theme.color}99` : "#334155",
            opacity: ext.live ? 1 : 0.8,
          }}
        >
          <Mark className="mb-0.5 h-5 w-5" />
          <p
            className="font-mono text-[5px] font-semibold uppercase leading-tight"
            style={{ color: theme.color }}
          >
            {ext.label}
          </p>
          <p className="mt-0.5 line-clamp-2 text-center font-mono text-[4px] text-slate-400">
            {ext.caption}
          </p>
        </div>
      </Html>
    </group>
  );
}

function curveBetween(a: [number, number, number], b: [number, number, number]) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += 0.7 + start.distanceTo(end) * 0.06;
  return new THREE.CatmullRomCurve3([start, mid, end]);
}

function FlowTube({ edge, color }: { edge: SceneEdge; color: string }) {
  const from = NODE_POS[edge.from];
  const to = NODE_POS[edge.to];
  const curve = useMemo(
    () => curveBetween(from, to),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [edge.from, edge.to],
  );
  const glowGeom = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.055, 10, false), [curve]);
  const coreGeom = useMemo(() => new THREE.TubeGeometry(curve, 64, 0.022, 8, false), [curve]);
  const particles = useRef<THREE.Group>(null);
  const tRef = useRef(0);

  useFrame((_, dt) => {
    if (!edge.live || !particles.current) return;
    tRef.current = (tRef.current + dt * 0.55) % 1;
    const n = particles.current.children.length;
    particles.current.children.forEach((child, i) => {
      child.position.copy(curve.getPointAt((tRef.current + i / n) % 1));
    });
  });

  return (
    <group>
      <mesh geometry={glowGeom}>
        <meshBasicMaterial
          color={edge.live ? color : "#334155"}
          transparent
          opacity={edge.live ? 0.4 : 0.16}
        />
      </mesh>
      <mesh geometry={coreGeom}>
        <meshBasicMaterial
          color={edge.live ? color : "#64748b"}
          transparent
          opacity={edge.live ? 0.95 : 0.4}
        />
      </mesh>
      {edge.live && (
        <group ref={particles}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshBasicMaterial color={color} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function edgeColor(edge: SceneEdge): string {
  if (edge.kind === "external") {
    if (edge.key.includes("graph")) return COLORS.graph;
    if (edge.key.includes("messari")) return COLORS.oracle;
    if (edge.key.includes("ledger")) return COLORS.ledger;
    return COLORS.broker;
  }
  if (edge.kind === "peer") return "#94a3b8";
  return COLORS.hub;
}

/** Always-on soft paths from composer + live dock streams */
function IdentityPaths({ scene }: { scene: AgentScene }) {
  const orchEdges: SceneEdge[] = [
    {
      key: "orch-clerk",
      from: "composer",
      to: "clerk",
      kind: "orch",
      live:
        scene.agents.find((a) => a.id === "composer")?.hot === true ||
        scene.agents.find((a) => a.id === "clerk")?.hot === true,
    },
    {
      key: "orch-solver",
      from: "composer",
      to: "solver",
      kind: "orch",
      live:
        scene.agents.find((a) => a.id === "composer")?.hot === true ||
        scene.agents.find((a) => a.id === "solver")?.hot === true,
    },
    {
      key: "orch-payer",
      from: "composer",
      to: "payer",
      kind: "orch",
      live:
        scene.agents.find((a) => a.id === "composer")?.hot === true ||
        scene.agents.find((a) => a.id === "payer")?.hot === true,
    },
    {
      key: "orch-autopilot",
      from: "composer",
      to: "autopilot",
      kind: "orch",
      live:
        scene.agents.find((a) => a.id === "composer")?.hot === true ||
        scene.agents.find((a) => a.id === "autopilot")?.hot === true,
    },
    {
      key: "orch-driver",
      from: "composer",
      to: "driver",
      kind: "orch",
      live:
        scene.agents.find((a) => a.id === "composer")?.hot === true ||
        scene.agents.find((a) => a.id === "driver")?.hot === true,
    },
  ];

  const byKey = new Map(scene.edges.map((e) => [e.key, e]));
  const merged = [
    ...orchEdges.map((e) => byKey.get(e.key) ?? e),
    ...scene.edges.filter((e) => !orchEdges.some((o) => o.key === e.key)),
  ];

  const agents = Object.fromEntries(scene.agents.map((a) => [a.id, a]));
  const ledgerLive = scene.externals.find((e) => e.id === "ledger")?.live === true;

  const withToolStreams = merged.map((e) => {
    if (e.key === "ext-graph" && agents.clerk?.state === "tool") {
      return { ...e, live: true };
    }
    if (e.key === "ext-messari" && agents.solver?.state === "tool") {
      return { ...e, live: true };
    }
    if (e.key === "ext-hedera" && agents.payer?.state === "tool") {
      const t = (agents.payer.activeTool ?? "").toLowerCase();
      if (!t.includes("propose") && !t.includes("hitl")) return { ...e, live: true };
    }
    if (
      (e.key === "ext-ledger" || e.key === "orch-ledger") &&
      (ledgerLive ||
        agents.composer?.state === "tool" ||
        (agents.composer?.hot &&
          (agents.composer.badge.includes("HITL") ||
            agents.composer.badge.includes("LEDGER"))))
    ) {
      return { ...e, live: true };
    }
    return e;
  });

  return (
    <>
      {withToolStreams.map((e) => (
        <FlowTube key={e.key} edge={e} color={edgeColor(e)} />
      ))}
    </>
  );
}

export function AgentOpsScene({ scene }: { scene: AgentScene }) {
  return (
    <>
      <color attach="background" args={["#0a1220"]} />
      <ambientLight intensity={0.7} />
      <hemisphereLight args={["#e2e8f0", "#0f172a", 0.6]} />
      <directionalLight position={[10, 14, 8]} intensity={1.25} castShadow />
      <directionalLight position={[-6, 7, -4]} intensity={0.45} color="#93c5fd" />
      <pointLight position={[0, 6, 0]} intensity={0.4} color="#00f3ff" distance={18} />

      <GridFloor />
      <GlassPlatform />

      {scene.agents.map((a) => (
        <AgentBody key={a.id} agent={a} />
      ))}
      {scene.externals.map((e) =>
        e.id === "ledger" ? (
          <LedgerDock key={e.id} ext={e} />
        ) : (
          <ExternalDock key={e.id} ext={e} />
        ),
      )}
      <IdentityPaths scene={scene} />
    </>
  );
}
