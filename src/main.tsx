import React from 'react';
import { createRoot } from 'react-dom/client';
import { WalletDemo } from './ui/emulator';
import './ui/emulator/styles.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><WalletDemo /></React.StrictMode>);
