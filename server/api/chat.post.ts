export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const baseUrl = config.lmStudioBaseUrl
  const body = await readBody(event)

  if (!body.model || !body.input) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: model, input',
    })
  }

  const payload: Record<string, unknown> = {
    model: body.model,
    input: body.input,
    stream: true,
    temperature: body.temperature ?? 0.7,
  }

  if (body.system_prompt) {
    payload.system_prompt = body.system_prompt
  }

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/api/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Cannot connect to LM Studio. Is it running?',
    })
  }

  if (!upstream.ok) {
    const text = await upstream.text()
    throw createError({
      statusCode: upstream.status,
      statusMessage: text || 'LM Studio returned an error',
    })
  }

  setResponseHeader(event, 'Content-Type', 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', 'no-cache')
  setResponseHeader(event, 'Connection', 'keep-alive')
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
    // Client disconnected or upstream error
  } finally {
    res.end()
  }

  event._handled = true
})
