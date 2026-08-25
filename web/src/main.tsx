import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Bundle the terminal font: relying on device font stacks caused
// measure-vs-render drift on some Androids (right-edge glyph clipping).
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import App from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
