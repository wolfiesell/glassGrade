'use client'

import * as React from 'react'
import { SafetyBento } from '@/components/ui/safety-bento'
import { mockReport } from '@/data/mockRecipient'

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

  return (
    <div className="min-h-screen w-full bg-black px-5 py-8 sm:px-8 sm:py-10">
      <SafetyBento
        className="mx-auto max-w-[1320px]"
        report={mockReport}
        title="glassgrade"
        subtitle="Opened from Ledger · XRPL clear-sign review"
      />
    </div>
  )
}
