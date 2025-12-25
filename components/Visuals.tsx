import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float, Line, Octahedron, Cylinder, Icosahedron, Torus } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { AppState, GestureType, MoonPhase, Season, Landmark } from '../types';
import { COLORS, PARTICLE_COUNTS, CHAKRA_DATA } from '../constants';

// --- Types for R3F ---
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [key: string]: any;
    }
  }
}

// --- Shaders ---

const starVertexShader = `
  attribute float size;
  attribute vec3 color;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragmentShader = `
  varying vec3 vColor;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 2.0);
    gl_FragColor = vec4(vColor, glow);
  }
`;

const ribbonVertexShader = `
  attribute float size;
  attribute float opacity;
  varying float vOpacity;
  void main() {
    vOpacity = opacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * (350.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const ribbonFragmentShader = `
  varying float vOpacity;
  uniform vec3 uColor;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    float alpha = (1.0 - r * 2.0) * vOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

// --- Components ---

// Wireframe Hand (Cyberpunk Style)
const WireframeHand: React.FC<{ landmarks: Landmark[]; resonance: number }> = ({ landmarks, resonance }) => {
    const connections = [
        [0, 1, 2, 3, 4],
        [0, 5, 6, 7, 8],
        [5, 9, 13, 17], 
        [0, 9, 10, 11, 12],
        [0, 13, 14, 15, 16],
        [0, 17, 18, 19, 20]
    ];

    if (!landmarks || landmarks.length === 0) return null;

    // Coordinate mapping: 0..1 to -12.5..12.5 and 10..-10
    const scaleX = -25;
    const scaleY = -20;
    const offsetX = 12.5;
    const offsetY = 10;

    // Safety: Ensure no NaNs are created if tracking glitches
    const points = landmarks.map(l => {
        const x = (l.x * scaleX) + offsetX;
        const y = (l.y * scaleY) + offsetY;
        const z = l.z * -5;
        // Fallback to 0 if NaN appears to prevent geometry crash
        return new THREE.Vector3(
            Number.isFinite(x) ? x : 0, 
            Number.isFinite(y) ? y : 0, 
            Number.isFinite(z) ? z : 0
        );
    });

    const activeIndex = Math.min(Math.floor(resonance * 6.9), 6);
    const color = new THREE.Color(CHAKRA_DATA[activeIndex].color);

    return (
        <group position={[0,0,5]}>
            {connections.map((path, i) => (
                <Line
                    key={i}
                    points={path.map(idx => points[idx])}
                    color={color}
                    lineWidth={1 + resonance}
                    opacity={0.6}
                    transparent
                />
            ))}
            {points.map((p, i) => (
                <mesh key={i} position={p}>
                    <icosahedronGeometry args={[0.15, 0]} />
                    <meshBasicMaterial color="white" transparent opacity={0.8} />
                </mesh>
            ))}
        </group>
    );
};

// 1. Tide Ribbon
const TideRibbon: React.FC<{ appState: AppState; resonance: number; tideLevel: number }> = ({ appState, resonance, tideLevel }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = PARTICLE_COUNTS.tideRibbon;
  
  const [initialPos] = useMemo(() => {
    const p = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 15;
      p[i*3] = Math.cos(angle) * radius;
      p[i*3+1] = (Math.random() - 0.5) * 5; 
      p[i*3+2] = Math.sin(angle) * radius;
    }
    return [p];
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current || appState === AppState.DISCONNECTED) return;
    const time = state.clock.getElapsedTime();
    const pos = pointsRef.current.geometry.attributes.position;
    const op = pointsRef.current.geometry.attributes.opacity;

    const activeLevel = tideLevel * (0.5 + resonance * 0.5); 

    for(let i=0; i<count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const baseRadius = 15 + activeLevel * 2;
      
      const wave = Math.sin(angle * 4 + time * 0.5) * (1 + activeLevel * 3);
      const microWave = Math.cos(angle * 20 + time * 2) * 0.2;
      
      const x = Math.cos(angle + time * 0.02) * baseRadius;
      const y = initialPos[i*3+1] + wave + microWave;
      const z = Math.sin(angle + time * 0.02) * baseRadius;

      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
         pos.setXYZ(i, x, y, z);
      }
      
      op.setX(i, 0.3 + activeLevel * 0.7);
    }
    pos.needsUpdate = true;
    op.needsUpdate = true;
  });

  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(COLORS.tide) } }), []);

  if (appState === AppState.DISCONNECTED) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={initialPos} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={new Float32Array(count).fill(2)} itemSize={1} />
        <bufferAttribute attach="attributes-opacity" count={count} array={new Float32Array(count).fill(0)} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial vertexShader={ribbonVertexShader} fragmentShader={ribbonFragmentShader} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// 2. Moon Phase Ring
const MoonRing: React.FC<{ appState: AppState; moonPhase: MoonPhase }> = ({ appState, moonPhase }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = PARTICLE_COUNTS.moonRing;

  const [initialPos] = useMemo(() => {
    const p = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 18; 
      p[i*3] = Math.cos(angle) * radius;
      p[i*3+1] = 0;
      p[i*3+2] = Math.sin(angle) * radius;
    }
    return [p];
  }, [count]);

  useFrame((state) => {
    if (!pointsRef.current || appState === AppState.DISCONNECTED) return;
    const pos = pointsRef.current.geometry.attributes.position;
    const op = pointsRef.current.geometry.attributes.opacity;
    const time = state.clock.getElapsedTime();

    let visibleArc = 0;
    if (moonPhase <= 0.5) {
        visibleArc = (moonPhase / 0.5) * Math.PI * 2;
    } else {
        visibleArc = ((1.0 - moonPhase) / 0.5) * Math.PI * 2;
    }
    visibleArc = Math.max(0.1, visibleArc);

    for(let i=0; i<count; i++) {
      const angle = (i / count) * Math.PI * 2;
      let alpha = angle < visibleArc ? 0.8 : 0.05;
      
      pos.setY(i, Math.sin(angle * 5 + time) * 0.5);
      op.setX(i, alpha);
    }
    pos.needsUpdate = true;
    op.needsUpdate = true;
    pointsRef.current.rotation.y = -time * 0.05;
  });

  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(COLORS.moon) } }), []);

  if (appState === AppState.DISCONNECTED) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={initialPos} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={new Float32Array(count).fill(3)} itemSize={1} />
        <bufferAttribute attach="attributes-opacity" count={count} array={new Float32Array(count).fill(0)} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial vertexShader={ribbonVertexShader} fragmentShader={ribbonFragmentShader} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// 3. Sacred Geometry Core
const SacredGeometryCore: React.FC<{ 
  appState: AppState; 
  gesture: GestureType; 
  resonance: number;
  handPos: { x: number; y: number } 
}> = ({ appState, gesture, resonance, handPos }) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (!groupRef.current || appState === AppState.DISCONNECTED) return;
    
    // Hand tracking tilt
    const tiltX = (handPos.y - 0.5) * 1.5; 
    const tiltZ = -(handPos.x - 0.5) * 1.5; 
    
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, tiltX, 0.1);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, tiltZ, 0.1);
    
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.5;

    let targetScale = 1;
    let rotationSpeed = 1;

    if (gesture === GestureType.PINCH || gesture === GestureType.CLOSED_FIST) {
        targetScale = 0.5;
        rotationSpeed = 3.0;
    } else if (gesture === GestureType.OPEN_PALM) {
        targetScale = 1.5;
        rotationSpeed = 0.5;
    }

    const time = state.clock.elapsedTime;
    
    if (coreRef.current) {
        coreRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
        coreRef.current.rotation.y += 0.01 * rotationSpeed;
        coreRef.current.rotation.z += 0.005 * rotationSpeed;
    }

    if (ring1Ref.current) {
        ring1Ref.current.rotation.x = Math.sin(time * 0.2) * Math.PI;
        ring1Ref.current.rotation.y += 0.02 * rotationSpeed;
    }

    if (ring2Ref.current) {
         ring2Ref.current.rotation.x = Math.cos(time * 0.15) * Math.PI;
         ring2Ref.current.rotation.y -= 0.015 * rotationSpeed;
    }
  });

  const activeIndex = Math.min(Math.floor(resonance * 6.9), 6);
  const coreColor = CHAKRA_DATA[activeIndex].color;

  if (appState === AppState.DISCONNECTED) return null;

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
       {/* Central Core */}
       <mesh ref={coreRef}>
         <icosahedronGeometry args={[1.5, 0]} />
         <meshBasicMaterial 
            color={coreColor} 
            wireframe 
            transparent 
            opacity={0.6 + resonance * 0.4}
         />
         <mesh>
            <icosahedronGeometry args={[1.4, 0]} />
            <meshBasicMaterial color={coreColor} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} />
         </mesh>
       </mesh>

       {/* Outer Rings */}
       <mesh ref={ring1Ref}>
         <torusGeometry args={[3.5, 0.02, 16, 100]} />
         <meshBasicMaterial color={COLORS.starlight} transparent opacity={0.3} />
       </mesh>

       <mesh ref={ring2Ref}>
         <torusGeometry args={[4.2, 0.02, 16, 100]} />
         <meshBasicMaterial color={COLORS.tide} transparent opacity={0.2} />
       </mesh>
    </group>
  );
};

// 4. "Mobius Helix Swarm" - The new symbiotic form
const MobiusHelixSwarm: React.FC<{ 
    appState: AppState; 
    gesture: GestureType; 
    resonance: number; 
    handPos: { x: number, y: number } 
}> = ({ appState, gesture, resonance, handPos }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 12000;

  // Initialize random "home" positions (chaos) and "target" parameters
  const [initialData] = useMemo(() => {
    const chaosPos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 3); 
    
    for(let i=0; i<count; i++) {
      const r = 40 * Math.cbrt(Math.random()); 
      const theta = Math.random() * Math.PI * 2;
      // Clamp value for acos to prevent NaN due to float precision
      const val = 2 * Math.random() - 1;
      const phi = Math.acos(Math.max(-1, Math.min(1, val)));
      
      chaosPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
      chaosPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      chaosPos[i*3+2] = r * Math.cos(phi);

      rnd[i*3] = (Math.random() - 0.5);
      rnd[i*3+1] = (Math.random() - 0.5);
      rnd[i*3+2] = (Math.random() - 0.5);
    }
    return [chaosPos, rnd];
  }, [count]);

  const [positions] = useState(() => new Float32Array(count * 3)); // Current positions buffer

  useFrame((state) => {
    if (!pointsRef.current || appState === AppState.DISCONNECTED) return;
    const time = state.clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.attributes.position;
    
    // Updated Logic:
    // OPEN_PALM -> Explosion (Chaos)
    // CLOSED_FIST -> Singularity/Implosion (Order/Force)
    // NONE/POINTING -> DNA Helix Torus (Symbiosis/Tree Maintenance)
    let mode = 0; 
    if (gesture === GestureType.OPEN_PALM) mode = 2; // Explosion
    else if (gesture === GestureType.CLOSED_FIST) mode = 3; // Singularity
    else mode = 1; // Default Helix (Tree Maintenance)

    // Fast explosion (0.15), smooth helix formation (0.04)
    const lerpSpeed = mode === 2 ? 0.15 : 0.04; 

    // Apply hand tilt to the entire swarm
    const tiltX = (handPos.y - 0.5) * 0.8;
    const tiltY = (handPos.x - 0.5) * 0.8;
    
    pointsRef.current.rotation.x = THREE.MathUtils.lerp(pointsRef.current.rotation.x, tiltX, 0.05);
    pointsRef.current.rotation.y = time * 0.05 + tiltY; 

    for(let i=0; i<count; i++) {
        let tx = 0, ty = 0, tz = 0;
        const cx = initialData[0][i*3]; // Chaos X
        const cy = initialData[0][i*3+1];
        const cz = initialData[0][i*3+2];
        const rx = initialData[1][i*3]; // Random offset

        // Mode 2: Rapid Dispersal (Star-like Explosion)
        if (mode === 2) {
             const explosionFactor = 4.0; // Huge expansion
             const jitter = Math.sin(time * 25 + i) * 6; // Fast high-frequency jitter
             
             // Expand outwards based on initial chaos sphere positions
             tx = cx * explosionFactor + rx * 20 + jitter;
             ty = cy * explosionFactor + rx * 20 + jitter;
             tz = cz * explosionFactor + rx * 20 + jitter;
        } 
        // Mode 3: Singularity (Implosion to center)
        else if (mode === 3) {
            const r = 0.5 + Math.sin(time * 15 + i * 0.1) * 0.2;
            tx = rx * r * 2;
            ty = rx * r * 2;
            tz = rx * r * 2;
        } 
        // Mode 1: DNA Helix Torus (Order/Symbiosis/Maintenance)
        else {
            const iNorm = i / count;
            const u = iNorm * Math.PI * 20 + time * 0.5; 
            const v = iNorm * Math.PI * 2 + time * 0.1; 

            const R = 14; 
            const r = 5;  

            const strandOffset = (i % 2 === 0) ? 0 : Math.PI; 
            const tubeAngle = u + strandOffset;
            
            const x = (R + r * Math.cos(tubeAngle)) * Math.cos(v);
            const y = (R + r * Math.cos(tubeAngle)) * Math.sin(v);
            const z = r * Math.sin(tubeAngle);
            
            // Pre-rotate to look good
            const rotX = x;
            const rotY = y * Math.cos(Math.PI/4) - z * Math.sin(Math.PI/4);
            const rotZ = y * Math.sin(Math.PI/4) + z * Math.cos(Math.PI/4);
            
            tx = rotX + rx * 1.5;
            ty = rotY + rx * 1.5;
            tz = rotZ + rx * 1.5;
        }

        // Check for NaN to prevent geometry crash
        if (Number.isFinite(tx) && Number.isFinite(ty) && Number.isFinite(tz)) {
            positions[i*3]   += (tx - positions[i*3]) * lerpSpeed;
            positions[i*3+1] += (ty - positions[i*3+1]) * lerpSpeed;
            positions[i*3+2] += (tz - positions[i*3+2]) * lerpSpeed;
        
            posAttr.setXYZ(i, positions[i*3], positions[i*3+1], positions[i*3+2]);
        }
    }
    
    posAttr.needsUpdate = true;
  });

  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(COLORS.qi) } }), []);

  if (appState === AppState.DISCONNECTED) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={new Float32Array(count).fill(2.0)} itemSize={1} />
        <bufferAttribute attach="attributes-opacity" count={count} array={new Float32Array(count).fill(0.7)} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial vertexShader={ribbonVertexShader} fragmentShader={ribbonFragmentShader} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};


// 5. Main Particle System (The Life Tree Nebula)
// Updated Behavior:
// - Default/Pointing: Tree (Growth/Order) - "World Tree Maintenance"
// - Open Palm: Chaotic Expansion (Big Bang)
// - Closed Fist: Singularity (Black Hole)
const MainParticleSystem: React.FC<{ 
  appState: AppState; 
  gesture: GestureType; 
  resonance: number; 
  season: Season; 
  moonPhase: MoonPhase;
  handPos: { x: number; y: number } 
}> = ({ appState, gesture, resonance, season, moonPhase, handPos }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const count = PARTICLE_COUNTS.field + PARTICLE_COUNTS.tree;

  const [positions, colors, sizes, randoms] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const rnd = new Float32Array(count * 3);

    const c1 = new THREE.Color(COLORS.deepSpace);
    const c2 = new THREE.Color(COLORS.starlight);

    for (let i = 0; i < count; i++) {
      pos[i*3] = (Math.random() - 0.5) * 60;
      pos[i*3+1] = (Math.random() - 0.5) * 60;
      pos[i*3+2] = (Math.random() - 0.5) * 40;

      const c = c1.clone().lerp(c2, Math.random());
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      
      sz[i] = Math.random() * 0.8 + 0.2;
      rnd[i*3] = Math.random(); rnd[i*3+1] = Math.random(); rnd[i*3+2] = Math.random();
    }
    return [pos, col, sz, rnd];
  }, [count]);

  const tempSeasonColor = useMemo(() => new THREE.Color(), []);
  const tempDeepSpace = useMemo(() => new THREE.Color(), []);
  const tempTargetColor = useMemo(() => new THREE.Color(), []);
  const tempWarm = useMemo(() => new THREE.Color(COLORS.sun), []);
  const tempCool = useMemo(() => new THREE.Color(COLORS.deepSpace).lerp(new THREE.Color(COLORS.moon), 0.5), []);
  
  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();
    const posAttr = pointsRef.current.geometry.attributes.position;
    const colAttr = pointsRef.current.geometry.attributes.color;

    // Determine State
    // Mode 0: Drift (Not used in active state)
    // Mode 1: Tree (Open/Growth/Maintenance) - Default if None or Pointing
    // Mode 2: Singularity (Fist)
    // Mode 3: Expansion (Open Palm)
    let mode = 1; // Default to Tree (Maintenance)
    
    if (appState === AppState.RESONANT) {
        if (gesture === GestureType.CLOSED_FIST) mode = 2; // Singularity
        else if (gesture === GestureType.OPEN_PALM) mode = 3; // Expansion
        else mode = 1; // Tree (Default/None/Pointing)
    }

    const isFist = mode === 2;
    const isTree = mode === 1;
    const isExpansion = mode === 3;

    // Interpolation Speed
    const lerpFactor = isFist ? 0.08 : (isExpansion ? 0.05 : 0.03);
    
    // Calculate Hand World Position
    // Aligned with WireframeHand: 
    // x range: -12.5 to 12.5 (from 0..1 input) -> (x-0.5) * -25
    // y range: -10 to 10 (from 0..1 input) -> (y-0.5) * -20 
    // z: Wireframe is at 5.
    const handWorldX = (handPos.x - 0.5) * -25;
    const handWorldY = (handPos.y - 0.5) * -20;
    const handWorldZ = 5; 

    // Color Logic
    const distFromFull = Math.abs(moonPhase - 0.5); 
    const warmthFactor = 1.0 - (distFromFull * 2.0);
    const moodColor = tempCool.clone().lerp(tempWarm, warmthFactor);
    tempSeasonColor.set(COLORS.seasons[season.toLowerCase() as keyof typeof COLORS.seasons]);
    tempDeepSpace.set(COLORS.deepSpace);

    for (let i = 0; i < count; i++) {
      let tx, ty, tz;
      
      if (isFist) {
        // --- SINGULARITY MODE (Attract to Hand) ---
        // Intense attraction to hand position + small noise sphere
        const r = (randoms[i*3] + 0.1) * 8; // Small radius ball
        const theta = randoms[i*3+1] * Math.PI * 2 + time * 5; // Spin fast
        const phi = randoms[i*3+2] * Math.PI;

        tx = handWorldX + r * Math.sin(phi) * Math.cos(theta);
        ty = handWorldY + r * Math.sin(phi) * Math.sin(theta);
        tz = handWorldZ + r * Math.cos(phi);

        // Color: Hot/Energy (White/Orange)
        if (i % 5 === 0) {
            tempTargetColor.set(COLORS.chakraStart).lerp(new THREE.Color("white"), 0.5);
            colAttr.setXYZ(i, tempTargetColor.r, tempTargetColor.g, tempTargetColor.b);
        } else {
             colAttr.setXYZ(i, tempSeasonColor.r, tempSeasonColor.g, tempSeasonColor.b);
        }

      } else if (isExpansion) {
         // --- EXPANSION MODE (Chaos/Big Bang) ---
         // Particles fly outwards from center violently
         const cx = posAttr.getX(i);
         const cy = posAttr.getY(i);
         const cz = posAttr.getZ(i);
         
         // Direction based on index chaos
         tx = (randoms[i*3] - 0.5) * 150; 
         ty = (randoms[i*3+1] - 0.5) * 150;
         tz = (randoms[i*3+2] - 0.5) * 100;
         
         tempTargetColor.set(COLORS.starlight).lerp(new THREE.Color("white"), 0.8);
         colAttr.setXYZ(i, tempTargetColor.r, tempTargetColor.g, tempTargetColor.b);

      } else {
        // --- TREE MODE (Growth/Maintenance) ---
        if (i < PARTICLE_COUNTS.tree) {
          const t = i / PARTICLE_COUNTS.tree;
          const angle = t * Math.PI * 2 * 137.5; 
          const r = 8 * Math.pow(t, 0.6); 
          const h = (t - 0.5) * 20;
          const twist = h > 5 ? (h - 5) * 0.5 : 0;
          
          tx = Math.cos(angle + twist + time * 0.1) * r;
          ty = h;
          tz = Math.sin(angle + twist + time * 0.1) * r;

          if (Math.random() > 0.95) {
            colAttr.setXYZ(i, tempSeasonColor.r, tempSeasonColor.g, tempSeasonColor.b);
          } else {
            tempTargetColor.set(COLORS.starlight).lerp(moodColor, 0.6);
            colAttr.setXYZ(i, tempTargetColor.r, tempTargetColor.g, tempTargetColor.b);
          }
        } else {
          // Background field while tree is active
          tx = (randoms[i*3] - 0.5) * 80;
          ty = (randoms[i*3+1] - 0.5) * 80;
          tz = (randoms[i*3+2] - 0.5) * 50;
          tempTargetColor.copy(tempDeepSpace).lerp(moodColor, 0.4);
          colAttr.setXYZ(i, tempTargetColor.r, tempTargetColor.g, tempTargetColor.b);
        }
      }

      const cx = posAttr.getX(i);
      const cy = posAttr.getY(i);
      const cz = posAttr.getZ(i);
      
      // Interpolate to target with NaN safety
      if (Number.isFinite(tx) && Number.isFinite(ty) && Number.isFinite(tz) &&
          Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(cz)) {
         posAttr.setXYZ(i, cx + (tx - cx) * lerpFactor, cy + (ty - cy) * lerpFactor, cz + (tz - cz) * lerpFactor);
      }
    }
    
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    if (isTree) pointsRef.current.rotation.y = time * 0.05;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={count} array={sizes} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial vertexShader={starVertexShader} fragmentShader={starFragmentShader} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};

// --- Main Export ---

export const Visuals: React.FC<{ 
  appState: AppState; 
  gesture: GestureType; 
  resonance: number;
  moonPhase: MoonPhase;
  season: Season;
  tideLevel?: number;
  handPos: { x: number, y: number };
  landmarks?: Landmark[];
}> = (props) => {
  const tide = props.tideLevel || 0.5;

  return (
    <>
      <color attach="background" args={[COLORS.deepSpace]} />
      <ambientLight intensity={props.appState === AppState.DISCONNECTED ? 0.1 : 0.4} />
      <pointLight position={[10, 10, 10]} intensity={props.resonance * 2} color={COLORS.sun} />
      <pointLight position={[-10, -5, -10]} intensity={props.resonance} color={COLORS.moon} />

      <MainParticleSystem {...props} />
      <TideRibbon {...props} tideLevel={tide} />
      <MoonRing {...props} />
      <MobiusHelixSwarm {...props} />
      
      {/* Wireframe Hand (Physical Anchor) */}
      {props.landmarks && <WireframeHand landmarks={props.landmarks} resonance={props.resonance} />}

      <SacredGeometryCore 
        appState={props.appState} 
        gesture={props.gesture} 
        resonance={props.resonance} 
        handPos={props.handPos}
      />
      
      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.15} mipmapBlur intensity={props.appState === AppState.RESONANT ? 1.5 : 0.5} radius={0.7} />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.1} darkness={1.0} />
      </EffectComposer>
    </>
  );
};