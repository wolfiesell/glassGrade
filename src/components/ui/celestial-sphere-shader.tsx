'use client'

import * as React from 'react'
import * as THREE from 'three'

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec3 vNormal;
  varying vec3 vPos;
  uniform float u_time;
  uniform vec3 u_color1;
  uniform vec3 u_color2;
  uniform float u_cloud_density;
  uniform float u_glow_intensity;

  float random(vec3 p) {
    return fract(sin(dot(p, vec3(12.9898, 78.233, 151.7182))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    vec3 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(
        mix(random(i + vec3(0.0, 0.0, 0.0)), random(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(random(i + vec3(0.0, 1.0, 0.0)), random(i + vec3(1.0, 1.0, 0.0)), u.x),
        u.y
      ),
      mix(
        mix(random(i + vec3(0.0, 0.0, 1.0)), random(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(random(i + vec3(0.0, 1.0, 1.0)), random(i + vec3(1.0, 1.0, 1.0)), u.x),
        u.y
      ),
      u.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 6; i++) {
      v += amp * noise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 pos = normalize(vPos);

    vec3 coord = pos * u_cloud_density + vec3(u_time * 0.08, u_time * 0.05, u_time * 0.03);
    float c = fbm(coord);
    float c2 = fbm(coord * 1.7 + 3.1);
    vec3 nebula = mix(u_color1, u_color2, smoothstep(0.32, 0.68, c));
    nebula = mix(nebula, vec3(1.0, 0.82, 1.0), smoothstep(0.55, 0.9, c2) * 0.4);

    float ndotv = max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0);
    float fresnel = pow(1.0 - ndotv, 2.2);
    vec3 glow = mix(u_color2, vec3(1.0), 0.4) * fresnel * u_glow_intensity;
    float limb = mix(0.7, 1.05, ndotv);

    gl_FragColor = vec4(nebula * limb + glow, 1.0);
  }
`

export interface ShaderCanvasProps {
  color1?: THREE.ColorRepresentation
  color2?: THREE.ColorRepresentation
  cloudDensity?: number
  glowIntensity?: number
  rotationSpeed?: number
  /** World-space Y of sphere center. More negative = lower on screen. */
  offsetY?: number
  className?: string
}

const ShaderCanvas: React.FC<ShaderCanvasProps> = React.memo(
  ({
    color1 = '#5B21B6',
    color2 = '#F0ABFC',
    cloudDensity = 2.8,
    glowIntensity = 1.85,
    rotationSpeed = 0.08,
    offsetY = -0.55,
    className,
  }) => {
    const mountRef = React.useRef<HTMLDivElement>(null)
    const offsetYRef = React.useRef(offsetY)
    offsetYRef.current = offsetY
    const rotationSpeedRef = React.useRef(rotationSpeed)
    rotationSpeedRef.current = rotationSpeed

    React.useEffect(() => {
      const container = mountRef.current
      if (!container) return

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
      // Fixed forward view — do NOT lookAt the sphere or lowering is cancelled
      camera.position.set(0, 0, 3.2)
      camera.lookAt(0, 0, 0)

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      })
      renderer.setClearColor(0x0a0a0a, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.NoToneMapping
      const canvas = renderer.domElement
      canvas.style.display = 'block'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      container.appendChild(canvas)

      const uniforms = {
        u_time: { value: 0 },
        u_color1: { value: new THREE.Color(color1) },
        u_color2: { value: new THREE.Color(color2) },
        u_cloud_density: { value: cloudDensity },
        u_glow_intensity: { value: glowIntensity },
      }

      const geo = new THREE.SphereGeometry(1.35, 96, 96)
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
      })
      const sphere = new THREE.Mesh(geo, mat)
      sphere.position.set(0.2, offsetYRef.current, 0)
      scene.add(sphere)

      let raf = 0
      let running = true
      const t0 = performance.now()
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const resize = () => {
        const w = container.clientWidth || window.innerWidth
        const h = container.clientHeight || window.innerHeight
        camera.aspect = w / Math.max(h, 1)
        camera.updateProjectionMatrix()
        renderer.setSize(w, h, false)
      }

      let last = performance.now()
      const loop = (now: number) => {
        if (!running) return
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        sphere.position.y = offsetYRef.current
        if (!document.hidden) {
          if (!reducedMotion) {
            const elapsed = (now - t0) / 1000
            sphere.rotation.y += dt * rotationSpeedRef.current
            sphere.rotation.x = Math.sin(elapsed * 0.15) * 0.08
            uniforms.u_time.value = elapsed
          }
          renderer.render(scene, camera)
        }
        raf = requestAnimationFrame(loop)
      }

      resize()
      window.addEventListener('resize', resize)
      raf = requestAnimationFrame(loop)

      return () => {
        running = false
        cancelAnimationFrame(raf)
        window.removeEventListener('resize', resize)
        geo.dispose()
        mat.dispose()
        renderer.dispose()
        if (container.contains(canvas)) container.removeChild(canvas)
      }
    }, [color1, color2, cloudDensity, glowIntensity])

    return (
      <div
        ref={mountRef}
        aria-hidden
        className={className}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'none',
          zIndex: 0,
          background: '#0A0A0A',
        }}
      />
    )
  },
)

ShaderCanvas.displayName = 'ShaderCanvas'

export default ShaderCanvas
