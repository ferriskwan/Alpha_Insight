import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DESIGN_TOKENS } from '../tokens';

export interface RichMarkdownProps {
  content: string;
  className?: string;
}

export const RichMarkdown: React.FC<RichMarkdownProps> = ({ content, className = '' }) => {
  return (
    <div
      style={{
        fontFamily: DESIGN_TOKENS.typography.fontSans,
        color: DESIGN_TOKENS.paper.textSecondary,
      }}
      className={`text-xs sm:text-[13px] leading-relaxed space-y-2.5 break-words ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold text-slate-900 mt-3 mb-1.5 pb-1 border-b border-slate-200">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-slate-900 mt-3 mb-1 pb-1 border-b border-slate-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-[13px] font-bold text-slate-900 mt-2.5 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="text-slate-700 leading-relaxed mb-2">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 text-slate-700 mb-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 text-slate-700 mb-2">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-bold text-slate-900">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 font-semibold underline hover:text-blue-800"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code
              style={{ fontFamily: DESIGN_TOKENS.typography.fontMono }}
              className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] text-blue-700 font-semibold"
            >
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="pl-3 border-l-2 border-blue-600 bg-slate-50 py-1.5 pr-2 rounded-r text-slate-700 italic">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 border border-slate-200 rounded">
              <table className="w-full text-left text-xs border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] uppercase text-slate-600">
              {children}
            </thead>
          ),
          th: ({ children }) => <th className="py-1.5 px-2.5 font-semibold">{children}</th>,
          td: ({ children }) => (
            <td className="py-1.5 px-2.5 border-t border-slate-100 text-slate-800">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default RichMarkdown;
