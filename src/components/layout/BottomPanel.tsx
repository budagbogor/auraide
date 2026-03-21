import React from 'react';
import { Terminal, Plus, X, AlertCircle, AlertTriangle, Info, CheckCircle, RefreshCw, Play } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FileItem } from '@/types';

interface BottomPanelProps {
  zenMode: boolean;
  bottomPanelHeight: number;
  setIsResizingBottom: (v: boolean) => void;
  bottomTab: 'terminal' | 'problems' | 'output' | 'debug';
  setBottomTab: (tab: 'terminal' | 'problems' | 'output' | 'debug') => void;
  terminalSessions: any[];
  setTerminalSessions: React.Dispatch<React.SetStateAction<any[]>>;
  activeTerminalId: string;
  setActiveTerminalId: (id: string) => void;
  addTerminalSession: () => void;
  closeTerminalSession: (id: string) => void;
  terminalInput: string;
  setTerminalInput: (input: string) => void;
  handleTerminalCommand: (e: React.KeyboardEvent) => void;
  problems: any[];
  activeFile: FileItem | null;
  isScanning: boolean;
  scanForProblems: () => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({
  zenMode,
  bottomPanelHeight,
  setIsResizingBottom,
  bottomTab,
  setBottomTab,
  terminalSessions,
  setTerminalSessions,
  activeTerminalId,
  setActiveTerminalId,
  addTerminalSession,
  closeTerminalSession,
  terminalInput,
  setTerminalInput,
  handleTerminalCommand,
  problems,
  activeFile,
  isScanning,
  scanForProblems
}) => {
  const currentSession = terminalSessions.find(s => s.id === activeTerminalId) || terminalSessions[0];

  if (zenMode) return null;

  const renderContent = () => {
    switch (bottomTab) {
      case 'terminal':
        return (
          <div className="flex-1 flex flex-col font-mono text-[13px] h-full overflow-hidden bg-[#0a0a0a]">
            {/* Terminal Tabs Workspace */}
            <div className="flex items-center gap-1 border-b border-white/5 bg-black/40 px-2 py-1">
              {terminalSessions.map(s => (
                <div 
                  key={s.id}
                  onClick={() => setActiveTerminalId(s.id)}
                  className={cn(
                    "group flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer transition-all text-[11px] font-medium border border-transparent",
                    activeTerminalId === s.id 
                      ? "bg-blue-600/20 text-blue-400 border-blue-500/30" 
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                  )}
                >
                  <Terminal size={12} className={activeTerminalId === s.id ? "text-blue-400" : "text-gray-600"} />
                  <span>{s.name}</span>
                  {terminalSessions.length > 1 && (
                    <X 
                      size={10} 
                      className="opacity-0 group-hover:opacity-100 hover:text-white transition-opacity ml-1" 
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTerminalSession(s.id);
                      }}
                    />
                  )}
                </div>
              ))}
              <button 
                onClick={addTerminalSession}
                className="p-1.5 hover:bg-white/5 rounded-md text-gray-500 hover:text-white transition-all ml-1"
                title="New Terminal"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Terminal Output */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              <div className="text-emerald-400 font-bold text-[11px] opacity-70 mb-2">Aura Terminal v4.0.0 (Cursor Core)</div>
              {currentSession?.output?.map((line: string, i: number) => (
                <div key={i} className="flex gap-2">
                  {line.startsWith('aura-project $') ? (
                    <div className="flex gap-2">
                      <span className="text-emerald-500">➜</span>
                      <span className="text-blue-400 font-bold">aura-project</span>
                      <span className="text-gray-500">$</span>
                      <span className="text-white">{line.replace('aura-project $', '').trim()}</span>
                    </div>
                  ) : (
                    <div className={cn(
                      "whitespace-pre-wrap break-all",
                      line.startsWith('Command not found') ? "text-red-400" : 
                      line.startsWith('[ERR]') ? "text-red-500" :
                      line.startsWith('✓') ? "text-emerald-400" :
                      line.startsWith('✗') ? "text-red-400" :
                      "text-[#cccccc]"
                    )}>{line}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Terminal Input */}
            <div className="flex items-center gap-2 text-white border-t border-white/5 p-2 bg-black/20">
              <span className="text-emerald-500">➜</span>
              <span className="text-blue-400 font-bold">aura-project</span>
              <span className="text-gray-500">$</span>
              <input 
                type="text" 
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={handleTerminalCommand}
                className="flex-1 bg-transparent border-none outline-none text-white font-mono placeholder:text-gray-700"
                placeholder="type command..."
              />
            </div>
          </div>
        );
      case 'problems':
        return (
          <div className="flex-1 overflow-y-auto p-2 space-y-1 h-full">
            {problems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-[#858585] gap-2 min-h-[100px]">
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
                    <span className="text-[10px] text-[#858585]">{activeFile?.name || 'Unknown'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        );
      case 'output':
        return (
          <div className="flex-1 font-mono text-[12px] p-4 text-gray-400 overflow-y-auto h-full">
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
          <div className="flex-1 flex flex-col items-center justify-center text-[#858585] gap-3 h-full min-h-[150px]">
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

  if (zenMode) return null;

  return (
    <div 
      style={{ height: bottomPanelHeight }}
      className="bg-[#1e1e1e] border-t border-white/10 flex flex-col relative shrink-0"
    >
      {/* Resizer Handle (Horizontal) */}
      <div 
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizingBottom(true);
          document.body.style.cursor = 'row-resize';
        }}
        className="absolute top-[-3px] left-0 right-0 h-1.5 cursor-row-resize hover:bg-blue-500/30 transition-colors z-[60]"
      />
      
      <div className="flex items-center gap-4 px-4 py-1 text-[11px] uppercase font-bold text-[#858585] border-b border-white/5 shrink-0">
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
      
      <div className="flex-1 overflow-hidden min-h-0 bg-black/20">
        {renderContent()}
      </div>
    </div>
  );
};
