// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // TSX/TS를 JS보다 우선해서 해석
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
    // (선택) src 경로별 별칭을 쓰고 있으면 여기에 맞춰주세요
    alias: {
      '@': path.resolve(__dirname, 'src'), // monorepo면 'apps/student/src'로 조정
    },
  },
});
