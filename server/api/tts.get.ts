export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const ttsUrl = config.ttsServerUrl
  const query = getQuery(event)

  if (!query.text) {
    throw createError({ statusCode: 400, statusMessage: 'Missing required parameter: text' })
  }

  const params = new URLSearchParams()
  params.set('text', String(query.text))
  if (query.voice) params.set('voice', String(query.voice))

  let upstream: Response
  try {
    upstream = await fetch(`${ttsUrl}/api/tts/stream?${params}`)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Cannot connect to TTS server. Is it running?',
    })
  }

  if (!upstream.ok) {
    const text = await upstream.text()
    throw createError({
      statusCode: upstream.status,
      statusMessage: text || 'TTS server returned an error',
    })
  }

  // Stream raw PCM back to the client
  setResponseHeader(event, 'Content-Type', 'audio/pcm')
  setResponseHeader(event, 'X-Sample-Rate', '24000')
  setResponseHeader(event, 'X-Channels', '1')
  setResponseHeader(event, 'X-Bit-Depth', '16')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseStatus(event, 200)

  const reader = upstream.body!.getReader()
  const res = event.node.res

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(value)
    }
  } catch {
    // Client disconnected
  } finally {
    res.end()
  }

  event._handled = true
})
