'use client'

import * as React from 'react'
import { GlassGradeDashboard } from '@/components/ui/dashboard-with-collapsible-sidebar'

function useFonts() {
  React.useEffect(() => {
    const id = 'geist-fonts'
    if (document.getElementById(id)) return
    const l = document.createElement('link')
    l.id = id
    l.rel = 'stylesheet'
    l.href =
      'https://fonts.googleapis.com/css2?family=Geist:wght@200;300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap'
    document.head.appendChild(l)
  }, [])
}

export default function App() {
  useFonts()
  return <GlassGradeDashboard />
}
