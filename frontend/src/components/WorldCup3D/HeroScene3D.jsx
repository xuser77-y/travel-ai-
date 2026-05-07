import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Cinematic 3D hero scene for the WorldCup page.
 *
 * Composition (kept intentionally lightweight — this is a hero background,
 * not a game):
 *   - Gradient sunset sky (large inverted sphere with vertex-color shader).
 *   - Glowing low sun on the horizon.
 *   - Large displaced ground plane = sand dunes (sine-noise vertex shader,
 *     ~5k tris). Animates very slowly so the surface looks alive.
 *   - 3 camel silhouettes drifting across the horizon (simple BoxGeometry
 *     groups posed to read as camels in profile — true low-poly aesthetic).
 *   - 200 floating sand-glint particles (Points).
 *   - Camera mouse-parallax + a subtle scroll-driven zoom-in.
 *
 * Performance:
 *   - DPR clamped to [1, 1.5] so HiDPI laptops don't render at 4x.
 *   - frameloop="always" but inner shaders are O(1) per vertex.
 *   - Caller is expected to gate rendering on prefers-reduced-motion / mobile
 *     and fall back to a still image (handled in WorldCup.jsx).
 */

// ---------- Sky ----------------------------------------------------------
// Large inverted sphere with a custom shader producing a Moroccan-sunset
// gradient. We pre-bake the colours as a vertex attribute so the fragment
// shader is a single varying read — costs almost nothing.
const SunsetSky = () => {
  const skyRef = useRef();
  const uniforms = useMemo(() => ({
    uTopColor:    { value: new THREE.Color('#1f1147') },  // night-violet zenith
    uMidColor:    { value: new THREE.Color('#c2410c') },  // burnt orange band
    uHorizonColor:{ value: new THREE.Color('#fbbf24') },  // gold horizon
    uHazeColor:   { value: new THREE.Color('#7c2d12') }   // deep haze near ground
  }), []);

  return (
    <mesh ref={skyRef} scale={[500, 500, 500]}>
      <sphereGeometry args={[1, 32, 24]} />
      <shaderMaterial
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={/* glsl */`
          varying float vY;
          void main() {
            vY = position.y; // -1 (down) .. 1 (up) in unit sphere
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={/* glsl */`
          uniform vec3 uTopColor;
          uniform vec3 uMidColor;
          uniform vec3 uHorizonColor;
          uniform vec3 uHazeColor;
          varying float vY;
          void main() {
            float t = clamp(vY * 0.5 + 0.5, 0.0, 1.0); // 0..1 horizon..zenith
            // Three-stop gradient: haze -> horizon -> mid -> top
            vec3 col = mix(uHazeColor, uHorizonColor, smoothstep(0.0, 0.20, t));
            col = mix(col, uMidColor, smoothstep(0.20, 0.50, t));
            col = mix(col, uTopColor, smoothstep(0.55, 1.0, t));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
};

// ---------- Sun ----------------------------------------------------------
// A soft emissive disc sitting on the horizon. The bloom-like halo is
// faked with a second additive sphere to keep us out of postprocessing.
const Sun = () => (
  <group position={[0, 1.6, -28]}>
    <mesh>
      <sphereGeometry args={[2.4, 32, 32]} />
      <meshBasicMaterial color="#fde68a" />
    </mesh>
    <mesh>
      <sphereGeometry args={[3.6, 32, 32]} />
      <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
    <mesh>
      <sphereGeometry args={[5.6, 32, 32]} />
      <meshBasicMaterial color="#f97316" transparent opacity={0.18} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  </group>
);

// ---------- Dunes --------------------------------------------------------
// One big PlaneGeometry pushed onto the X-Z plane. The vertex shader adds
// layered sine waves to create an undulating dune field. A subtle time
// uniform makes the surface drift like wind. Fragment lighting is a
// distance-based gradient so we avoid any costly real lighting.
const Dunes = () => {
  const ref = useRef();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color('#3b1308') }, // far / shadowed
    uColorB: { value: new THREE.Color('#c2410c') }, // mid sunlit
    uColorC: { value: new THREE.Color('#fbbf24') }  // crest / gold lit
  }), []);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt * 0.06;
  });

  return (
    <mesh ref={ref} position={[0, -2.2, -10]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[120, 80, 96, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={/* glsl */`
          uniform float uTime;
          varying float vH;        // computed height for fragment colouring
          varying vec2 vUv;
          // Cheap layered noise via summed sines — looks plenty dune-like.
          float dunes(vec2 p) {
            float h = 0.0;
            h += sin(p.x * 0.18 + uTime * 0.6) * 1.6;
            h += sin(p.y * 0.22 + uTime * 0.4) * 1.2;
            h += sin((p.x + p.y) * 0.32) * 0.8;
            h += sin(p.x * 0.55 - p.y * 0.30) * 0.4;
            return h;
          }
          void main() {
            vec3 pos = position;
            float h = dunes(pos.xy);
            pos.z += h;
            vH = h;
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={/* glsl */`
          uniform vec3 uColorA;
          uniform vec3 uColorB;
          uniform vec3 uColorC;
          varying float vH;
          varying vec2 vUv;
          void main() {
            // Mix far->near with vUv.y, then add height as a "lit crest" highlight.
            float distance = smoothstep(0.0, 1.0, vUv.y);
            vec3 col = mix(uColorA, uColorB, distance);
            float crest = smoothstep(0.6, 2.4, vH);
            col = mix(col, uColorC, crest * 0.55);
            // Subtle haze at the back so the dunes blend into the sky
            float haze = smoothstep(0.65, 1.0, vUv.y);
            col = mix(col, vec3(0.85, 0.45, 0.18), haze * 0.5);
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  );
};

// ---------- Camel silhouettes -------------------------------------------
// Stylised camels built from a handful of boxes. Read clearly as profiles
// against the orange horizon without needing an external GLB.
const Camel = ({ x = 0, z = -22, scale = 1, speed = 0.05 }) => {
  const groupRef = useRef();
  const startX = useRef(x);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
    groupRef.current.position.x += dt * speed;
    // Loop them back so they keep crossing the horizon.
    if (groupRef.current.position.x > 30) groupRef.current.position.x = -30;
    // Tiny vertical bob = walking gait.
    groupRef.current.position.y = -1.2 + Math.sin(groupRef.current.position.x * 1.6) * 0.04;
  });

  return (
    <group ref={groupRef} position={[startX.current, -1.2, z]} scale={scale}>
      {/* Body */}
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[1.6, 0.5, 0.45]} />
        <meshBasicMaterial color="#1c0a04" />
      </mesh>
      {/* Hump */}
      <mesh position={[0.05, 0.95, 0]}>
        <sphereGeometry args={[0.35, 12, 10]} />
        <meshBasicMaterial color="#1c0a04" />
      </mesh>
      {/* Neck */}
      <mesh position={[0.85, 1.05, 0]} rotation={[0, 0, -0.6]}>
        <boxGeometry args={[0.25, 0.9, 0.25]} />
        <meshBasicMaterial color="#1c0a04" />
      </mesh>
      {/* Head */}
      <mesh position={[1.18, 1.45, 0]}>
        <boxGeometry args={[0.45, 0.28, 0.28]} />
        <meshBasicMaterial color="#1c0a04" />
      </mesh>
      {/* Legs (4) */}
      {[
        [-0.55, -0.05, 0.18],
        [-0.55, -0.05, -0.18],
        [ 0.55, -0.05, 0.18],
        [ 0.55, -0.05, -0.18]
      ].map((p, i) => (
        <mesh key={i} position={p}>
          <boxGeometry args={[0.14, 0.95, 0.14]} />
          <meshBasicMaterial color="#1c0a04" />
        </mesh>
      ))}
    </group>
  );
};

