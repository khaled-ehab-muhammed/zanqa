import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built site works on any static host / sub-path (hash routing is used).
export default defineConfig({ base: './', plugins: [react()] });
