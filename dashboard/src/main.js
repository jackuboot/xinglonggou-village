import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import '@/core/styles/base.css'

createApp(App).use(router).mount('#app')
