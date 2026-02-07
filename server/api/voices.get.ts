export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const ttsUrl = config.ttsServerUrl

  try {
    const response = await fetch(`${ttsUrl}/api/voices`)
    if (!response.ok) {
      throw createError({ statusCode: response.status, statusMessage: 'Failed to fetch voices' })
    }
    return await response.json()
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 502,
      statusMessage: 'Cannot connect to TTS server. Is it running?',
    })
  }
})
