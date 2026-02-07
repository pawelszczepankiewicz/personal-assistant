<script setup lang="ts">
import { marked } from 'marked'
import type { ChatMessage } from '~/composables/useChat'

const props = defineProps<{
  message: ChatMessage
  isSpeaking?: boolean
  ttsSupported?: boolean
}>()

const emit = defineEmits<{
  speak: [content: string]
  'stop-speaking': []
}>()

marked.setOptions({ breaks: true, gfm: true })

const renderedContent = computed(() => {
  if (props.message.role === 'user') return props.message.content
  return marked.parse(props.message.content) as string
})

const isUser = computed(() => props.message.role === 'user')
</script>

<template>
  <div class="chat-message" :class="{ 'is-user': isUser, 'is-assistant': !isUser }">
    <div class="message-header">
      <span class="message-role">{{ isUser ? 'You' : 'Assistant' }}</span>
      <button
        v-if="!isUser && ttsSupported && message.content"
        class="speak-button"
        :title="isSpeaking ? 'Stop speaking' : 'Read aloud'"
        @click="isSpeaking ? emit('stop-speaking') : emit('speak', message.content)"
      >
        <svg v-if="!isSpeaking" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="4" height="16"/>
          <rect x="14" y="4" width="4" height="16"/>
        </svg>
      </button>
    </div>
    <div v-if="isUser" class="message-content">{{ renderedContent }}</div>
    <div v-else class="message-content markdown-body" v-html="renderedContent" />
  </div>
</template>

<style scoped>
.chat-message {
  display: flex;
  flex-direction: column;
  padding: 1rem 1.25rem;
  border-radius: 12px;
  max-width: 85%;
}

.chat-message.is-user {
  align-self: flex-end;
  background: var(--user-bubble-bg);
}

.chat-message.is-assistant {
  align-self: flex-start;
  background: var(--assistant-bubble-bg);
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.message-role {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.7;
}

.speak-button {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: color 0.15s ease;
}

.speak-button:hover {
  color: var(--text-primary);
}

.message-content {
  line-height: 1.6;
  word-wrap: break-word;
}

.markdown-body :deep(p) {
  margin: 0 0 0.75rem 0;
}

.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(pre) {
  background: var(--code-bg);
  padding: 0.75rem 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.markdown-body :deep(code) {
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.875em;
}

.markdown-body :deep(:not(pre) > code) {
  background: var(--code-bg);
  padding: 0.15em 0.4em;
  border-radius: 4px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.5rem;
  margin: 0.5rem 0;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--accent-color);
  margin: 0.75rem 0;
  padding-left: 1rem;
  opacity: 0.85;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  margin: 1rem 0 0.5rem 0;
}

.markdown-body :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 0.75rem 0;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--border-color);
  padding: 0.5rem 0.75rem;
  text-align: left;
}
</style>
