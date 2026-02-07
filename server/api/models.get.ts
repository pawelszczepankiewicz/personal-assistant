export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const baseUrl = config.lmStudioBaseUrl

  try {
    const response = await fetch(`${baseUrl}/v1/models`)

    if (!response.ok) {
      throw createError({
        statusCode: response.status,
        statusMessage: 'Failed to fetch models from LM Studio',
      })
    }

    return await response.json()
  } catch (error: any) {
    if (error.statusCode) throw error
    throw createError({
      statusCode: 502,
      statusMessage: 'Cannot connect to LM Studio. Is it running?',
    })
  }
})
