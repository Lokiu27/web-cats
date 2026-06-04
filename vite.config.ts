import { defineConfig } from 'vite';

export default defineConfig({
  base: '/web-cats/',
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
});
