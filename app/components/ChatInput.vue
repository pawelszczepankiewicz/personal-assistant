<script setup lang="ts">
const emit = defineEmits<{
  send: [content: string];
}>();

const props = defineProps<{
  disabled?: boolean;
  isListening?: boolean;
  sttSupported?: boolean;
}>();

const input = defineModel<string>("inputText", { default: "" });
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function handleSend() {
  const trimmed = input.value.trim();
  if (!trimmed || props.disabled) return;
  emit("send", trimmed);
  input.value = "";
  nextTick(() => textareaRef.value?.focus());
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <div class="chat-input">
    <button
      v-if="sttSupported"
      class="mic-button"
      :class="{ recording: isListening }"
      :disabled="disabled"
      @click="$emit('toggle-mic')"
      :title="isListening ? 'Stop recording' : 'Start voice input'"
    >
      <svg
        v-if="!isListening"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" x2="12" y1="19" y2="22" />
      </svg>
      <svg
        v-else
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="6" y="6" width="12" height="12" rx="2" />
      </svg>
    </button>
    <textarea
      ref="textareaRef"
      v-model="input"
      :placeholder="isListening ? 'Listening...' : 'Type a message...'"
      rows="1"
      @keydown="handleKeydown"
    />
    <button
      class="send-button"
      :disabled="disabled || !input.trim()"
      @click="handleSend"
    >
      Send
    </button>
  </div>
</template>

<style scoped>
.chat-input {
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
  padding: 1rem 1.25rem;
  background: var(--surface-base);
  border-top: 1px solid var(--border-color);
  border-radius: 8px;
}

.mic-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--surface-elevated);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.mic-button:hover:not(:disabled) {
  color: var(--text-primary);
  border-color: var(--text-secondary);
}

.mic-button.recording {
  background: #7f1d1d;
  border-color: #ef4444;
  color: #ef4444;
  animation: pulse-red 1.5s infinite;
}

.mic-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@keyframes pulse-red {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
  }
}

.chat-input textarea {
  flex: 1;
  resize: none;
  background: var(--surface-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.9375rem;
  font-family: inherit;
  line-height: 1.5;
  min-height: 44px;
  max-height: 200px;
  overflow-y: auto;
  field-sizing: content;
}

.chat-input textarea::placeholder {
  color: var(--text-muted);
}

.chat-input textarea:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px var(--accent-glow);
}

.send-button {
  background: var(--accent-color);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0.75rem 1.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease;
}

.send-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
