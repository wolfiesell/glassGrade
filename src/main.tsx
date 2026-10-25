import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { WalletDemo } from './ui/emulator'
import { QrTransactionReview } from './components/qr-transaction-review'

function Root() {
  const [hash, setHash] = useState(() => window.location.hash)

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (window.location.pathname === '/verify.html') {
    return <QrTransactionReview />
  }

  // Ledger-style emulator mock from main
  if (hash.startsWith('#/wallet') || hash.startsWith('#/device')) {
    return <WalletDemo />
  }

  // GlassGrade safety dashboard (frontend)
  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
