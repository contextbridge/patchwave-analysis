import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { embeddedReportData } from '../testFactories.ts';
import { App } from './App.tsx';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('missing #root element');
}

createRoot(container).render(
  <StrictMode>
    <App data={embeddedReportData.build()} />
  </StrictMode>,
);
