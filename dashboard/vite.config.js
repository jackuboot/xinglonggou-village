import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * base 按环境区分：
 * - dev（serve）：'/'，本地直接访问 http://localhost:5173/
 * - build：'/app/'，线上部署在静态托管的 /app/ 子路径下，与官网完全分离
 */
export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // '@' 指向 src：跨区引用（core/gateway/apps）统一用 '@/...' 写 import，
  // 文件位置调整不影响 import 路径，分区边界在代码中一目了然
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  base: command === 'serve' ? '/' : '/app/',
  server: { port: 5173 },
  build: { outDir: 'dist' }
}))
