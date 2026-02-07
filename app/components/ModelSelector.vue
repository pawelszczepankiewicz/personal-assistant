<script setup lang="ts">
const model = defineModel<string>({ required: true });

const { data, error, status } = useFetch("/api/models");

watch(
  data,
  (val) => {
    if (val?.data?.length && !model.value) {
      model.value = val.data[1].id;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div class="model-selector">
    <label for="model-select">Model:</label>
    <select id="model-select" v-model="model" :disabled="status === 'pending'">
      <option v-if="status === 'pending'" value="" disabled>Loading...</option>
      <option v-if="error" value="" disabled>Failed to load</option>
      <option v-for="m in data?.data ?? []" :key="m.id" :value="m.id">
        {{ m.id }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.model-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.model-selector label {
  color: var(--text-secondary);
  font-size: 0.875rem;
  font-weight: 500;
}

.model-selector select {
  background: var(--surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  min-width: 200px;
}

.model-selector select:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-glow);
}
</style>
