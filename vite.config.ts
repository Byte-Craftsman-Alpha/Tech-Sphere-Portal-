import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}
  return { 
    plugins,
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000', // Explicitly use IPv4 to avoid ECONNREFUSED
          changeOrigin: true,
          secure: false,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
          // Ensure we don't drop headers
          configure: (proxy: any, _options: any) => {
            proxy.on('error', (err: any, _req: any, _res: any) => {
              console.log('proxy error', err);
            });
          }
        }
      }
    }
  };
})