// ---------- Sand particles ----------------------------------------------
// Cheap floating motes — a Points cloud with additive blending.
const SandParticles = ({ count = 220 }) => {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 60;
      arr[i * 3 + 1] = Math.random() * 10 - 1;
      arr[i * 3 + 2] = -Math.random() * 30 - 4;
    }
    return arr;
  }, [count]);

  const ref = useRef();
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.02;
    const pos = ref.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      // Drift right + tiny up bob, recycle past the right edge.
      pos.array[i * 3]     += dt * 0.35;
      pos.array[i * 3 + 1] += Math.sin(performance.now() * 0.0002 + i) * dt * 0.12;
      if (pos.array[i * 3] > 30) pos.array[i * 3] = -30;
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={0.07}
        color="#fde68a"
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

// ---------- Camera rig ---------------------------------------------------
// Smooth mouse parallax + a tiny zoom-in on scroll. We lerp every frame
// so the camera never "snaps" to the cursor.
const CameraRig = () => {
  const { camera } = useThree();
  const target = useRef({ x: 0, y: 1.5, z: 8 });

  useEffect(() => {
    const onMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      target.current.x = nx * 0.8;     // pan left/right
      target.current.y = 1.5 - ny * 0.4; // tilt
    };
    const onScroll = () => {
      // Hero is 100vh tall — fade scroll progress 0..1 across that range.
      const max = window.innerHeight;
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      target.current.z = 8 - p * 1.6;  // gentle dolly-in
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  useFrame(() => {
    camera.position.x += (target.current.x - camera.position.x) * 0.04;
    camera.position.y += (target.current.y - camera.position.y) * 0.04;
    camera.position.z += (target.current.z - camera.position.z) * 0.04;
    camera.lookAt(0, 1.0, -10);
  });

  return null;
};

// ---------- Public component --------------------------------------------
const HeroScene3D = () => (
  <Canvas
    dpr={[1, 1.5]}
    camera={{ position: [0, 1.5, 8], fov: 55, near: 0.1, far: 600 }}
    gl={{ antialias: true, powerPreference: 'high-performance' }}
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
  >
    <Suspense fallback={null}>
      <CameraRig />
      <SunsetSky />
      <Sun />
      <Dunes />
      <Camel x={-12} z={-22} scale={1.0} speed={0.06} />
      <Camel x={-2}  z={-19} scale={0.85} speed={0.07} />
      <Camel x={ 9}  z={-24} scale={1.1}  speed={0.05} />
      <SandParticles count={220} />
      {/* No real lighting — every material is BasicMaterial / shader, which
          keeps the scene perfectly art-directed and very fast. */}
    </Suspense>
  </Canvas>
);

export default HeroScene3D;
