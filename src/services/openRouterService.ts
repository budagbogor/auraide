export interface OpenRouterModel {
  id: string;
  name: string;
  context_length?: number;
}

export const FREE_MODELS: OpenRouterModel[] = [
  { id: "auto-free", name: "Smart Auto-Select (Free)" },
  { id: "google/gemini-2.0-flash-lite-preview-02-05:free", name: "Gemini 2.0 Flash Lite (Free)" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free)" },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)" },
  { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B (Free)" },
  { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B (Free)" },
  { id: "google/gemini-2.0-pro-exp-02-05:free", name: "Gemini 2.0 Pro Exp (Free)" },
];

export async function fetchFreeModels(): Promise<OpenRouterModel[]> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models");
    if (!response.ok) throw new Error("Failed to fetch models");
    const data = await response.json();
    
    // Filter for free models and sort by context length (descending)
    const freeModels = data.data
      .filter((m: any) => m.pricing.prompt === "0" && m.pricing.completion === "0")
      .map((m: any) => ({
        id: m.id,
        name: m.name,
        context_length: m.context_length
      }))
      .sort((a: any, b: any) => (b.context_length || 0) - (a.context_length || 0));
      
    return freeModels.length > 0 ? freeModels : FREE_MODELS.slice(1);
  } catch (error) {
    console.error("Error fetching models:", error);
    return FREE_MODELS.slice(1);
  }
}

export async function generateOpenRouterContent(model: string, prompt: string, apiKey: string, attachments: any[] = []) {
  let targetModel = model;
  
  if (model === "auto-free") {
    const models = await fetchFreeModels();
    targetModel = models[0].id;
  }

  const contentParts: any[] = [{ type: "text", text: prompt }];
  
  // Add image attachments for multimodal support
  attachments.forEach(file => {
    if (file.type.startsWith('image/')) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: file.data // base64 data URL
        }
      });
    } else {
      // For non-image files, we append content to the prompt in App.tsx
      // but we could also handle it here if we wanted.
    }
  });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": window.location.origin,
      "X-Title": "Aura AI IDE",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        { role: "user", content: contentParts }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "OpenRouter API error");
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
