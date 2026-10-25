'use client'

import ShaderCanvas from '@/components/ui/celestial-sphere-shader'

/** Full-bleed celestial sphere background (purple / magenta nebula). */
export function CrystalBallBackground() {
  return (
    <ShaderCanvas
      key="celestial-drop-mid"
      color1="#5B21B6"
      color2="#F0ABFC"
      cloudDensity={2.8}
      glowIntensity={1.85}
      rotationSpeed={0.08}
      offsetY={-0.55}
    />
  )
}

export default CrystalBallBackground
