"use client";

import { Component, memo, type ReactNode, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { GraphState } from "@/lib/agentEvents";
import { deriveScene } from "@/lib/agentScene";
import { AgentOpsScene } from "@/components/agent3d/AgentOpsScene";

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null };

  static getDerivedStateFromError(err: Error) {
    return { error: err.message || "scene crashed" };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center font-mono text-xs text-amber-200">
          <p>3D scene error</p>
          <p className="max-w-md text-slate-500">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function SceneInner({ graph }: { graph: GraphState }) {
  const scene = useMemo(() => deriveScene(graph), [graph]);

  return (
    <>
      <AgentOpsScene scene={scene} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={10}
        maxDistance={28}
        minPolarAngle={0.5}
        maxPolarAngle={1.35}
        target={[0, 0.6, 0]}
      />
    </>
  );
}

function AgentOpsCanvasImpl({ graph }: { graph: GraphState }) {
  return (
    <SceneErrorBoundary>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        frameloop="always"
        camera={{ position: [12, 10, 12], fov: 36, near: 0.1, far: 120 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: true,
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor("#0a1220", 1);
          camera.lookAt(0, 0.6, 0);
        }}
        className="h-full w-full touch-none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <SceneInner graph={graph} />
      </Canvas>
    </SceneErrorBoundary>
  );
}

export const AgentOpsCanvas = memo(AgentOpsCanvasImpl);
