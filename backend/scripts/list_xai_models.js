async function listXAIModels() {
  const apiKey = process.env.XAI_API_KEY || process.env.GROQ_API_KEY || "";
  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error fetching xAI models:', error);
  }
}
listXAIModels();
