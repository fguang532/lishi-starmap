"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { CameraPose, Era, HistoryNode } from "@/data/types";
import { eraColor, TYPE_COLORS } from "@/data/types";
export type SceneProps = {
  eras: Era[];
  eraId: string | null;
  nodeId: string | null;
  paused: boolean;
  reduced: boolean;
  reset: number;
  zoom: number;
  restore: CameraPose | null;
  mobile: boolean;
  visible: boolean;
  onPose: (p: CameraPose) => void;
  onError: () => void;
  onEra: (id: string) => void;
  onNode: (id: string) => void;
};
type V3 = [number, number, number];
export function eraPosition(i: number): V3 {
  const t = (i / 21) * Math.PI * 1.78 - 0.6;
  return [
    Math.cos(t) * (8 + i * 0.12),
    Math.sin(t * 1.8) * 1.5 + (i - 10.5) * 0.13,
    Math.sin(t) * (6 + i * 0.07),
  ];
}
function childPosition(i: number, base: V3): V3 {
  const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
  const r = i % 2 ? 5.5 : 5.1;
  return [
    base[0] + Math.cos(a) * r,
    base[1] + Math.sin(a * 2) * 0.3,
    base[2] + Math.sin(a) * 4.1,
  ];
}
function CameraRig({
  props,
  base,
  positions,
}: {
  props: SceneProps;
  base: V3;
  positions: Map<string, V3>;
}) {
  const { camera, controls, invalidate, size } = useThree();
  const animation = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    t: number;
  } | null>(null);
  const zoomRef = useRef(props.zoom);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  useEffect(() => {
    const c = controls as OrbitControlsImpl | undefined;
    if (!c) return;
    controlsRef.current = c;
    const selected = props.nodeId ? positions.get(props.nodeId) : null;
    const target = new THREE.Vector3(...base);
    if (selected) target.lerp(new THREE.Vector3(...selected), 0.25);
    const aspect = size.width / size.height;
    const distance = props.eraId
      ? Math.max(9.5, (props.mobile ? 15 : 10.8) / Math.max(0.48, aspect))
      : Math.max(17, (props.mobile ? 31 : 24) / Math.max(0.48, aspect));
    const destination = target
      .clone()
      .add(
        new THREE.Vector3(0, distance * (props.eraId ? 0.88 : 0.53), distance),
      );
    const p = props.restore;
    animation.current = {
      from: camera.position.clone(),
      to: p ? new THREE.Vector3(...p.position) : destination,
      fromTarget: c.target.clone(),
      toTarget: p ? new THREE.Vector3(...p.target) : target,
      t: 0,
    };
    invalidate();
  }, [
    props.eraId,
    props.nodeId,
    props.reset,
    props.restore,
    props.mobile,
    controls,
    camera,
    invalidate,
    size.width,
    size.height,
  ]);
  useEffect(() => {
    const c = controls as OrbitControlsImpl | undefined;
    if (!c) return;
    const cancel = () => {
      animation.current = null;
    };
    c.addEventListener("start", cancel);
    return () => c.removeEventListener("start", cancel);
  }, [controls]);
  useEffect(() => {
    const c = controls as OrbitControlsImpl | undefined;
    if (!c || zoomRef.current === props.zoom) return;
    const factor = props.zoom > zoomRef.current ? 0.8 : 1.25;
    const offset = camera.position.clone().sub(c.target).multiplyScalar(factor);
    offset.setLength(THREE.MathUtils.clamp(offset.length(), 6, 85));
    camera.position.copy(c.target).add(offset);
    zoomRef.current = props.zoom;
    animation.current = null;
    c.update();
    invalidate();
  }, [props.zoom, camera, controls, invalidate]);
  useFrame((_, dt) => {
    const c = controlsRef.current;
    if (!c) return;
    const a = animation.current;
    if (a) {
      a.t = Math.min(1, a.t + dt / (props.reduced ? 0.01 : 1.05));
      const t =
        a.t < 0.5 ? 4 * a.t * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 3) / 2;
      camera.position.lerpVectors(a.from, a.to, t);
      c.target.lerpVectors(a.fromTarget, a.toTarget, t);
      if (!props.reduced) {
        const delta = camera.position.clone().sub(c.target);
        const theta = Math.sin(Math.PI * t) * 0.1;
        delta.applyAxisAngle(new THREE.Vector3(0, 1, 0), theta);
        camera.position.copy(c.target).add(delta);
      }
      c.update();
      if (a.t === 1) animation.current = null;
      else invalidate();
    }
    props.onPose({
      position: camera.position.toArray() as V3,
      target: c.target.toArray() as V3,
    });
  });
  return null;
}
const glowVertex = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const glowFragment = `uniform vec3 color; uniform float strength; varying vec2 vUv; void main(){float d=length(vUv-0.5)*2.;float a=pow(max(0.,1.-d),3.2)*strength;gl_FragColor=vec4(color,a);}`;
function Glow({
  color,
  size = 1,
  strength = 0.8,
}: {
  color: string;
  size?: number;
  strength?: number;
}) {
  const uniforms = useMemo(
    () => ({
      color: { value: new THREE.Color(color) },
      strength: { value: strength },
    }),
    [color, strength],
  );
  return (
    <Billboard>
      <mesh scale={size}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </Billboard>
  );
}
function StarField({ paused, mobile }: { paused: boolean; mobile: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const data = useMemo(() => {
    let seed = 1729;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = mobile ? 900 : 2300;
    const a = new Float32Array(count * 3);
    const c = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 35 + random() * 40;
      const theta = random() * Math.PI * 2;
      const phi = Math.acos(2 * random() - 1);
      a.set(
        [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta),
        ],
        i * 3,
      );
      const col = new THREE.Color(
        i % 7 === 0 ? "#9f91ec" : i % 5 === 0 ? "#68ccd9" : "#8da9c4",
      );
      col.multiplyScalar(0.35 + random() * 0.7);
      c.set(col.toArray(), i * 3);
    }
    return { a, c };
  }, [mobile]);
  useFrame((_, dt) => {
    if (ref.current && !paused) ref.current.rotation.y += dt * 0.008;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.a, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.c, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}
function ChronoCore({ paused }: { paused: boolean }) {
  const group = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!paused) {
      if (group.current) group.current.rotation.y += dt * 0.024;
      if (inner.current) inner.current.rotation.z += dt * 0.065;
    }
  });
  const rings = useMemo(
    () =>
      [2.5, 3, 3.5, 4, 5.6, 12.8].map((r) =>
        Array.from(
          { length: 181 },
          (_, i) =>
            [
              Math.cos((i / 180) * Math.PI * 2) * r,
              0,
              Math.sin((i / 180) * Math.PI * 2) * r,
            ] as V3,
        ),
      ),
    [],
  );
  const ticks = useMemo(
    () =>
      Array.from({ length: 100 }, (_, i) => {
        const a = (i / 100) * Math.PI * 2;
        return [
          [Math.cos(a) * 3.65, 0, Math.sin(a) * 3.65],
          [
            Math.cos(a) * (i % 5 === 0 ? 3.9 : 3.76),
            0,
            Math.sin(a) * (i % 5 === 0 ? 3.9 : 3.76),
          ],
        ] as V3[];
      }),
    [],
  );
  return (
    <group>
      <Glow color="#3576aa" size={13} strength={0.2} />
      <group ref={group} rotation={[0.08, 0, 0.08]}>
        {rings.map((p, i) => (
          <Line
            key={i}
            points={p}
            color={i < 4 ? "#4c95b0" : "#335b8a"}
            transparent
            opacity={i < 4 ? 0.24 : 0.11}
            lineWidth={1}
            dashed={i === 4 || i === 5}
            dashSize={0.05}
            gapSize={0.2}
          />
        ))}
        {
          <Line
            segments
            points={ticks.flat()}
            color="#5597b8"
            transparent
            opacity={0.32}
            lineWidth={1}
          />
        }
      </group>
      <group ref={inner}>
        <mesh rotation={[-Math.PI / 2 + 0.75, 0.3, 0.2]}>
          <torusGeometry args={[2.25, 0.012, 8, 128]} />
          <meshBasicMaterial color="#9594ef" transparent opacity={0.7} />
        </mesh>
        <mesh rotation={[-Math.PI / 2 - 0.65, -0.5, -0.2]}>
          <torusGeometry args={[2.25, 0.012, 8, 128]} />
          <meshBasicMaterial color="#73cedb" transparent opacity={0.6} />
        </mesh>
      </group>
      <Html center position={[0, 0.2, 0]} style={{ pointerEvents: "none" }}>
        <div className="core-label">
          <span>中国</span>
          <small>CHINA</small>
          <i>文明的轨迹</i>
        </div>
      </Html>
    </group>
  );
}
function Orb({
  position,
  color,
  selected,
  onClick,
  paused = false,
}: {
  position: V3;
  color: string;
  selected: boolean;
  onClick: () => void;
  paused?: boolean;
}) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current && selected) {
      ring.current.scale.setScalar(
        paused ? 1 : 1.12 + Math.sin(clock.elapsedTime * 2.4) * 0.12,
      );
    }
  });
  return (
    <group position={position}>
      <Glow
        color={color}
        size={selected ? 2.0 : 1.25}
        strength={selected ? 1.3 : 0.8}
      />
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[selected ? 0.17 : 0.095, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <sphereGeometry args={[0.36, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry
          args={[selected ? 0.41 : 0.25, selected ? 0.425 : 0.262, 48]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.6 : 0.35}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
function Epoch({
  era,
  i,
  onClick,
  mobile,
}: {
  era: Era;
  i: number;
  onClick: () => void;
  mobile: boolean;
}) {
  const p = eraPosition(i);
  const color = eraColor(i);
  const label = !mobile || i % 3 === 0 || i === 21;
  return (
    <>
      <Orb position={p} color={color} selected={false} onClick={onClick} />
      {label && (
        <Html
          center
          position={[p[0], p[1] + (i < 7 && i % 2 === 1 ? -0.58 : 0.62), p[2]]}
          zIndexRange={[8, 0]}
        >
          <button
            className="star-label"
            style={{ "--node-color": color } as React.CSSProperties}
            onClick={onClick}
            aria-label={`进入${era.title}`}
          >
            <span>{era.shortTitle}</span>
            <small>{era.dateLabel}</small>
          </button>
        </Html>
      )}
    </>
  );
}
function NodeStar({
  node,
  position,
  selected,
  related,
  onClick,
  paused,
}: {
  node: HistoryNode;
  position: V3;
  selected: boolean;
  related: boolean;
  onClick: () => void;
  paused: boolean;
}) {
  const color = TYPE_COLORS[node.type];
  return (
    <group>
      <Orb
        position={position}
        color={color}
        selected={selected}
        onClick={onClick}
        paused={paused}
      />
      <Html
        center
        position={[position[0], position[1] + 0.45, position[2]]}
        zIndexRange={[10, 0]}
      >
        <button
          className={`star-label entity-label ${selected ? "active" : ""} ${!related ? "dim" : ""}`}
          style={{ "--node-color": color } as React.CSSProperties}
          onClick={onClick}
          aria-label={`阅读${node.title}`}
        >
          <span>{node.title}</span>
          <small>{node.type}</small>
          {selected && <b className="reading-tag">正在阅读</b>}
        </button>
      </Html>
    </group>
  );
}
function RelationLine({
  a,
  b,
  label,
  active,
  paused,
}: {
  a: V3;
  b: V3;
  label: string;
  active: boolean;
  paused: boolean;
}) {
  const orb = useRef<THREE.Mesh>(null);
  const phase = useRef(0.2);
  const [hover, setHover] = useState(false);
  const points = useMemo(() => {
    const mid = new THREE.Vector3(...a).lerp(new THREE.Vector3(...b), 0.5);
    mid.y += 0.3;
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(...a),
      mid,
      new THREE.Vector3(...b),
    ).getPoints(32);
  }, [a, b]);
  useFrame((_, dt) => {
    if (!orb.current || paused) return;
    phase.current = (phase.current + dt * 0.12) % 1;
    orb.current.position.copy(
      points[Math.floor(phase.current * (points.length - 1))],
    );
  });
  const m = points[16];
  return (
    <group>
      <Line
        points={points}
        color={active ? "#8acada" : "#456685"}
        transparent
        opacity={active ? 0.6 : 0.18}
        lineWidth={active ? 1.3 : 1}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      />
      {active && (
        <mesh ref={orb} position={a}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#c5f5fa" />
        </mesh>
      )}
      {hover && (
        <Html center position={m.toArray()} zIndexRange={[11, 0]}>
          <span className="relation-tooltip">{label}</span>
        </Html>
      )}
    </group>
  );
}
function ActiveEra({
  era,
  base,
  props,
  positions,
}: {
  era: Era;
  base: V3;
  props: SceneProps;
  positions: Map<string, V3>;
}) {
  const related = new Set(
    era.relations
      .filter((r) => r.source === props.nodeId || r.target === props.nodeId)
      .flatMap((r) => [r.source, r.target]),
  );
  const ring = useMemo(
    () =>
      Array.from(
        { length: 129 },
        (_, i) =>
          [
            base[0] + Math.cos((i / 128) * Math.PI * 2) * 5.5,
            base[1],
            base[2] + Math.sin((i / 128) * Math.PI * 2) * 4.1,
          ] as V3,
      ),
    [base],
  );
  return (
    <>
      <Line
        points={ring}
        dashed
        dashSize={0.035}
        gapSize={0.14}
        color="#546985"
        transparent
        opacity={0.28}
      />
      <group position={base}>
        <Glow
          color={eraColor(props.eras.indexOf(era))}
          size={5}
          strength={0.28}
        />
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.11, 100]} />
          <meshBasicMaterial
            color="#8da9d4"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
        <Html center zIndexRange={[6, 0]}>
          <button className="era-center" onClick={() => props.onEra(era.id)}>
            <span>{era.shortTitle}</span>
            <small>时期概览</small>
          </button>
        </Html>
      </group>
      {era.relations.map((r) => {
        const a = positions.get(r.source),
          b = positions.get(r.target);
        if (!a || !b) return null;
        return (
          <RelationLine
            key={r.id}
            a={a}
            b={b}
            label={r.type}
            active={
              !props.nodeId ||
              r.source === props.nodeId ||
              r.target === props.nodeId
            }
            paused={props.paused || props.reduced}
          />
        );
      })}
      {era.nodes.map((n) => (
        <NodeStar
          key={n.id}
          node={n}
          position={positions.get(n.id)!}
          selected={n.id === props.nodeId}
          related={!props.nodeId || related.has(n.id) || n.id === props.nodeId}
          paused={props.paused || props.reduced}
          onClick={() => props.onNode(n.id)}
        />
      ))}
    </>
  );
}
function World(props: SceneProps) {
  const { gl } = useThree();
  useEffect(() => {
    const lost = (e: Event) => {
      e.preventDefault();
      props.onError();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, props.onError]);
  const era = props.eras.find((e) => e.id === props.eraId);
  const base = useMemo<V3>(
    () => (era ? eraPosition(props.eras.indexOf(era)) : [0, 0, 0]),
    [era, props.eras],
  );
  const positions = useMemo(
    () =>
      new Map(era?.nodes.map((n, i) => [n.id, childPosition(i, base)]) ?? []),
    [era, base],
  );
  const trail = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        props.eras.map((_, i) => new THREE.Vector3(...eraPosition(i))),
      ).getPoints(260),
    [props.eras],
  );
  return (
    <>
      <color attach="background" args={["#030711"]} />
      <fog attach="fog" args={["#030711", 65, 120]} />
      <StarField
        mobile={props.mobile}
        paused={props.paused || props.reduced || !!era}
      />
      {era ? (
        <ActiveEra era={era} base={base} props={props} positions={positions} />
      ) : (
        <>
          <ChronoCore paused={props.paused || props.reduced} />
          <Line
            points={trail}
            color="#5c82b6"
            transparent
            opacity={0.3}
            dashed
            dashSize={0.045}
            gapSize={0.12}
            lineWidth={1}
          />
          {props.eras.map((e, i) => (
            <Epoch
              key={e.id}
              era={e}
              i={i}
              mobile={props.mobile}
              onClick={() => props.onEra(e.id)}
            />
          ))}
        </>
      )}
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={6}
        maxDistance={85}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
        maxPolarAngle={Math.PI * 0.83}
        minPolarAngle={0.15}
      />
      <CameraRig props={props} base={base} positions={positions} />
    </>
  );
}
export default function StarScene(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 15, 29], fov: 45, far: 160 }}
      frameloop={
        !props.visible
          ? "never"
          : props.paused || props.reduced
            ? "demand"
            : "always"
      }
      dpr={props.mobile ? [1, 1.25] : [1, 1.5]}
      gl={{
        antialias: !props.mobile,
        alpha: false,
        powerPreference: "high-performance",
      }}
    >
      <World {...props} />
    </Canvas>
  );
}
