import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { readEmbeddedData } from './data/readEmbeddedData.ts';
import './styles.css';

const data = readEmbeddedData();
const container = document.getElementById('root');
if (!container) {
  throw new Error('missing #root element');
}
createRoot(container).render(
  <StrictMode>
    <App data={data} />
  </StrictMode>,
);
