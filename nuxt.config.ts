// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  vite: {
    plugins: [tailwindcss()],
  },
  css: ["./app/tailwind.css"],
  devtools: { enabled: true },
  modules: ['@nuxt/icon', '@nuxt/eslint', '@nuxt/hints']
})
