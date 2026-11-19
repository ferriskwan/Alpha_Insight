import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Minus,
  Maximize2,
  Minimize2,
  Send,
  RotateCcw,
  GripHorizontal,
} from 'lucide-react';
import { DESIGN_TOKENS } from '../tokens';
import { RichMarkdown } from './RichMarkdown';

export interface AgentChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface DisplayedScreenContext {
  symbol?: string;
  activeRoute?: string;
  routeTitle?: string;
  contextPills?: string[];
  data?: Record<string, unknown>;
}

export interface FloatingAgentChatProps {
  open: boolean;
  onClose: () => void;
  model?: string;
  displayedContext: DisplayedScreenContext;
  messages: AgentChatTurn[];
  loading?: boolean;
  onSendMessage: (messageText: string) => void;
  onClearChat: () => void;
}

const DEFAULT_STARTER_PROMPTS = [
  'Explain divergences between the 4 analysts',
  'Does my stop-loss align with the Risk Manager?',
  'Compare current run vs prior historical outputs',
];

export const FloatingAgentChat: React.FC<FloatingAgentChatProps> = ({
  open,
  onClose,
  model = 'gemini-4-argon',
  displayedContext,
  messages,
  loading = false,
  onSendMessage,
  onClearChat,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [expandedSize, setExpandedSize] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 480,
    height: 540,
  });
  const [inputVal, setInputVal] = useState('');
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  useEffect(() => {
    if (
      open &&
      !minimized &&
      scrollEndRef.current &&
      typeof scrollEndRef.current.scrollIntoView === 'function'
    ) {
      scrollEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, minimized]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const deltaX = dragStartRef.current.startX - moveEvent.clientX;
      const deltaY = dragStartRef.current.startY - moveEvent.clientY;
      const nextWidth = Math.max(
        360,
        Math.min(window.innerWidth - 32, dragStartRef.current.startWidth + deltaX)
      );
      const nextHeight = Math.max(
        340,
        Math.min(window.innerHeight - 80, dragStartRef.current.startHeight + deltaY)
      );
      setDimensions({ width: nextWidth, height: nextHeight });
    };

    const handleMouseUp = () => {
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const toggleExpandPreset = () => {
    if (expandedSize) {
      setDimensions({ width: 480, height: 540 });
      setExpandedSize(false);
    } else {
      const targetW = typeof window !== 'undefined' ? Math.min(820, window.innerWidth - 48) : 760;
      const targetH = typeof window !== 'undefined' ? Math.min(760, window.innerHeight - 96) : 680;
      setDimensions({ width: targetW, height: targetH });
      setExpandedSize(true);
    }
  };

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed || loading) return;
    onSendMessage(trimmed);
    setInputVal('');
  };

  const pills =
    displayedContext.contextPills && displayedContext.contextPills.length > 0
      ? displayedContext.contextPills
      : [
          `Active Context: ${displayedContext.symbol || 'AAPL'}`,
          displayedContext.routeTitle || displayedContext.activeRoute || 'Stock Analysis',
        ];

  if (minimized) {
    return (
      <div
        data-testid="floating-agent-chat-minimized"
        style={{
          fontFamily: DESIGN_TOKENS.typography.fontSans,
          backgroundColor: DESIGN_TOKENS.paper.surface,
          borderColor: DESIGN_TOKENS.paper.borderActive,
          color: DESIGN_TOKENS.paper.textPrimary,
        }}
        className="fixed bottom-16 lg:bottom-4 right-4 z-50 border rounded-full shadow-xl px-3.5 py-2 flex items-center gap-2.5"
      >
        <Sparkles className="w-4 h-4 text-blue-700" />
        <span className="text-xs font-bold">Chat Session</span>
        <span
          style={{ fontFamily: DESIGN_TOKENS.typography.fontMono }}
          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
        >
          {model}
        </span>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand Chat Session"
          className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Chat Session"
          className="p-1 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Chat Session"
      data-testid="floating-agent-chat"
      style={{
        fontFamily: DESIGN_TOKENS.typography.fontSans,
        backgroundColor: DESIGN_TOKENS.paper.surface,
        borderColor: DESIGN_TOKENS.paper.border,
        color: DESIGN_TOKENS.paper.textPrimary,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        maxWidth: '96vw',
        maxHeight: '86vh',
      }}
      className="fixed bottom-16 lg:bottom-4 right-2 sm:right-4 z-50 border rounded-xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Top-Left Corner Drag Resize Handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        title="Drag corner to resize Chat Session window"
        data-testid="chat-resize-handle"
        className="absolute top-0 left-0 w-5 h-5 cursor-nwse-resize z-20 flex items-center justify-center text-slate-400 hover:text-blue-700"
      >
        <GripHorizontal className="w-3 h-3 -rotate-45" />
      </div>

      {/* 1. Floating Window Header */}
      <div
        style={{
          backgroundColor: DESIGN_TOKENS.paper.surface,
          borderColor: DESIGN_TOKENS.paper.border,
        }}
        className="pl-5 pr-3.5 py-2.5 border-b flex items-center justify-between shrink-0"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-700 shrink-0" />
          <span className="font-bold text-xs sm:text-sm text-slate-900">
            Chat Session — Agentic Analyst
          </span>
          <span
            style={{ fontFamily: DESIGN_TOKENS.typography.fontMono }}
            className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold"
          >
            {model}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleExpandPreset}
            aria-label="Toggle Chat Session size"
            title={expandedSize ? 'Restore default window size' : 'Expand window size'}
            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            {expandedSize ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            aria-label="Minimize Chat Session"
            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Chat Session"
            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Live Screen Context Bar */}
      <div
        style={{
          backgroundColor: DESIGN_TOKENS.paper.elevated,
          borderColor: DESIGN_TOKENS.paper.border,
        }}
        className="px-3.5 py-2 border-b flex flex-wrap items-center gap-1.5 shrink-0"
      >
        {pills.map((pill, idx) => (
          <span
            key={idx}
            style={{ fontFamily: DESIGN_TOKENS.typography.fontMono }}
            className={`text-[10px] px-2 py-0.5 rounded-full border ${
              idx === 0
                ? 'bg-blue-50 border-blue-600 text-blue-700 font-semibold'
                : 'bg-white border-slate-200 text-slate-700'
            }`}
          >
            {pill}
          </span>
        ))}
      </div>

      {/* 3. Multi-Turn Interactive Chat Thread */}
      <div
        style={{ backgroundColor: DESIGN_TOKENS.paper.canvas }}
        className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="space-y-2.5">
            <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
              <div className="font-semibold text-slate-900 mb-1">
                Persistent Chat Session Ready
              </div>
              Ask questions about the displayed Stock Analysis outputs, Executive Summary,
              Interactive Canvas indicators, or your active Investment Note. All turns are saved to
              the database and tied to this analysis.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => onSendMessage(prompt)}
                  className="text-left text-[11px] px-2.5 py-1 rounded-full bg-white border border-slate-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-700 text-white font-medium whitespace-pre-wrap'
                    : 'bg-white border border-slate-200 text-slate-900'
                }`}
              >
                {msg.role === 'user' ? msg.content : <RichMarkdown content={msg.content} />}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-start">
            <div
              style={{ fontFamily: DESIGN_TOKENS.typography.fontMono }}
              className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-[11px] text-slate-600 flex items-center gap-2"
            >
              <span className="w-2 h-2 rounded-full bg-blue-700 animate-ping" />
              Synthesizing response via {model}...
            </div>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* 4. Chat Input Footer */}
      <form
        onSubmit={handleSubmit}
        style={{
          backgroundColor: DESIGN_TOKENS.paper.surface,
          borderColor: DESIGN_TOKENS.paper.border,
        }}
        className="p-2.5 border-t flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Ask a question about the displayed analysis or note..."
          aria-label="Ask a question about the displayed analysis or note"
          className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded text-slate-900 focus:outline-hidden focus:border-blue-600"
        />
        <button
          type="button"
          onClick={onClearChat}
          title="Clear Chat"
          className="px-2.5 py-1.5 text-xs font-medium rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center gap-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Clear Chat</span>
        </button>
        <button
          type="submit"
          disabled={loading || !inputVal.trim()}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50 cursor-pointer flex items-center gap-1"
        >
          <Send className="w-3 h-3" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};

export default FloatingAgentChat;
