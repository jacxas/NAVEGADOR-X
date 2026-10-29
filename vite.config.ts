import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  return {
    // Base relativa: el mismo build sirve para GitHub Pages (/NAVEGADOR-X/),
    // para el servidor Express (/) y para el shell de escritorio (app://bundle/).
    base: './',
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          // Las dependencias van a trozos propios: el navegador las cachea por
          // separado y el trozo principal deja de rozar el límite de 500 kB.
          // Se usa una función porque el formato de objeto no siempre separa
          // bien los paquetes que la entrada importa de forma estática.
          manualChunks(id: string) {
            const modulePath = id.replace(/\\/g, '/');
            if (!modulePath.includes('node_modules')) return undefined;
            if (modulePath.includes('/firebase/') || modulePath.includes('/@firebase/')) return 'firebase';
            if (modulePath.includes('/recharts/') || modulePath.includes('/d3-')) return 'charts';
            if (modulePath.includes('/motion') || modulePath.includes('/framer-motion')) return 'motion';
            if (modulePath.includes('/lucide-react/')) return 'icons';
            if (
              modulePath.includes('/react-dom/') ||
              modulePath.includes('/react/') ||
              modulePath.includes('/scheduler/')
            ) {
              return 'react';
            }
            return 'vendor';
          },
        },
      },
      // El paquete principal se queda por debajo del aviso por defecto; el límite
      // se deja alto solo para el trozo de Firebase, que es intrínsecamente grande.
      chunkSizeWarningLimit: 700,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      // El servidor de desarrollo se puede abrir a través de un proxy con dominio
      // propio (un túnel o la vista previa del entorno de trabajo). Sin esta lista,
      // Vite responde 403 «Blocked request. This host is not allowed».
      allowedHosts: ['.e2b.app', 'localhost', '127.0.0.1'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
