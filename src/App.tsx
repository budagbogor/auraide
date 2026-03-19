/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { 
  FileCode, 
  Search, 
  MessageSquare, 
  Settings, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  X, 
  Terminal, 
  Play,
  Cpu,
  Sparkles,
  Send,
  User,
  Bot,
  FolderOpen,
  Save,
  Github,
  Download,
  ExternalLink,
  Paperclip,
  Image as ImageIcon,
  File as FileIcon,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  RefreshCw,
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Maximize2,
  Layout,
  Eye,
  EyeOff,
  Folder
} from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ai } from './services/geminiService';
import { FREE_MODELS, generateOpenRouterContent, fetchFreeModels, type OpenRouterModel } from './services/openRouterService';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

import { SUPER_CLAUDE_SKILLS, SUPER_CLAUDE_COMMANDS, type SuperClaudeSkill } from './constants/superClaude';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface FileItem {
  id: string;
  name: string;
  content: string;
  language: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CodeProblem {
  line: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([
    { id: '1', name: 'App.tsx', content: '// Welcome to Aura IDE\nexport default function App() {\n  return <div>Hello World</div>;\n}', language: 'typescript' },
    { id: '2', name: 'index.css', content: 'body { background: #1e1e1e; }', language: 'css' },
  ]);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [commandInput, setCommandInput] = useState('');
  const [fileSearchInput, setFileSearchInput] = useState('');
  const [activeFileId, setActiveFileId] = useState<string>('1');
  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowCommandPalette(true);
      } else if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setShowFileSearch(true);
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        setTerminalOutput(prev => [...prev, `[SYSTEM] File saved: ${activeFile.name}`]);
      } else if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowFileSearch(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'search' | 'ai' | 'github' | 'settings' | 'browser'>('files');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Welcome to **Aura AI IDE**. I am your coding assistant. How can I help you today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>(['Aura Terminal v1.0.0', 'Ready for input...']);
  const [githubConnected, setGithubConnected] = useState(false);
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('aura_github_token') || '');
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(() => localStorage.getItem('aura_supabase_url') || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => localStorage.getItem('aura_supabase_key') || '');
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [mcpServers, setMcpServers] = useState<{ name: string; url: string; connected: boolean }[]>(() => {
    const saved = localStorage.getItem('aura_mcp_servers');
    return saved ? JSON.parse(saved) : [];
  });
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [openRouterModel, setOpenRouterModel] = useState('auto-free');
  const [dynamicFreeModels, setDynamicFreeModels] = useState<OpenRouterModel[]>(FREE_MODELS);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; type: string; data: string; content?: string }[]>([]);
  const [bottomTab, setBottomTab] = useState<'terminal' | 'problems' | 'output' | 'debug'>('terminal');
  const [problems, setProblems] = useState<CodeProblem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [aiRules, setAiRules] = useState<string>('');
  const [context7Mode, setContext7Mode] = useState(false);
  const [systemInstruction, setSystemInstruction] = useState<string>('You are an expert AI coding assistant.');
  const [selectedSkill, setSelectedSkill] = useState<string>('Default');
  const [browserUrl, setBrowserUrl] = useState<string>('https://www.google.com/search?igu=1');
  const [browserSrcDoc, setBrowserSrcDoc] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'classic' | 'modern'>('classic');
  const [zenMode, setZenMode] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'tsx':
      case 'ts': return <FileCode size={14} className="text-blue-400" />;
      case 'jsx':
      case 'js': return <FileCode size={14} className="text-yellow-400" />;
      case 'css': return <FileCode size={14} className="text-blue-500" />;
      case 'html': return <FileCode size={14} className="text-orange-500" />;
      case 'json': return <FileCode size={14} className="text-yellow-600" />;
      case 'md': return <FileCode size={14} className="text-white" />;
      default: return <FileIcon size={14} className="text-gray-400" />;
    }
  };

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, fileId: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileId });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    localStorage.setItem('aura_github_token', githubToken);
  }, [githubToken]);

  useEffect(() => {
    localStorage.setItem('aura_supabase_url', supabaseUrl);
    localStorage.setItem('aura_supabase_key', supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    localStorage.setItem('aura_mcp_servers', JSON.stringify(mcpServers));
  }, [mcpServers]);

  useEffect(() => {
    if (aiProvider === 'openrouter') {
      refreshModels();
    }
  }, [aiProvider]);

  const refreshModels = async () => {
    setIsFetchingModels(true);
    try {
      const models = await fetchFreeModels();
      // Keep "Smart Auto-Select" at the top
      setDynamicFreeModels([FREE_MODELS[0], ...models.filter(m => m.id !== 'auto-free')]);
    } catch (error) {
      console.error('Failed to refresh models:', error);
    } finally {
      setIsFetchingModels(false);
    }
  };

  const relayout = (preset: 'default' | 'zen' | 'modern') => {
    if (preset === 'default') {
      setLayoutMode('classic');
      setZenMode(false);
      setShowBrowser(false);
    } else if (preset === 'zen') {
      setZenMode(true);
    } else if (preset === 'modern') {
      setLayoutMode('modern');
      setZenMode(false);
    }
    setTerminalOutput(prev => [...prev, `Layout switched to ${preset} mode.`]);
  };

  const scanForProblems = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setBottomTab('problems');
    setProblems([]);
    
    // Simulate local scanning first for speed
    const localProblems: CodeProblem[] = [];
    const lines = activeFile.content.split('\n');
    
    lines.forEach((line, index) => {
      // Simple regex checks
      if (line.includes('console.log')) {
        localProblems.push({ line: index + 1, severity: 'info', message: 'Consider removing console.log for production.' });
      }
      if (line.includes('any') && activeFile.language === 'typescript') {
        localProblems.push({ line: index + 1, severity: 'warning', message: 'Avoid using "any" type in TypeScript.' });
      }
      if (line.match(/var\s+/)) {
        localProblems.push({ line: index + 1, severity: 'warning', message: 'Use "let" or "const" instead of "var".' });
      }
      if (line.match(/==\s+/) && !line.includes('===')) {
        localProblems.push({ line: index + 1, severity: 'warning', message: 'Use strict equality (===) instead of (==).' });
      }
    });

    setProblems(localProblems);

    // Then use AI for deeper analysis if requested or as a second pass
    try {
      const currentSkill = SUPER_CLAUDE_SKILLS.find(s => s.name === selectedSkill);
      const skillInstruction = currentSkill ? currentSkill.instruction : '';
      
      const prompt = `System Instruction: ${systemInstruction}
      ${skillInstruction ? `\nSkill Focus: ${skillInstruction}` : ''}
      ${aiRules ? `\nUser Rules: ${aiRules}` : ''}
      
      Analyze the following code for potential errors, bugs, or improvements. 
      Return the results ONLY as a JSON array of objects with this structure: 
      [{"line": number, "severity": "error" | "warning" | "info", "message": "string"}]
      
      Code to analyze (${activeFile.name}):
      ${activeFile.content}`;

      let resultText = '';
      if (aiProvider === 'gemini') {
        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        resultText = response.text || '[]';
      } else {
        const apiKey = process.env.OPENROUTER_API_KEY || '';
        resultText = await generateOpenRouterContent(openRouterModel, prompt, apiKey);
      }

      const jsonMatch = resultText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const aiProblems = JSON.parse(jsonMatch[0]);
        setProblems(prev => [...prev, ...aiProblems]);
        setTerminalOutput(prev => [...prev, `Scan complete: Found ${localProblems.length + aiProblems.length} potential issues.`]);
      }
    } catch (error) {
      console.error('AI Scan Error:', error);
      setTerminalOutput(prev => [...prev, `AI Scan failed, showing local results only.`]);
    } finally {
      setIsScanning(false);
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: value } : f));
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() && attachedFiles.length === 0 || isAiLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAiLoading(true);

    try {
      let content = '';
      const currentSkill = SUPER_CLAUDE_SKILLS.find(s => s.name === selectedSkill);
      const skillInstruction = currentSkill ? currentSkill.instruction : '';
      
      // Check for commands in input
      let activeCommandInstruction = '';
      const command = SUPER_CLAUDE_COMMANDS.find(c => chatInput.trim().startsWith(c.command));
      if (command) {
        activeCommandInstruction = `\nActive Command: ${command.instruction}`;
      }

      // Context7 (Deep Context)
      let deepContext = '';
      if (context7Mode) {
        deepContext = `\n\n[DEEP CONTEXT - CONTEXT7 MODE]
Project Files: ${files.map(f => f.name).join(', ')}
Active File: ${activeFile.name}
Integrations:
- GitHub: ${githubConnected ? 'Connected' : 'Disconnected'}
- Supabase: ${supabaseConnected ? 'Connected' : 'Disconnected'}
- MCP Servers: ${mcpServers.filter(s => s.connected).map(s => s.name).join(', ') || 'None'}
`;
      }

      let prompt = `System Instruction: ${systemInstruction}
            ${skillInstruction ? `\nSkill Focus: ${skillInstruction}` : ''}
            ${aiRules ? `\nUser Rules: ${aiRules}` : ''}
            ${activeCommandInstruction}
            ${deepContext}
            
            Current File: ${activeFile.name} (${activeFile.language})
            Content:
            ${activeFile.content}
            
            User Request:
            ${userMsg.content}`;

      // Append text file contents to prompt
      attachedFiles.forEach(file => {
        if (!file.type.startsWith('image/')) {
          prompt += `\n\n--- Attached File: ${file.name} ---\n${file.content || 'No content'}`;
        }
      });

      if (aiProvider === 'gemini') {
        const parts: any[] = [{ text: prompt }];
        
        // Add image parts for Gemini
        attachedFiles.forEach(file => {
          if (file.type.startsWith('image/')) {
            const base64Data = file.data.split(',')[1];
            parts.push({
              inlineData: {
                data: base64Data,
                mimeType: file.type
              }
            });
          }
        });

        const response = await ai.models.generateContent({
          model: selectedModel,
          contents: [
            {
              role: "user",
              parts: parts,
            },
          ],
        });
        content = response.text || 'Sorry, I couldn\'t generate a response.';
      } else {
        const apiKey = process.env.OPENROUTER_API_KEY || '';
        if (!apiKey) throw new Error('OpenRouter API Key is missing in secrets.');
        content = await generateOpenRouterContent(openRouterModel, prompt, apiKey, attachedFiles);
      }

      const assistantMsg: ChatMessage = { role: 'assistant', content: content };
      setChatMessages(prev => [...prev, assistantMsg]);
      setAttachedFiles([]); // Clear attachments after sending
    } catch (error: any) {
      console.error('AI Error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.message || 'Failed to connect to AI service.'}` }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = event.target?.result as string;
        if (file.type.startsWith('image/')) {
          setAttachedFiles(prev => [...prev, { name: file.name, type: file.type, data }]);
        } else {
          // For text files, read as text too
          const textReader = new FileReader();
          textReader.onload = (textEvent) => {
            const content = textEvent.target?.result as string;
            setAttachedFiles(prev => [...prev, { name: file.name, type: file.type, data, content }]);
          };
          textReader.readAsText(file);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const createNewFile = () => {
    const newFile: FileItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: `new-file-${files.length + 1}.ts`,
      content: '',
      language: 'typescript'
    };
    setFiles([...files, newFile]);
    setActiveFileId(newFile.id);
  };

  const openFolder = async () => {
    try {
      // @ts-ignore - File System Access API
      const dirHandle = await window.showDirectoryPicker();
      const newFiles: FileItem[] = [];
      
      async function scan(handle: any) {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            const content = await file.text();
            const ext = file.name.split('.').pop();
            newFiles.push({
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              content: content,
              language: ext === 'ts' || ext === 'tsx' ? 'typescript' : ext === 'js' || ext === 'jsx' ? 'javascript' : ext || 'plaintext'
            });
          }
        }
      }
      
      await scan(dirHandle);
      if (newFiles.length > 0) {
        setFiles(newFiles);
        setActiveFileId(newFiles[0].id);
        setTerminalOutput(prev => [...prev, `Opened folder: ${dirHandle.name}`, `Loaded ${newFiles.length} files.`]);
      }
    } catch (err) {
      console.error('Error opening folder:', err);
      setTerminalOutput(prev => [...prev, 'Error: Could not open local folder. (Browser may block this in iframes)']);
    }
  };

  const exportProject = async () => {
    const zip = new JSZip();
    files.forEach(file => {
      zip.file(file.name, file.content);
    });
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'aura-project.zip');
    setTerminalOutput(prev => [...prev, 'Project exported as aura-project.zip']);
  };

  const [terminalInput, setTerminalInput] = useState('');

  const handleTerminalCommand = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const val = terminalInput.trim();
      if (!val) return;
      
      setTerminalOutput(prev => [...prev, `aura-project $ ${val}`]);
      
      const cmd = val.toLowerCase();
      if (cmd === 'clear') {
        setTerminalOutput([]);
      } else if (cmd === 'ls') {
        setTerminalOutput(prev => [...prev, files.map(f => f.name).join('  ')]);
      } else if (cmd === 'help') {
        setTerminalOutput(prev => [...prev, 'Available commands: clear, ls, help, scan, build, date, aura --version, whoami, neofetch, git status, git branch, npm start, npm build']);
      } else if (cmd === 'scan') {
        scanForProblems();
      } else if (cmd === 'date') {
        setTerminalOutput(prev => [...prev, new Date().toLocaleString()]);
      } else if (cmd === 'build') {
        setTerminalOutput(prev => [...prev, 'Building project... [####################] 100%', 'Build successful!']);
      } else if (cmd === 'aura --version') {
        setTerminalOutput(prev => [...prev, 'Aura IDE v2.5.0 (Enterprise Edition)']);
      } else if (cmd === 'whoami') {
        setTerminalOutput(prev => [...prev, 'aura-developer']);
      } else if (cmd === 'neofetch') {
        setTerminalOutput(prev => [...prev, 
          '      .---.      OS: AuraOS 2.5.0',
          '     /     \\     Host: Aura Virtual Machine',
          '    | () () |    Kernel: 5.15.0-aura',
          '     \\  ^  /     Uptime: 12 hours, 34 mins',
          '      |||||      Packages: 1337 (npm)',
          '      |||||      Shell: aura-shell 1.0',
          '                 Resolution: 1920x1080',
          '                 DE: Aura Desktop',
          '                 WM: Aura Window Manager',
          '                 CPU: Aura Virtual CPU (8) @ 3.200GHz',
          '                 GPU: Aura Virtual GPU',
          '                 Memory: 4096MiB / 8192MiB'
        ]);
      } else if (cmd === 'git status') {
        setTerminalOutput(prev => [...prev, 'On branch main', 'Your branch is up to date with \'origin/main\'.', 'nothing to commit, working tree clean']);
      } else if (cmd === 'git branch') {
        setTerminalOutput(prev => [...prev, '* main', '  feature/ai-chat', '  bugfix/terminal-scroll']);
      } else if (cmd === 'npm start') {
        setTerminalOutput(prev => [...prev, '> aura-project@1.0.0 start', '> vite', '', '  VITE v4.4.9  ready in 123 ms', '', '  ➜  Local:   http://localhost:3000/', '  ➜  Network: use --host to expose']);
      } else if (cmd === 'npm build') {
        setTerminalOutput(prev => [...prev, '> aura-project@1.0.0 build', '> tsc && vite build', '', 'vite v4.4.9 building for production...', 'transforming...', '✓ 123 modules transformed.', 'rendering chunks...', 'dist/index.html                  0.45 kB', 'dist/assets/index-12345678.js    123.45 kB │ gzip: 45.67 kB', 'dist/assets/index-12345678.css   12.34 kB │ gzip: 3.45 kB', '✓ built in 1.23s']);
      } else {
        setTerminalOutput(prev => [...prev, `Command not found: ${val}`]);
      }
      
      setTerminalInput('');
    }
  };

  const renderBottomPanel = () => {
    switch (bottomTab) {
      case 'terminal':
        return (
          <div className="flex-1 flex flex-col font-mono text-[13px] p-2 overflow-hidden bg-black/40">
            <div className="flex-1 overflow-y-auto custom-scrollbar mb-2 space-y-1">
              <div className="text-emerald-400 font-bold">Welcome to Aura Terminal v2.5.0</div>
              <div className="text-gray-500 italic">Type 'help' to see available commands.</div>
              {terminalOutput.map((line, i) => (
                <div key={i} className="flex gap-2">
                  {line.startsWith('aura-project $') ? (
                    <div className="flex gap-2">
                      <span className="text-emerald-500">➜</span>
                      <span className="text-blue-400 font-bold">aura-project</span>
                      <span className="text-gray-500">$</span>
                      <span className="text-white">{line.replace('aura-project $', '').trim()}</span>
                    </div>
                  ) : (
                    <div className={cn(line.startsWith('Command not found') ? "text-red-400" : "text-[#cccccc]")}>{line}</div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-white border-t border-white/5 pt-2">
              <span className="text-emerald-500">➜</span>
              <span className="text-blue-400 font-bold">aura-project</span>
              <span className="text-gray-500">$</span>
              <input 
                type="text" 
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={handleTerminalCommand}
                className="flex-1 bg-transparent border-none outline-none text-white"
                autoFocus
              />
            </div>
          </div>
        );
      case 'problems':
        return (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {problems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#858585] gap-2">
                <CheckCircle size={32} className="text-emerald-500 opacity-20" />
                <span className="text-xs italic">No problems have been detected in the workspace.</span>
              </div>
            ) : (
              problems.map((prob, i) => (
                <div key={i} className="flex items-start gap-3 p-1.5 hover:bg-white/5 rounded cursor-pointer group transition-colors">
                  <div className="mt-0.5">
                    {prob.severity === 'error' && <AlertCircle size={14} className="text-red-500" />}
                    {prob.severity === 'warning' && <AlertTriangle size={14} className="text-yellow-500" />}
                    {prob.severity === 'info' && <Info size={14} className="text-blue-500" />}
                  </div>
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#cccccc] group-hover:text-white transition-colors">{prob.message}</span>
                      <span className="text-[10px] text-[#858585] group-hover:text-gray-300 transition-colors">Line {prob.line}</span>
                    </div>
                    <span className="text-[10px] text-[#858585]">{activeFile.name}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      case 'output':
        return (
          <div className="flex-1 font-mono text-[12px] p-4 text-gray-400 overflow-y-auto">
            [info] [2026-03-19 11:38:33] Starting Aura Language Server...
            <br />
            [info] [2026-03-19 11:38:34] Indexing workspace: aura-project
            <br />
            [info] [2026-03-19 11:38:35] Language server ready.
            <br />
            [info] [2026-03-19 11:38:40] File changed: src/App.tsx
            <br />
            [info] [2026-03-19 11:38:41] Re-indexing...
          </div>
        );
      case 'debug':
        return (
          <div className="flex-1 flex flex-col items-center justify-center text-[#858585] gap-3">
            <Terminal size={40} className="opacity-10" />
            <div className="text-center">
              <p className="text-[14px]">Debug Console is empty</p>
              <p className="text-[12px] opacity-60">Start debugging to see output here.</p>
            </div>
            <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-[12px] transition-colors">
              Launch Debugger
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className={cn(
        "flex h-screen w-full bg-[#1e1e1e] text-[#cccccc] select-none font-sans transition-all duration-300",
        layoutMode === 'modern' ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-[200] w-48 glass-card rounded-lg shadow-2xl p-1"
          >
            <div 
              onClick={() => {
                const file = files.find(f => f.id === contextMenu.fileId);
                if (file) {
                  const newName = prompt('Rename file:', file.name);
                  if (newName) setFiles(prev => prev.map(f => f.id === file.id ? { ...f, name: newName } : f));
                }
              }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-white/10 rounded cursor-pointer text-[12px]"
            >
              <RefreshCw size={12} /> Rename
            </div>
            <div 
              onClick={() => {
                if (files.length > 1) {
                  setFiles(prev => prev.filter(f => f.id !== contextMenu.fileId));
                  if (activeFileId === contextMenu.fileId) setActiveFileId(files[0].id);
                }
              }}
              className="flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 text-red-400 rounded cursor-pointer text-[12px]"
            >
              <X size={12} /> Delete
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <AnimatePresence>
        {showCommandPalette && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
            onClick={() => setShowCommandPalette(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -20 }}
              className="w-full max-w-2xl glass-card rounded-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <ChevronRight size={18} className="text-blue-500" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Type a command or search..."
                  className="bg-transparent border-none outline-none text-white text-lg w-full"
                  value={commandInput}
                  onChange={e => setCommandInput(e.target.value)}
                />
              </div>
              <div className="max-h-[400px] overflow-y-auto p-2">
                {[
                  { icon: <Layout size={16} />, label: 'Relayout: Default', action: () => relayout('default') },
                  { icon: <Layout size={16} />, label: 'Relayout: Modern', action: () => relayout('modern') },
                  { icon: <Eye size={16} />, label: 'Relayout: Zen', action: () => relayout('zen') },
                  { icon: <FileCode size={16} />, label: 'Create New File', action: createNewFile },
                  { icon: <FolderOpen size={16} />, label: 'Open Folder', action: openFolder },
                  { icon: <Download size={16} />, label: 'Export Project', action: exportProject },
                  { icon: <Layout size={16} />, label: 'Toggle Layout Mode', action: () => setLayoutMode(layoutMode === 'classic' ? 'modern' : 'classic') },
                  { icon: <Eye size={16} />, label: 'Toggle Zen Mode', action: () => setZenMode(!zenMode) },
                  { icon: <Sparkles size={16} />, label: 'Scan Code for Problems', action: scanForProblems },
                  { icon: <Terminal size={16} />, label: 'Clear Terminal', action: () => setTerminalOutput(['Terminal cleared.']) },
                ].filter(cmd => cmd.label.toLowerCase().includes(commandInput.toLowerCase())).map((cmd, i) => (
                  <div 
                    key={i}
                    onClick={() => {
                      cmd.action();
                      setShowCommandPalette(false);
                      setCommandInput('');
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-lg cursor-pointer transition-colors group"
                  >
                    <div className="text-[#858585] group-hover:text-blue-500 transition-colors">
                      {cmd.icon}
                    </div>
                    <span className="text-[14px]">{cmd.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Search */}
      <AnimatePresence>
        {showFileSearch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
            onClick={() => setShowFileSearch(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -20 }}
              className="w-full max-w-2xl glass-card rounded-xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <Search size={18} className="text-blue-500" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search files by name..."
                  className="bg-transparent border-none outline-none text-white text-lg w-full"
                  value={fileSearchInput}
                  onChange={e => setFileSearchInput(e.target.value)}
                />
              </div>
              <div className="max-h-[400px] overflow-y-auto p-2">
                {files.filter(f => f.name.toLowerCase().includes(fileSearchInput.toLowerCase())).map((file, i) => (
                  <div 
                    key={i}
                    onClick={() => {
                      setActiveFileId(file.id);
                      setShowFileSearch(false);
                      setFileSearchInput('');
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-lg cursor-pointer transition-colors group"
                  >
                    <FileCode size={16} className="text-blue-400" />
                    <div className="flex flex-col">
                      <span className="text-[14px]">{file.name}</span>
                      <span className="text-[10px] text-[#858585]">AURA-PROJECT</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Activity Bar */}
      {!zenMode && (
        <div className={cn(
          "w-14 bg-[#333333] flex flex-col items-center py-4 gap-4 z-50 glass-dark",
          layoutMode === 'modern' ? "border-l border-white/5" : "border-r border-white/5"
        )}>
          <div 
            onClick={() => setSidebarTab('files')}
            title="Explorer (Ctrl+Shift+E)"
            className={cn("p-2.5 cursor-pointer transition-all duration-200 rounded-xl group relative", sidebarTab === 'files' ? "text-white bg-blue-600/20 shadow-lg shadow-blue-500/10" : "text-[#858585] hover:text-white hover:bg-white/5")}
          >
            <FileCode size={24} className={cn("transition-transform duration-200", sidebarTab === 'files' && "scale-110")} />
            {sidebarTab === 'files' && <motion.div layoutId="activeTab" className="absolute left-[-12px] w-1 h-8 bg-blue-500 rounded-r-full" />}
          </div>
          <div 
            onClick={() => setSidebarTab('search')}
            title="Search (Ctrl+Shift+F)"
            className={cn("p-2.5 cursor-pointer transition-all duration-200 rounded-xl group relative", sidebarTab === 'search' ? "text-white bg-blue-600/20 shadow-lg shadow-blue-500/10" : "text-[#858585] hover:text-white hover:bg-white/5")}
          >
            <Search size={24} className={cn("transition-transform duration-200", sidebarTab === 'search' && "scale-110")} />
            {sidebarTab === 'search' && <motion.div layoutId="activeTab" className="absolute left-[-12px] w-1 h-8 bg-blue-500 rounded-r-full" />}
          </div>
          <div 
            onClick={() => setSidebarTab('ai')}
            title="Aura AI Chat (Ctrl+Shift+A)"
            className={cn("p-2.5 cursor-pointer transition-all duration-200 rounded-xl group relative", sidebarTab === 'ai' ? "text-white bg-blue-600/20 shadow-lg shadow-blue-500/10" : "text-[#858585] hover:text-white hover:bg-white/5")}
          >
            <Sparkles size={24} className={cn("transition-transform duration-200", sidebarTab === 'ai' && "scale-110")} />
            {sidebarTab === 'ai' && <motion.div layoutId="activeTab" className="absolute left-[-12px] w-1 h-8 bg-blue-500 rounded-r-full" />}
          </div>
          <div 
            onClick={() => setSidebarTab('github')}
            title="GitHub Integration"
            className={cn("p-2.5 cursor-pointer transition-all duration-200 rounded-xl group relative", sidebarTab === 'github' ? "text-white bg-blue-600/20 shadow-lg shadow-blue-500/10" : "text-[#858585] hover:text-white hover:bg-white/5")}
          >
            <Github size={24} className={cn("transition-transform duration-200", sidebarTab === 'github' && "scale-110")} />
            {sidebarTab === 'github' && <motion.div layoutId="activeTab" className="absolute left-[-12px] w-1 h-8 bg-blue-500 rounded-r-full" />}
          </div>
          <div 
            onClick={() => setSidebarTab('browser')}
            title="Internal Browser"
            className={cn("p-2.5 cursor-pointer transition-all duration-200 rounded-xl group relative", sidebarTab === 'browser' ? "text-white bg-blue-600/20 shadow-lg shadow-blue-500/10" : "text-[#858585] hover:text-white hover:bg-white/5")}
          >
            <Globe size={24} className={cn("transition-transform duration-200", sidebarTab === 'browser' && "scale-110")} />
            {sidebarTab === 'browser' && <motion.div layoutId="activeTab" className="absolute left-[-12px] w-1 h-8 bg-blue-500 rounded-r-full" />}
          </div>
          <div 
            onClick={() => setSidebarTab('settings')}
            title="Settings"
            className={cn("mt-auto p-2.5 cursor-pointer transition-all duration-200 rounded-xl group relative", sidebarTab === 'settings' ? "text-white bg-blue-600/20 shadow-lg shadow-blue-500/10" : "text-[#858585] hover:text-white hover:bg-white/5")}
          >
            <Settings size={24} className={cn("transition-transform duration-200", sidebarTab === 'settings' && "scale-110")} />
            {sidebarTab === 'settings' && <motion.div layoutId="activeTab" className="absolute left-[-12px] w-1 h-8 bg-blue-500 rounded-r-full" />}
          </div>
        </div>
      )}

      {/* Sidebar Content */}
      {!zenMode && (
        <motion.div 
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 280, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          className={cn(
            "w-[280px] bg-[#252526] flex flex-col overflow-hidden relative",
            layoutMode === 'modern' ? "border-l border-white/5" : "border-r border-white/5"
          )}
        >
          <div className="p-4 text-[11px] uppercase tracking-widest font-black text-[#bbbbbb] flex justify-between items-center border-b border-white/5 bg-[#252526]/50 backdrop-blur-sm sticky top-0 z-10">
            <span className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              {sidebarTab === 'files' && 'Explorer'}
              {sidebarTab === 'search' && 'Search'}
              {sidebarTab === 'ai' && 'Aura AI Chat'}
              {sidebarTab === 'github' && 'GitHub'}
              {sidebarTab === 'settings' && 'Settings'}
              {sidebarTab === 'browser' && 'Browser'}
            </span>
            <div className="flex gap-2.5">
              {sidebarTab === 'ai' && (
                <button onClick={() => setChatMessages([])} title="Clear Chat" className="hover:text-white transition-colors">
                  <RefreshCw size={14} />
                </button>
              )}
              {sidebarTab === 'files' && (
                <div className="flex gap-2.5">
                  <button onClick={createNewFile} title="New File" className="hover:text-white transition-colors">
                    <Plus size={14} />
                  </button>
                  <button onClick={openFolder} title="Open Folder" className="hover:text-white transition-colors">
                    <FolderOpen size={14} />
                  </button>
                  <button onClick={exportProject} title="Export Project" className="hover:text-white transition-colors">
                    <Download size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <AnimatePresence mode="wait">
              {sidebarTab === 'files' && (
                <motion.div 
                  key="files"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col"
                >
                  <div className="flex items-center gap-1 px-2 py-1 hover:bg-[#2a2d2e] cursor-pointer group">
                    <ChevronDown size={16} />
                    <span className="text-[13px] font-bold">AURA-PROJECT</span>
                  </div>
                    <div className="pl-4">
                      {files.map(file => (
                        <div 
                          key={file.id}
                          onClick={() => setActiveFileId(file.id)}
                          onContextMenu={(e) => handleContextMenu(e, file.id)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1 cursor-pointer text-[13px] transition-colors group relative",
                            activeFileId === file.id ? "bg-[#37373d] text-white" : "hover:bg-[#2a2d2e] text-[#cccccc]"
                          )}
                        >
                          {getFileIcon(file.name)}
                          <span className="truncate">{file.name}</span>
                          {activeFileId === file.id && <div className="absolute right-2 w-1 h-1 rounded-full bg-blue-500" />}
                        </div>
                      ))}
                    </div>
                </motion.div>
              )}

              {sidebarTab === 'search' && (
                <motion.div 
                  key="search"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 space-y-4"
                >
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585] group-focus-within:text-blue-500 transition-colors" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search files and content..."
                      value={fileSearchInput}
                      onChange={e => setFileSearchInput(e.target.value)}
                      className="w-full bg-[#3c3c3c] border border-white/5 rounded-md py-1.5 pl-9 pr-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all"
                    />
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-150px)] custom-scrollbar">
                    {fileSearchInput && files.filter(f => 
                      f.name.toLowerCase().includes(fileSearchInput.toLowerCase()) || 
                      f.content.toLowerCase().includes(fileSearchInput.toLowerCase())
                    ).map(file => (
                      <div 
                        key={file.id}
                        onClick={() => setActiveFileId(file.id)}
                        className="p-2 rounded hover:bg-[#37373d] cursor-pointer group transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <FileCode size={12} className="text-blue-400" />
                          <span className="text-[12px] font-medium text-[#cccccc] group-hover:text-white">{file.name}</span>
                        </div>
                        {file.content.toLowerCase().includes(fileSearchInput.toLowerCase()) && (
                          <div className="text-[10px] text-[#858585] line-clamp-2 font-mono bg-black/20 p-1 rounded">
                            {file.content.split('\n').find(line => line.toLowerCase().includes(fileSearchInput.toLowerCase()))?.trim()}
                          </div>
                        )}
                      </div>
                    ))}
                    {!fileSearchInput && (
                      <div className="text-center py-10 opacity-30">
                        <Search size={32} className="mx-auto mb-2" />
                        <p className="text-[11px]">Type to search across project</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {sidebarTab === 'ai' && (
                <motion.div 
                  key="ai"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col h-full"
                >
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                    {chatMessages.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                          <Sparkles size={24} className="text-white" />
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-white">Aura AI Assistant</p>
                          <p className="text-[11px]">How can I help you build today?</p>
                        </div>
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={cn(
                          "flex flex-col gap-1 max-w-[90%]",
                          msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div className={cn(
                          "px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-lg transition-all duration-300",
                          msg.role === 'user' 
                            ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-tr-none shadow-blue-500/10" 
                            : "bg-[#3c3c3c] text-[#cccccc] rounded-tl-none border border-white/5 shadow-black/20"
                        )}>
                          <div className="markdown-body prose prose-invert prose-sm max-w-none">
                            <Markdown
                              components={{
                                code({ node, inline, className, children, ...props }: any) {
                                  const match = /language-(\w+)/.exec(className || '');
                                  return !inline && match ? (
                                    <div className="relative group/code">
                                      <div className="absolute right-2 top-2 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(String(children).replace(/\n$/, ''));
                                            setTerminalOutput(prev => [...prev, 'Code copied to clipboard.']);
                                          }}
                                          className="p-1.5 bg-white/10 hover:bg-white/20 rounded-md text-white/70 hover:text-white transition-all backdrop-blur-md border border-white/10"
                                          title="Copy Code"
                                        >
                                          <Save size={14} />
                                        </button>
                                      </div>
                                      <pre className={className} {...props}>
                                        {children}
                                      </pre>
                                    </div>
                                  ) : (
                                    <code className={className} {...props}>
                                      {children}
                                    </code>
                                  );
                                }
                              }}
                            >
                              {msg.content}
                            </Markdown>
                          </div>
                        </div>
                        <span className="text-[10px] text-[#858585] px-1 uppercase tracking-widest font-bold flex items-center gap-1">
                          {msg.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                          {msg.role === 'user' ? 'You' : 'Aura AI'}
                        </span>
                      </motion.div>
                    ))}
                    {isAiLoading && (
                      <div className="flex items-center gap-2 text-[#858585] text-[11px] animate-pulse">
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        Aura is thinking...
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-white/5 bg-[#252526]/80 backdrop-blur-md">
                    {attachedFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {attachedFiles.map((file, i) => (
                          <div key={i} className="relative group">
                            <div className="flex items-center gap-2 bg-[#3c3c3c] border border-white/10 rounded-lg px-2 py-1 text-[10px] max-w-[100px] truncate">
                              {file.type.startsWith('image/') ? <ImageIcon size={10} /> : <FileIcon size={10} />}
                              {file.name}
                            </div>
                            <button 
                              onClick={() => removeAttachment(i)}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={8} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="relative">
                      <textarea 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Ask Aura anything..."
                        className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-3 pl-4 pr-12 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all resize-none min-h-[44px] max-h-32 custom-scrollbar"
                        rows={1}
                      />
                      <div className="absolute right-2 bottom-2 flex gap-1">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 text-[#858585] hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                          <Paperclip size={16} />
                        </button>
                        <button 
                          onClick={handleSendMessage}
                          disabled={isAiLoading || (!chatInput.trim() && attachedFiles.length === 0)}
                          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        multiple 
                        className="hidden" 
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {sidebarTab === 'github' && (
                <motion.div 
                  key="github"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="p-4 space-y-6"
                >
                  {!githubConnected ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center space-y-6">
                      <div className="w-16 h-16 rounded-3xl bg-[#333] flex items-center justify-center shadow-xl border border-white/5">
                        <Github size={32} className="text-white" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[14px] font-bold text-white">Connect GitHub</h3>
                        <p className="text-[11px] text-[#858585] max-w-[200px]">Sync your repositories and push code directly from Aura IDE.</p>
                      </div>
                      <div className="w-full space-y-3">
                        <input 
                          type="password" 
                          placeholder="Personal Access Token"
                          value={githubToken}
                          onChange={e => setGithubToken(e.target.value)}
                          className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[12px] focus:outline-none focus:border-blue-500/50 transition-all"
                        />
                        <button 
                          onClick={async () => {
                            if (!githubToken) return;
                            setIsFetchingRepos(true);
                            try {
                              const { fetchUserRepos } = await import('./services/githubService');
                              const repos = await fetchUserRepos(githubToken);
                              setGithubRepos(repos);
                              setGithubConnected(true);
                              setTerminalOutput(prev => [...prev, '[GITHUB] Connected successfully.']);
                            } catch (error) {
                              setTerminalOutput(prev => [...prev, `[GITHUB] Error: ${error instanceof Error ? error.message : 'Failed to connect'}`]);
                            } finally {
                              setIsFetchingRepos(false);
                            }
                          }}
                          disabled={isFetchingRepos}
                          className="w-full py-2.5 bg-white text-black rounded-xl text-[12px] font-bold hover:bg-[#eeeeee] transition-all flex items-center justify-center gap-2"
                        >
                          {isFetchingRepos ? <RefreshCw size={14} className="animate-spin" /> : <Github size={14} />}
                          {isFetchingRepos ? 'Connecting...' : 'Connect with Token'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[12px] font-bold text-white">Your Repositories</h3>
                        <button 
                          onClick={() => setGithubConnected(false)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          Disconnect
                        </button>
                      </div>
                      <div className="space-y-2">
                        {githubRepos.map(repo => (
                          <div 
                            key={repo.id}
                            className="p-3 bg-[#333333]/50 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[13px] font-medium text-white group-hover:text-blue-400 transition-colors">{repo.name}</span>
                              {repo.private && <span className="text-[9px] px-1.5 py-0.5 bg-white/5 rounded text-[#858585]">Private</span>}
                            </div>
                            <p className="text-[11px] text-[#858585] line-clamp-1">{repo.description || 'No description'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {sidebarTab === 'browser' && (
                <motion.div 
                  key="browser"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col h-full"
                >
                  <div className="p-4 space-y-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" size={14} />
                        <input 
                          type="text" 
                          value={browserUrl}
                          onChange={(e) => setBrowserUrl(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-[#3c3c3c] border border-white/5 rounded-lg py-1.5 pl-9 pr-3 text-[12px] focus:outline-none focus:border-blue-500/50 transition-all"
                        />
                      </div>
                      <button 
                        onClick={() => setBrowserSrcDoc(null)}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                    <button 
                      onClick={() => {
                        const htmlFile = files.find(f => f.name.endsWith('.html')) || { content: '<div id="root"></div>' };
                        const cssFiles = files.filter(f => f.name.endsWith('.css')).map(f => `<style>${f.content}</style>`).join('\n');
                        const jsFiles = files.filter(f => f.name.endsWith('.js') || f.name.endsWith('.ts') || f.name.endsWith('.tsx'))
                          .map(f => `<script type="module">${f.content}</script>`).join('\n');
                        
                        const doc = `
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <meta charset="UTF-8" />
                              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                              <script src="https://cdn.tailwindcss.com"></script>
                              ${cssFiles}
                            </head>
                            <body class="bg-white text-black">
                              ${htmlFile.content}
                              ${jsFiles}
                            </body>
                          </html>
                        `;
                        setBrowserSrcDoc(doc);
                        setShowBrowser(true);
                      }}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[13px] font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                    >
                      <Sparkles size={16} />
                      Preview Project
                    </button>
                  </div>
                  <div className="flex-1 bg-white rounded-t-2xl overflow-hidden mt-2 mx-2 border-x border-t border-white/10">
                    <iframe 
                      src={browserSrcDoc ? undefined : browserUrl}
                      srcDoc={browserSrcDoc || undefined}
                      className="w-full h-full"
                      title="Internal Browser"
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  </div>
                </motion.div>
              )}

              {sidebarTab === 'settings' && (
                <motion.div 
                  key="settings"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 space-y-8 custom-scrollbar"
                >
                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-500">Appearance</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-[#333333]/50 rounded-xl border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[13px] font-medium text-white">Layout Presets</p>
                          <p className="text-[11px] text-[#858585]">Quick switch layout modes</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => relayout('default')} className="px-2 py-1 bg-[#3c3c3c] rounded text-[10px] hover:bg-[#454545] transition-colors">Default</button>
                          <button onClick={() => relayout('modern')} className="px-2 py-1 bg-[#3c3c3c] rounded text-[10px] hover:bg-[#454545] transition-colors">Modern</button>
                          <button onClick={() => relayout('zen')} className="px-2 py-1 bg-[#3c3c3c] rounded text-[10px] hover:bg-[#454545] transition-colors">Zen</button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#333333]/50 rounded-xl border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[13px] font-medium text-white">Layout Mode</p>
                          <p className="text-[11px] text-[#858585]">Switch between classic and modern</p>
                        </div>
                        <button 
                          onClick={() => setLayoutMode(layoutMode === 'classic' ? 'modern' : 'classic')}
                          className="p-2 bg-[#3c3c3c] rounded-lg hover:bg-[#454545] transition-all"
                        >
                          <Layout size={18} className={cn(layoutMode === 'modern' ? "text-blue-500" : "text-[#858585]")} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-[#333333]/50 rounded-xl border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[13px] font-medium text-white">Zen Mode</p>
                          <p className="text-[11px] text-[#858585]">Focus on your code</p>
                        </div>
                        <button 
                          onClick={() => setZenMode(!zenMode)}
                          className="p-2 bg-[#3c3c3c] rounded-lg hover:bg-[#454545] transition-all"
                        >
                          <Eye size={18} className={cn(zenMode ? "text-blue-500" : "text-[#858585]")} />
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Project Info</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-[#333333]/50 rounded-xl border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[13px] font-medium text-white">Project Statistics</p>
                          <p className="text-[11px] text-[#858585]">{files.length} files · {files.reduce((acc, f) => acc + f.content.length, 0)} characters</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={exportProject} className="p-2 bg-[#3c3c3c] rounded-lg hover:bg-[#454545] transition-all text-blue-400" title="Export Project">
                            <Download size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-purple-500">AI Configuration</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[12px] text-[#858585] ml-1">AI Provider</label>
                        <select 
                          value={aiProvider}
                          onChange={(e) => setAiProvider(e.target.value as any)}
                          className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all"
                        >
                          <option value="gemini">Google Gemini</option>
                          <option value="openrouter">OpenRouter</option>
                        </select>
                      </div>

                      {aiProvider === 'gemini' ? (
                        <div className="space-y-2">
                          <label className="text-[12px] text-[#858585] ml-1">Gemini Model</label>
                          <select 
                            value={selectedModel}
                            onChange={(e) => setSelectedModel(e.target.value)}
                            className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all"
                          >
                            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                            <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro</option>
                            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center ml-1">
                            <label className="text-[12px] text-[#858585]">OpenRouter Model</label>
                            <button 
                              onClick={refreshModels}
                              disabled={isFetchingModels}
                              className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50"
                            >
                              {isFetchingModels ? 'Refreshing...' : 'Refresh'}
                            </button>
                          </div>
                          <select 
                            value={openRouterModel}
                            onChange={(e) => setOpenRouterModel(e.target.value)}
                            className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all"
                          >
                            {dynamicFreeModels.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[12px] text-[#858585] ml-1">System Instruction</label>
                        <textarea 
                          value={systemInstruction}
                          onChange={(e) => setSystemInstruction(e.target.value)}
                          className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all h-24 resize-none custom-scrollbar"
                          placeholder="You are a helpful assistant..."
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[12px] text-[#858585] ml-1">User Rules</label>
                        <textarea 
                          value={aiRules}
                          onChange={(e) => setAiRules(e.target.value)}
                          className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all h-24 resize-none custom-scrollbar"
                          placeholder="Always use TypeScript..."
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[12px] text-[#858585] ml-1">AI Skill</label>
                        <select 
                          value={selectedSkill}
                          onChange={(e) => setSelectedSkill(e.target.value)}
                          className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all"
                        >
                          <option value="Default">Default Assistant</option>
                          {SUPER_CLAUDE_SKILLS.map(skill => (
                            <option key={skill.name} value={skill.name}>{skill.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-[#333333]/50 rounded-xl border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-[13px] font-medium text-white">Context7 Mode</p>
                          <p className="text-[11px] text-[#858585]">Deep project context for AI</p>
                        </div>
                        <button 
                          onClick={() => setContext7Mode(!context7Mode)}
                          className={cn(
                            "w-10 h-5 rounded-full transition-all relative",
                            context7Mode ? "bg-blue-600" : "bg-[#3c3c3c]"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                            context7Mode ? "right-1" : "left-1"
                          )} />
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Environment</h3>
                    <div className="space-y-2">
                      <div className="p-3 bg-[#333333]/50 rounded-xl border border-white/5 flex items-center justify-between">
                        <span className="text-[12px] font-mono">GEMINI_KEY</span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full", process.env.GEMINI_API_KEY ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                          {process.env.GEMINI_API_KEY ? 'Active' : 'Missing'}
                        </span>
                      </div>
                      <div className="p-3 bg-[#333333]/50 rounded-xl border border-white/5 flex items-center justify-between">
                        <span className="text-[12px] font-mono">OPENROUTER_KEY</span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full", process.env.OPENROUTER_API_KEY ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
                          {process.env.OPENROUTER_API_KEY ? 'Active' : 'Missing'}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-orange-500">Supabase Integration</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[12px] text-[#858585] ml-1">Supabase URL</label>
                        <input 
                          type="text" 
                          value={supabaseUrl}
                          onChange={(e) => setSupabaseUrl(e.target.value)}
                          className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all"
                          placeholder="https://xyz.supabase.co"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[12px] text-[#858585] ml-1">Anon Key</label>
                        <input 
                          type="password" 
                          value={supabaseAnonKey}
                          onChange={(e) => setSupabaseAnonKey(e.target.value)}
                          className="w-full bg-[#3c3c3c] border border-white/5 rounded-xl py-2 px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-all"
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        />
                      </div>
                      <button 
                        onClick={async () => {
                          if (!supabaseUrl || !supabaseAnonKey) return;
                          try {
                            const { testSupabaseConnection } = await import('./services/supabaseService');
                            await testSupabaseConnection({ url: supabaseUrl, anonKey: supabaseAnonKey });
                            setSupabaseConnected(true);
                            setTerminalOutput(prev => [...prev, '[SUPABASE] Connected successfully.']);
                          } catch (error) {
                            setTerminalOutput(prev => [...prev, `[SUPABASE] Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
                            setSupabaseConnected(false);
                          }
                        }}
                        className={cn(
                          "w-full py-2.5 rounded-xl text-[12px] font-bold transition-all flex items-center justify-center gap-2",
                          supabaseConnected ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-blue-600 text-white hover:bg-blue-700"
                        )}
                      >
                        {supabaseConnected ? <CheckCircle size={14} /> : <RefreshCw size={14} />}
                        {supabaseConnected ? 'Connected' : 'Test Connection'}
                      </button>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-400">MCP (Model Context Protocol)</h3>
                    <div className="space-y-4">
                      <div className="p-3 bg-[#333333]/50 rounded-xl border border-white/5 space-y-3">
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            placeholder="Server Name (e.g. GitHub)"
                            value={newMcpName}
                            onChange={e => setNewMcpName(e.target.value)}
                            className="w-full bg-[#3c3c3c] border border-white/5 rounded-lg py-1.5 px-3 text-[12px] focus:outline-none focus:border-blue-500/50 transition-all"
                          />
                          <input 
                            type="text" 
                            placeholder="Server URL (SSE or WebSocket)"
                            value={newMcpUrl}
                            onChange={e => setNewMcpUrl(e.target.value)}
                            className="w-full bg-[#3c3c3c] border border-white/5 rounded-lg py-1.5 px-3 text-[12px] focus:outline-none focus:border-blue-500/50 transition-all"
                          />
                        </div>
                        <button 
                          onClick={() => {
                            if (!newMcpName || !newMcpUrl) return;
                            setMcpServers(prev => [...prev, { name: newMcpName, url: newMcpUrl, connected: false }]);
                            setNewMcpName('');
                            setNewMcpUrl('');
                          }}
                          className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 transition-all"
                        >
                          Add MCP Server
                        </button>
                      </div>

                      <div className="space-y-2">
                        {mcpServers.map((server, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-[#333333]/50 rounded-xl border border-white/5">
                            <div className="space-y-0.5">
                              <p className="text-[12px] font-medium text-white">{server.name}</p>
                              <p className="text-[10px] text-[#858585] truncate max-w-[150px]">{server.url}</p>
                            </div>
                            <button 
                              onClick={async () => {
                                try {
                                  const { mcpManager } = await import('./services/mcpService');
                                  await mcpManager.connect({ name: server.name, serverUrl: server.url });
                                  setMcpServers(prev => prev.map((s, i) => i === idx ? { ...s, connected: true } : s));
                                  setTerminalOutput(prev => [...prev, `[MCP] Connected to ${server.name}`]);
                                } catch (error) {
                                  setTerminalOutput(prev => [...prev, `[MCP] Failed to connect to ${server.name}`]);
                                }
                              }}
                              className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-bold transition-all",
                                server.connected ? "bg-emerald-500/10 text-emerald-500" : "bg-[#3c3c3c] text-white hover:bg-[#454545]"
                              )}
                            >
                              {server.connected ? 'Connected' : 'Connect'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor & Browser Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs & Actions */}
        <div className="h-9 bg-[#252526] flex items-center justify-between border-b border-white/5 pr-2">
          <div className="flex items-center overflow-x-auto flex-1 h-full scrollbar-hide">
            {files.map(file => (
              <div 
                key={file.id}
                onClick={() => setActiveFileId(file.id)}
                className={cn(
                  "h-full flex items-center gap-2 px-4 cursor-pointer text-[12px] border-r border-white/5 min-w-[140px] transition-all duration-200 group relative",
                  activeFileId === file.id ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-[#969696] hover:bg-[#1e1e1e] hover:text-[#cccccc]"
                )}
              >
                {getFileIcon(file.name)}
                <span className="truncate flex-1 font-medium">{file.name}</span>
                <X 
                  size={12} 
                  className="opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded p-0.5 transition-all" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (files.length > 1) {
                      setFiles(files.filter(f => f.id !== file.id));
                      if (activeFileId === file.id) setActiveFileId(files[0].id);
                    }
                  }} 
                />
                {activeFileId === file.id && <motion.div layoutId="activeTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-2">
            <button 
              onClick={() => {
                if (files.length > 1) {
                  setFiles([files[0]]);
                  setActiveFileId(files[0].id);
                }
              }}
              className="p-1.5 text-[#858585] hover:text-white hover:bg-white/5 rounded transition-colors"
              title="Close All Other Tabs"
            >
              <X size={14} />
            </button>
            <button 
              onClick={() => setShowBrowser(!showBrowser)}
              className={cn(
                "p-1.5 rounded transition-colors flex items-center gap-1.5 text-xs font-medium",
                showBrowser ? "bg-blue-600 text-white" : "text-[#858585] hover:text-white hover:bg-white/5"
              )}
              title="Toggle Internal Browser"
            >
              <Globe size={14} />
              <span>Browser</span>
            </button>
          </div>
        </div>

        {/* Editor & Browser Split View */}
        <div className="flex-1 flex min-h-0 relative">
          {files.length === 0 && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1e1e1e] text-center p-8 space-y-8">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/20 animate-pulse">
                <Sparkles size={48} className="text-white" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">Welcome to Aura IDE</h2>
                <p className="text-[#858585] max-w-md">The next generation AI-powered development environment. Start by creating a new file or opening a folder.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <button onClick={createNewFile} className="flex flex-col items-center gap-3 p-6 bg-[#252526] hover:bg-[#2d2d2d] rounded-2xl border border-white/5 transition-all group">
                  <Plus size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">New File</span>
                </button>
                <button onClick={openFolder} className="flex flex-col items-center gap-3 p-6 bg-[#252526] hover:bg-[#2d2d2d] rounded-2xl border border-white/5 transition-all group">
                  <FolderOpen size={24} className="text-purple-500 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium">Open Folder</span>
                </button>
              </div>
              <div className="flex gap-6 text-[11px] text-[#858585] font-mono uppercase tracking-widest">
                <div className="flex items-center gap-2"><kbd className="bg-[#333] px-1.5 py-0.5 rounded border border-white/10 text-white">Ctrl+P</kbd> Search Files</div>
                <div className="flex items-center gap-2"><kbd className="bg-[#333] px-1.5 py-0.5 rounded border border-white/10 text-white">Ctrl+Shift+P</kbd> Commands</div>
              </div>
            </div>
          )}
          
          {/* Editor Container */}
          <div className={cn(
            "flex flex-col min-w-0 transition-all duration-300",
            showBrowser ? "w-1/2" : "w-full"
          )}>
            {/* Breadcrumbs */}
            <div className="h-7 bg-[#1e1e1e] flex items-center px-4 gap-2 text-[11px] text-[#858585] border-b border-white/5">
              <Folder size={12} />
              <span>aura-project</span>
              <ChevronRight size={10} />
              {getFileIcon(activeFile.name)}
              <span className="text-[#cccccc] font-medium">{activeFile.name}</span>
            </div>
            <div className="flex-1 relative">
              <Editor
                height="100%"
                theme="vs-dark"
                language={activeFile.language}
                value={activeFile.content}
                onChange={handleEditorChange}
                options={{
                  fontSize: editorFontSize,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 20 },
                  fontFamily: 'JetBrains Mono, monospace',
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  smoothScrolling: true,
                  lineNumbersMinChars: 3,
                  glyphMargin: true,
                  folding: true,
                  bracketPairColorization: { enabled: true },
                  guides: { bracketPairs: true, indentation: true },
                }}
              />
            </div>
          </div>

          {/* Internal Browser Container */}
          {showBrowser && (
            <div className="w-1/2 flex flex-col bg-[#f3f3f3] border-l border-white/10">
              {/* Browser Header/Address Bar */}
              <div className="h-10 bg-[#e1e1e1] border-b border-[#ccc] flex items-center px-2 gap-2">
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-[#555] hover:bg-[#d0d0d0] rounded transition-colors"><ArrowLeft size={14} /></button>
                  <button className="p-1.5 text-[#555] hover:bg-[#d0d0d0] rounded transition-colors"><ArrowRight size={14} /></button>
                  <button 
                    onClick={() => {
                      const current = browserUrl;
                      setBrowserUrl('');
                      setTimeout(() => setBrowserUrl(current), 10);
                    }}
                    className="p-1.5 text-[#555] hover:bg-[#d0d0d0] rounded transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
                <div className="flex-1 flex items-center bg-white border border-[#ccc] rounded px-2 py-1 gap-2">
                  <Globe size={12} className="text-[#888]" />
                  <input 
                    type="text" 
                    value={browserSrcDoc ? 'Project Preview (Internal)' : browserUrl}
                    onChange={(e) => {
                      if (!browserSrcDoc) setBrowserUrl(e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setBrowserSrcDoc(null);
                      }
                    }}
                    className="flex-1 bg-transparent outline-none text-xs text-black"
                    placeholder="Enter URL..."
                  />
                  {browserSrcDoc && (
                    <button 
                      onClick={() => setBrowserSrcDoc(null)}
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      Clear Preview
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-[#555] hover:bg-[#d0d0d0] rounded transition-colors"><Maximize2 size={14} /></button>
                  <button 
                    onClick={() => setShowBrowser(false)}
                    className="p-1.5 text-[#555] hover:bg-[#d0d0d0] rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              
              {/* Browser Content */}
              <div className="flex-1 bg-white relative">
                <iframe 
                  src={browserSrcDoc ? undefined : browserUrl}
                  srcDoc={browserSrcDoc || undefined}
                  className="w-full h-full border-none"
                  title="Main Internal Browser"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Bottom Panel (Terminal & Problems) */}
        <div className="h-[250px] bg-[#1e1e1e] border-t border-white/10 flex flex-col relative">
          <div className="flex items-center gap-4 px-4 py-1 text-[11px] uppercase font-bold text-[#858585] border-b border-white/5">
            <span 
              onClick={() => setBottomTab('terminal')}
              className={cn("cursor-pointer py-1 transition-colors", bottomTab === 'terminal' ? "text-white border-b border-white" : "hover:text-white")}
            >
              Terminal
            </span>
            <span 
              onClick={() => setBottomTab('problems')}
              className={cn("cursor-pointer py-1 transition-colors flex items-center gap-1", bottomTab === 'problems' ? "text-white border-b border-white" : "hover:text-white")}
            >
              Problems {problems.length > 0 && <span className="bg-red-500 text-white rounded-full px-1 text-[9px]">{problems.length}</span>}
            </span>
            <span 
              onClick={() => setBottomTab('output')}
              className={cn("cursor-pointer py-1 transition-colors", bottomTab === 'output' ? "text-white border-b border-white" : "hover:text-white")}
            >
              Output
            </span>
            <span 
              onClick={() => setBottomTab('debug')}
              className={cn("cursor-pointer py-1 transition-colors", bottomTab === 'debug' ? "text-white border-b border-white" : "hover:text-white")}
            >
              Debug Console
            </span>
            
            <div className="ml-auto flex items-center gap-3">
              <button 
                onClick={scanForProblems}
                disabled={isScanning}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                title="Scan current file for problems"
              >
                <RefreshCw size={12} className={cn(isScanning && "animate-spin")} />
                <span className="text-[10px]">Scan Code</span>
              </button>
              <Play size={12} className="text-green-500 cursor-pointer" />
              <X size={12} className="cursor-pointer" />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto bg-black/20">
            {renderBottomPanel()}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 h-6 bg-[#007acc] text-white flex items-center px-3 text-[11px] gap-4 z-50 shadow-2xl backdrop-blur-md bg-opacity-90">
        <div className="flex items-center gap-1 hover:bg-white/10 px-2 h-full cursor-pointer transition-colors">
          <ChevronRight size={12} />
          <span className="font-medium">main*</span>
        </div>
        <div className="flex items-center gap-3 hover:bg-white/10 px-2 h-full cursor-pointer transition-colors">
          <div className="flex items-center gap-1">
            <X size={12} className="text-white/70" />
            <span>0</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertTriangle size={12} className="text-white/70" />
            <span>{problems.length}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center h-full">
          <div className="hover:bg-white/10 px-3 h-full flex items-center cursor-pointer transition-colors border-l border-white/10 text-white/70 italic">
            Ctrl+Shift+P for Commands
          </div>
          <div 
            onClick={() => setZenMode(!zenMode)}
            className={cn(
              "hover:bg-white/10 px-3 h-full flex items-center cursor-pointer transition-colors border-l border-white/10",
              zenMode && "bg-white/20 text-blue-200"
            )}
            title="Toggle Zen Mode"
          >
            {zenMode ? <EyeOff size={12} className="mr-1" /> : <Eye size={12} className="mr-1" />}
            Zen
          </div>
          <div className="hover:bg-white/10 px-3 h-full flex items-center cursor-pointer transition-colors border-l border-white/10">Spaces: 2</div>
          <div className="hover:bg-white/10 px-3 h-full flex items-center cursor-pointer transition-colors border-l border-white/10 uppercase tracking-tighter opacity-80">UTF-8</div>
          <div className="hover:bg-white/10 px-3 h-full flex items-center cursor-pointer transition-colors border-l border-white/10 font-bold uppercase tracking-widest text-[10px]">{activeFile.language}</div>
          <div className="flex items-center gap-2 hover:bg-white/10 px-3 h-full cursor-pointer transition-colors border-l border-white/10 bg-white/5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
            <span className="font-black tracking-tighter">AURA AI ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
