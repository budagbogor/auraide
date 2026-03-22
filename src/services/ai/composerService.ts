import { getGeminiAI } from '../geminiService';
import { buildProjectContextPrompt } from '../context/fileContext';

export const COMPOSER_SYSTEM_PROMPT = `You are an Elite 10x Full-Stack Software Engineer from the Google DeepMind/Antigravity team. 
Your goal is to provide code that is ACCURATE, CLEAN, STABLE, POWERFUL, and EXTREMELY FAST.

TERMINAL CAPABILITIES:
- You CAN execute terminal commands directly on the user's machine.
- To execute a command (e.g., npm install, git init, npm run dev), use the format:
\`\`\`command:your-command-here
\`\`\`
- Use this when the user asks to install dependencies, initialize a repo, or run a project.

CODING STANDARDS (GOOGLE ECOSYSTEM STYLE):
1. **Accuracy**: Every line of code must be functional and bug-free. Deeply understand the current context before generating.
2. **Clean Code**: Follow SOLID principles, DRY, and KISS. Use descriptive naming and modular architecture.
3. **Stability**: Anticipate edge cases. Add error handling where necessary. Ensure the app doesn't crash.
4. **Performance**: Write optimized code. Avoid unnecessary re-renders in React. Use efficient algorithms.
5. **Modern Tech Stack**: Default to modern web standards (ES6+, TypeScript, Functional Components, etc.).

STRICT OUTPUT RULES:
- ALWAYS provide the COMPLETE file content for any modified or new file. Never use placeholders like "// ... unchanged code ...".
- Use the exact markdown format for files: \`\`\`file:path/to/file.ext [newline] [CONTENT] [newline] \`\`\`
- If a file needs to be deleted, use: \`\`\`delete:path/to/file.ext\`\`\`
- For TERMINAL COMMANDS, use: \`\`\`command:npm install\`\`\`
- Briefly explain YOUR ARCHITECTURAL DECISION before providing the code or command blocks.
- Respond in Indonesian (Bahasa Indonesia) as per User Global Rule.

Focus on being the fastest and most reliable AI coding assistant in the world.`;

export async function* generateComposerStream(
  provider: string,
  apiKey: string, 
  model: string, 
  userPrompt: string, 
  filesContext: any[],
  category: string = 'Auto',
  activeFileId?: string,
  projectTree?: string
) {
  const filesContextStr = buildProjectContextPrompt(filesContext, activeFileId, projectTree);
  
  let categorySkill = '';
  if (category === 'Full Stack') {
    categorySkill = `SKILL [FULL STACK SCAFFOLDING - SuperClaude Framework]:
Act as a Senior Full Stack Engineer. When asked to create an app, you MUST generate the full directory structure (e.g., frontend and backend folders, src, components, api, package.json, etc.).
Output EACH file using the markdown format strictly:
\`\`\`file:path/to/file.ext
[File Content Here...]
\`\`\`
Do not just give explanations. Output the COMPLETE scaffolding ready to be executed.`;
  } else if (category === 'Frontend') {
    categorySkill = `SKILL [FRONTEND SCAFFOLDING - SuperClaude Framework]:
Act as a Senior Frontend UI/UX Engineer. Focus entirely on creating polished, modern, responsive UI components (React/Next.js/Tailwind). Generate the necessary folder structure (e.g., src/components, src/hooks, src/utils, etc.). Do not just return one file. Write out the structure using the strict file codeblocks.`;
  } else if (category === 'Backend') {
    categorySkill = `SKILL [BACKEND SCAFFOLDING - SuperClaude Framework]:
Act as a Senior Backend Systems Architect. Focus on creating robust APIs, database models, and service layers (Node.js/Python). Build the complete project folder tree (e.g., src/routes, src/controllers, src/models, src/config) utilizing the markdown file blocks.`;
  }

  const completePrompt = `
${COMPOSER_SYSTEM_PROMPT}

${categorySkill ? `\n### APPLIED SKILL CONTEXT:\n${categorySkill}\n` : ''}
${filesContextStr}

USER REQUEST:
${userPrompt}
  `;

  if (provider === 'gemini') {
    const ai = getGeminiAI(apiKey);
    const result = await ai.models.generateContentStream({
      model: model || "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: completePrompt }] }],
    });

    for await (const chunk of result) {
      const text = chunk.text;
      if (text) yield text;
    }
  } else if (provider === 'bytez') {
    const { generateBytezContent } = await import('../bytezService');
    // Assuming pass empty string for googleKey right now since usually we only use one API Key for Bytez
    const content = await generateBytezContent(model, completePrompt, apiKey, '');
    yield content;
  } else {
    // OpenAI-Compatible SSE Stream for OpenRouter & SumoPod
    const baseUrl = provider === 'openrouter' 
      ? 'https://openrouter.ai/api/v1/chat/completions' 
      : 'https://ai.sumopod.com/v1/chat/completions';
    
    // Auto-resolve OpenRouter auto-free logic if needed
    let targetModel = model;
    if (provider === 'openrouter' && model === 'auto-free') {
      targetModel = 'google/gemini-2.0-flash-lite-preview-02-05:free'; // fallback default free
    }

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window?.location?.origin || "http://localhost:3000",
        "X-Title": "Aura AI IDE",
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: "user", content: completePrompt }],
        stream: true
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || "API Streaming Error");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) throw new Error("Failed to get response reader");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices?.[0]?.delta?.content) {
              yield data.choices[0].delta.content;
            }
          } catch (e) {
            // ignore JSON parse error on partial stream
          }
        }
      }
    }
  }
}

export function parseComposerResponse(fullResponse: string) {
  const files: { path: string; action: 'create_or_modify' | 'delete'; content: string }[] = [];
  
  // Regex to match our custom markdown format: ```file:path/to/file.ext \n content \n ```
  const blockRegex = /\`\`\`(file|delete):([^\n]+)\n([\s\S]*?)\`\`\`/g;
  
  let match;
  while ((match = blockRegex.exec(fullResponse)) !== null) {
    const actionType = match[1] === 'delete' ? 'delete' : 'create_or_modify';
    const filePath = match[2].trim();
    const content = match[3].trim();
    files.push({ path: filePath, action: actionType, content });
  }

  return files;
}
