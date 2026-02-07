// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  ssr: false,
  css: ["~/assets/css/main.css"],
  runtimeConfig: {
    lmStudioBaseUrl: "http://127.0.0.1:1234",
    ttsServerUrl: "http://127.0.0.1:8008",
  },
});
