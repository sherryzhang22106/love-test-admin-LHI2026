import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './admin/AdminApp';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<AdminApp />);
