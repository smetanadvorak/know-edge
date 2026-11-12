// usage (repo root):
//   npm run dev:web    -> local dev server
//   npm run build:web  -> static build into packages/web/dist (deployed to cloudflare workers, see wrangler.jsonc)
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
  // relative base so the app works from any path
  base: './',
  plugins: [svelte()],
});
