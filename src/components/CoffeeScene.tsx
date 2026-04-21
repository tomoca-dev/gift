import { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Float, Environment } from "@react-three/drei";
import * as THREE from "three";

/* ── Realistic Coffee Cup ── */
function CoffeeCup() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.25;
    }
  });

  const cupProfile = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    pts.push(new THREE.Vector2(0, 0));
    pts.push(new THREE.Vector2(0.45, 0));
    pts.push(new THREE.Vector2(0.48, 0.05));
    pts.push(new THREE.Vector2(0.5, 0.15));
    pts.push(new THREE.Vector2(0.55, 0.4));
    pts.push(new THREE.Vector2(0.62, 0.7));
    pts.push(new THREE.Vector2(0.68, 0.95));
    pts.push(new THREE.Vector2(0.72, 1.05));
    pts.push(new THREE.Vector2(0.74, 1.1));
    pts.push(new THREE.Vector2(0.72, 1.14));
    pts.push(new THREE.Vector2(0.66, 1.1));
    pts.push(new THREE.Vector2(0.6, 0.95));
    pts.push(new THREE.Vector2(0.53, 0.7));
    pts.push(new THREE.Vector2(0.48, 0.4));
    pts.push(new THREE.Vector2(0.43, 0.15));
    pts.push(new THREE.Vector2(0.42, 0.05));
    pts.push(new THREE.Vector2(0, 0.05));
    return pts;
  }, []);

  const handleCurve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.72, 0.9, 0),
      new THREE.Vector3(0.95, 0.85, 0),
      new THREE.Vector3(1.02, 0.65, 0),
      new THREE.Vector3(0.95, 0.45, 0),
      new THREE.Vector3(0.72, 0.4, 0),
    ]);
  }, []);

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
      <group ref={groupRef} position={[0, -0.5, 0]}>
        <mesh castShadow receiveShadow>
          <latheGeometry args={[cupProfile, 64]} />
          <meshPhysicalMaterial color="#F5F0E8" roughness={0.15} metalness={0.05} clearcoat={0.8} clearcoatRoughness={0.1} />
        </mesh>
        <mesh position={[0, 1.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.58, 64]} />
          <meshPhysicalMaterial color="#2C1503" roughness={0.05} metalness={0.2} clearcoat={1} clearcoatRoughness={0.05} />
        </mesh>
        <mesh position={[0, 1.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.57, 64]} />
          <meshStandardMaterial color="#8B5E3C" roughness={0.3} metalness={0.1} transparent opacity={0.6} />
        </mesh>
        <mesh castShadow>
          <tubeGeometry args={[handleCurve, 32, 0.045, 16, false]} />
          <meshPhysicalMaterial color="#F5F0E8" roughness={0.15} metalness={0.05} clearcoat={0.8} />
        </mesh>
        <mesh position={[0, -0.02, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.05, 1.1, 0.06, 64]} />
          <meshPhysicalMaterial color="#F5F0E8" roughness={0.15} metalness={0.05} clearcoat={0.8} clearcoatRoughness={0.1} />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1.05, 64]} />
          <meshPhysicalMaterial color="#EDE5D8" roughness={0.2} metalness={0.02} />
        </mesh>
        <mesh position={[0, 1.06, 0]}>
          <torusGeometry args={[0.71, 0.012, 16, 64]} />
          <meshStandardMaterial color="#C4A035" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <torusGeometry args={[1.04, 0.008, 16, 64]} />
          <meshStandardMaterial color="#C4A035" metalness={0.9} roughness={0.15} />
        </mesh>
      </group>
    </Float>
  );
}

