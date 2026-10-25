# Wallet emulator
Ledger-style demonstration mock; never connects, signs, or broadcasts.
WalletDemo offers transaction presets and renders an interactive review flow.
Review → phone verification placeholder → decision → approved/rejected result.
Presets are illustrative UI inputs, not captured ledger facts or risk assessments.
The QR placeholder deliberately contains no scannable payload.
Device takes the canonical TxPayload shape; a real QR can be passed via qrCode.
