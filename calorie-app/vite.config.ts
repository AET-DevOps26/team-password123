import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const authTarget = env.VITE_AUTH_API_URL ?? 'http://localhost:8081'
  const mealsTarget = env.VITE_MEALS_API_URL ?? 'http://localhost:8082'
  const analyticsTarget = env.VITE_ANALYTICS_API_URL ?? 'http://localhost:8083'

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        // Route API groups to the matching backend service during local development.
        '/api/auth': {
          target: authTarget,
          changeOrigin: true,
        },
        '/api/users': {
          target: authTarget,
          changeOrigin: true,
        },
        '/api/meals': {
          target: mealsTarget,
          changeOrigin: true,
        },
        '/api/analytics': {
          target: analyticsTarget,
          changeOrigin: true,
        },
        '/api/goals': {
          target: analyticsTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
