import { useState, type ReactNode } from 'react';

import type { TxPayload } from '../../core/schema';
import './styles.css';

type Step = 'review' | 'verify' | 'decision' | 'approved' | 'rejected';
const steps = ['Review transaction', 'Verify on phone', 'Make a decision'];
const presets: { name: string; note: string; payload: TxPayload }[] = [
  { name: 'Everyday payment', note: 'A small XRP Testnet payment with a destination tag.', payload: { v: 1, net: 'testnet', from: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', to: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe', amt: '25000000', dt: 1042 } },
  { name: 'Large payment', note: 'Review a larger XRP Testnet amount before making a decision.', payload: { v: 1, net: 'testnet', from: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', to: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe', amt: '1250500000', dt: 1042 } },
  { name: 'No destination tag', note: 'See how a Testnet payment without a tag is displayed.', payload: { v: 1, net: 'testnet', from: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', to: 'rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe', amt: '750000', } },
];

function amount(drops: string) {
  const value = BigInt(drops);
  const fraction = (value % 1000000n).toString().padStart(6, '0').replace(/0+$/, '');
  return BigInt(value / 1000000n).toLocaleString('en-US') + (fraction ? `.${fraction}` : '');
}

export function WalletDevice({ payload, qrCode }: { payload: TxPayload; qrCode?: ReactNode }) {
  const [step, setStep] = useState<Step>('review');
  const index = step === 'review' ? 0 : step === 'verify' ? 1 : 2;
  const finished = step === 'approved' || step === 'rejected';
  return <>
    <div className="progress" aria-label="Transaction progress">{steps.map((label, i) => <div key={label} className={i === index ? 'active' : i < index ? 'complete' : ''} aria-current={i === index ? 'step' : undefined}><span>{i < index ? '✓' : `0${i + 1}`}</span>{label}</div>)}</div>
    <div className="device-stage">
      <div className="device">
        <div className="device-top"><span className="device-brand">LEDGER<span> / DEMO</span></span><span className="connection"><i /> XRP app</span></div>
        <div className="screen" aria-live="polite">
          <div className="screen-bar"><span>glassGrade</span><span>{finished ? 'COMPLETE' : `0${index + 1} / 03`}</span></div>
          {step === 'review' && <div className="screen-content"><div className="screen-icon">↗</div><h2>Review transaction</h2><p className="screen-subtitle">Send XRP · {payload.net}</p><div className="amount">{amount(payload.amt)} <span>XRP</span></div><div className="screen-field"><span>To</span><strong title={payload.to}>{payload.to.slice(0, 9)}…{payload.to.slice(-7)}</strong></div><div className="screen-field"><span>Destination tag</span><strong>{payload.dt ?? 'Not provided'}</strong></div><button className="screen-primary" onClick={() => setStep('verify')}>Continue <span>→</span></button></div>}
          {step === 'verify' && <div className="screen-content verify"><h2>Verify on phone</h2><p className="screen-subtitle">Pause here to check this payment.</p><div className="qr-slot">{qrCode ?? <div className="qr-placeholder" role="img" aria-label="QR code placeholder, not scannable"><span>▦</span><strong>QR CODE</strong><small>Placeholder</small></div>}</div><p className="qr-note">The transaction analysis QR will appear here.</p><button className="screen-primary" onClick={() => setStep('decision')}>Continue to decision <span>→</span></button><button className="screen-back" onClick={() => setStep('review')}>← Back to transaction</button></div>}
          {step === 'decision' && <div className="screen-content"><div className="screen-icon">◇</div><h2>Confirm payment</h2><p className="screen-subtitle">Make your choice on the device.</p><div className="amount">{amount(payload.amt)} <span>XRP</span></div><p className="decision-note">Only approve after reviewing the amount and recipient.</p><button className="screen-primary" onClick={() => setStep('approved')}>✓ Approve payment</button><button className="reject" onClick={() => setStep('rejected')}>× Reject payment</button><button className="screen-back" onClick={() => setStep('verify')}>← Back to verification</button></div>}
          {finished && <div className={`screen-content result ${step}`}><div className="screen-icon">{step === 'approved' ? '✓' : '×'}</div><h2>Payment {step}</h2><p>{step === 'approved' ? 'You approved this demo transaction.' : 'You rejected this demo transaction.'}</p><div className="result-note">Simulation complete.<br />No transaction was signed or sent.</div><button className="screen-primary" onClick={() => setStep('review')}>Review again <span>↻</span></button></div>}
        </div>
        <div className="device-bottom"><span className="device-mark">[ L ]</span><span>YOUR KEYS. YOUR CALL.</span><span className="port" /></div>
      </div>
      <div className="device-caption"><span /> Interactive hardware wallet mock · No device required</div>
    </div>
  </>;
}

export function WalletDemo() {
  const [selected, setSelected] = useState(0);
  const [run, setRun] = useState(0);
  const scenario = presets[selected];
  return <div className="app-shell">
    <header><a className="wordmark" href="#/" aria-label="glassGrade home"><span className="logo">g</span>glass<span>Grade</span></a><span className="demo-badge"><i /> INTERACTIVE DEMO</span><span className="header-note">Built for the moment before you sign.</span></header>
    <main><section className="intro"><div className="eyebrow">THE WALLET EXPERIENCE</div><h1>A little pause.<br /><span>A better decision.</span></h1><p>Walk through an XRP Testnet payment from the hardware wallet’s perspective. Review the details, verify on your phone, then decide.</p><div className="demo-notice"><span>ⓘ</span><p>This is a demonstration mock. It does not connect to a wallet or sign transactions.</p></div>
      <div className="scenario-panel"><label htmlFor="scenario">YOUR DEMO TRANSACTION</label><select id="scenario" value={selected} onChange={e => { setSelected(Number(e.target.value)); setRun(n => n + 1); }}>{presets.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</select><p>{scenario.note}</p><dl><div><dt>Amount</dt><dd>{amount(scenario.payload.amt)} XRP</dd></div><div><dt>Network</dt><dd>XRPL Testnet <span className="muted">· preview only</span></dd></div><div className="address-row"><dt>Recipient</dt><dd>{scenario.payload.to}</dd></div></dl><button className="restart" onClick={() => setRun(n => n + 1)}>↻ Restart walkthrough</button></div>
    </section><section className="walkthrough" aria-label="Hardware wallet walkthrough"><WalletDevice key={run} payload={scenario.payload} /></section></main>
    <footer><span>glassGrade <span className="footer-divider">/</span> XRPL Commons Hackathon</span><span>Review. Verify. Decide.</span></footer>
  </div>;
}
