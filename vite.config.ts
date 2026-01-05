
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente baseadas no modo (ex: .env, .env.production)
  // O terceiro parâmetro '' permite carregar todas as vars, não apenas as que começam com VITE_
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    define: {
      // Isso substitui 'process.env.API_KEY' pelo valor real durante o build.
      // O '|| ""' garante que não seja inserido 'undefined' no código final.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY || ""),
      // Isso previne o erro "process is not defined" no navegador
      'process.env': {}
    }
  }
})