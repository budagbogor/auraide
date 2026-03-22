import { getGeminiAI } from '../geminiService';
import { buildProjectContextPrompt } from '../context/fileContext';

export const COMPOSER_SYSTEM_PROMPT = `You are an Elite 10x Full-Stack Software Engineer from the Google DeepMind/Antigravity team. 
Your goal is to provide code that is ACCURATE, CLEAN, STABLE, POWERFUL, and EXTREMELY FAST.

TERMINAL CAPABILITIES:
- You CAN execute terminal commands directly on the user's machine.
- To execute a command (e.g., npm install, git init, npm run dev), use the format:
\`\`\`command:your-command-here
\`\`\`
- IMPORTANT: Commands MUST be complete and valid. Never stop at "npm".
- DIRECTORY AWARENESS: If you create files in a subfolder (e.g., "frontend/src"), you MUST "cd" into that folder before running npm commands.
- Example: \`\`\`command:cd frontend && npm install && npm run dev\`\`\`
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

const DOMAIN_EXPERTISE: Record<string, string> = {
  'Full Stack': `SKILL [FULL STACK ARCHITECT]:
Create professional enterprise-grade applications.
- Structure: Clear separation of /frontend and /backend or /src folders.
- Standards: API-first, responsive UI, database migrations, package.json with scripts.
- Output: Complete boilerplate and necessary config files.`,

  'Frontend': `SKILL [FRONTEND UI/UX EXPERT]:
Focus on visual excellence and premium user experience.
- Design: Modern aesthetics (Glassmorphism, Tailwind, Motion).
- Standards: Atomic design, reusable components, Lucide icons, responsive layouts.
- Output: Polished React/Next.js components and global CSS.`,

  'Backend': `SKILL [BACKEND ARCHITECT]:
Focus on robust, scalable, and secure server-side logic.
- Structure: Modular routes, controllers, and service layers (Node.js/Express).
- Standards: Error handling, logging, validation, security headers.
- Output: API routes, database schemas, and middleware.`,

  'Mobile App': `SKILL [MOBILE APP EXPERT - Capacitor]:
Develop hybrid cross-platform mobile apps for Android & iOS.
- Structure: Capacitor integration, mobile-first components.
- Standards: Touch-friendly UI, npx cap commands for sync/build.
- Files: capacitor.config.ts, icons, mobile-specific layouts.`,

  'Tauri Desktop': `SKILL [TAURI DESKTOP EXPERT]:
Build native lightweight desktop apps using Rust & Web technologies.
- Structure: src-tauri for Rust logic, frontend in React.
- Standards: Security-first, native window APIs, tauri.conf.json tuning.
- Files: src-tauri/Cargo.toml, tauri.conf.json, main context logic.`,

  'Chrome Extension': `SKILL [CHROME EXTENSION MASTER - Manifest V3]:
Construct powerful browser extensions with modern standards.
- Structure: background.ts, content scripts, popup, options.
- Standards: Manifest V3 compliant, permission management.
- Files: manifest.json, service-worker, icons layout.`,

  'Python Automation': `SKILL [PYTHON AUTOMATION SPECIALIST]:
Write high-performance automation scripts and tools.
- Standards: PEP8, clean error handling, modular scripts.
- Concept: efficient subprocess handling, web scraping, or data processing.
- Files: requirements.txt, .env templates, main script.`,

  'AI Integration': `SKILL [AI & LLM OPS SPECIALIST]:
Engineer state-of-the-art AI-powered applications.
- Concepts: RAG architecture, LLM orchestration, prompt templates.
- Standards: Token management, streaming logic, robust AI error fallbacks.
- Tools: LangChain ideas, VectorDB mental models, OpenAI/Gemini SDKs.`,

  'Game Dev': `SKILL [GAME DEVELOPMENT EXPERT]:
Harness Canvas and Logic for high-performance web games.
- Standards: High FPS game loop, collision detection, state machines.
- Concepts: Sprite management, keyboard/touch controls, math-heavy logic.
- Output: Canvas 2D/3D (Three.js) logic and game assets structure.`
};

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
  const categorySkill = DOMAIN_EXPERTISE[category] || '';

  const completePrompt = `
${COMPOSER_SYSTEM_PROMPT}

${categorySkill ? ` \n### APPLIED SKILL CONTEXT:\n${categorySkill}\n` : ''}
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
    const content = await generateBytezContent(model, completePrompt, apiKey, '');
    yield content;
  } else {
    // OpenAI-Compatible SSE Stream for OpenRouter & SumoPod
    const baseUrl = provider === 'openrouter' 
      ? 'https://openrouter.ai/api/v1/chat/completions' 
      : 'https://ai.sumopod.com/v1/chat/completions';
    
    let targetModel = model;
    if (provider === 'openrouter' && model === 'auto-free') {
      targetModel = 'google/gemini-2.0-flash-lite-preview-02-05:free';
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