/* ── Steam Particles ── */
function SteamParticles() {
  const count = 40;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const speeds = useMemo(() => Array.from({ length: count }, () => 0.3 + Math.random() * 1.2), []);
  const offsets = useMemo(() => Array.from({ length: count }, () => Math.random() * Math.PI * 2), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    for (let i = 0; i < count; i++) {
      const t = (state.clock.elapsedTime * speeds[i] + offsets[i]) % 5;
      const x = Math.sin(offsets[i] + t * 0.4) * 0.25;
      const y = t * 0.4 + 0.5;
      const z = Math.cos(offsets[i] + t * 0.3) * 0.25;
      const scale = Math.max(0, 1 - t / 5) * 0.06;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial color="#ffffff" transparent opacity={0.1} depthWrite={false} />
    </instancedMesh>
  );
}

/* ── Textured Coffee Bean ── */
function CoffeeBean({ position, scale = 0.1, speed = 1, offset = 0 }: {
  position: [number, number, number];
  scale?: number;
  speed?: number;
  offset?: number;
}) {
  const meshRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, "/images/coffee-bean.jpg");

  const beanTexture = useMemo(() => {
    const t = texture.clone();
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    return t;
  }, [texture]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.position.y = position[1] + Math.sin(t * speed * 0.5 + offset) * 0.3;
    meshRef.current.rotation.x = t * 0.3 * speed + offset;
    meshRef.current.rotation.z = t * 0.2 * speed + offset * 0.5;
    meshRef.current.rotation.y = t * 0.15 * speed + offset * 0.3;
  });

  return (
    <group ref={meshRef} position={position} scale={scale}>
      <mesh castShadow scale={[1, 0.65, 1.3]}>
        <capsuleGeometry args={[0.6, 0.6, 12, 24]} />
        <meshPhysicalMaterial
          map={beanTexture}
          color="#7B5B3A"
          roughness={0.5}
          metalness={0.05}
          clearcoat={0.4}
          clearcoatRoughness={0.3}
          bumpMap={beanTexture}
          bumpScale={0.03}
        />
      </mesh>
      {/* Center crease */}
      <mesh position={[0, 0, 0.01]} rotation={[0, 0, Math.PI / 2]} scale={[0.65, 1.3, 1]}>
        <torusGeometry args={[0.6, 0.04, 6, 24, Math.PI]} />
        <meshStandardMaterial color="#2A1200" roughness={0.9} />
      </mesh>
    </group>
  );
}

/* ── Many Floating Beans ── */
function FloatingBeans() {
  const beans = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number; speed: number; offset: number }[] = [];
    for (let i = 0; i < 60; i++) {
      arr.push({
        pos: [
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 6 - 1,
        ],
        scale: 0.05 + Math.random() * 0.12,
        speed: 0.3 + Math.random() * 1.4,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, []);

  return (
    <group>
      {beans.map((bean, i) => (
        <CoffeeBean key={i} position={bean.pos} scale={bean.scale} speed={bean.speed} offset={bean.offset} />
      ))}
    </group>
  );
}

/* ── Exportable mini scene for other pages ── */
export function FloatingBeansBackground({ count = 20, opacity = 0.6 }: { count?: number; opacity?: number }) {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none" style={{ opacity }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 4]} intensity={0.8} color="#FFD700" />
        <MiniBeans count={count} />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}

function MiniBeans({ count }: { count: number }) {
  const beans = useMemo(() => {
    const arr: { pos: [number, number, number]; scale: number; speed: number; offset: number }[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        pos: [
          (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 4 - 2,
        ],
        scale: 0.04 + Math.random() * 0.08,
        speed: 0.2 + Math.random() * 0.8,
        offset: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [count]);

  return (
    <group>
      {beans.map((bean, i) => (
        <CoffeeBean key={i} position={bean.pos} scale={bean.scale} speed={bean.speed} offset={bean.offset} />
      ))}
    </group>
  );
}

/* ── Main Scene ── */
const CoffeeScene = () => {
  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        camera={{ position: [0, 1.2, 4.5], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        shadows
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} color="#FFD700" castShadow shadow-mapSize={[512, 512]} />
        <pointLight position={[-4, 3, 2]} intensity={0.4} color="#FF8C00" />
        <pointLight position={[2, -1, 3]} intensity={0.2} color="#FFE4B5" />
        <CoffeeCup />
        <SteamParticles />
        <FloatingBeans />
        <Environment preset="city" />
      </Canvas>
    </div>
  );
};

export default CoffeeScene;
