<template>
  <div id="app">
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>

<script setup>
useSeoMeta({
  titleTemplate: "Personal Assistant",
  ogSiteName: "Personal Assistant",
  twitterCard: "summary_large_image",
});
</script>

<style>
#app {
  height: 100vh;
  overflow: hidden;
}
</style>
