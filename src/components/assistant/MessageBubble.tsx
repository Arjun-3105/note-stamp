'use client';

import { ChatMessage } from './AssistantPanel';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitTextWithCitations, ParsedCitation } from '@/lib/citations';

export interface MessageBubbleProps {
  message: ChatMessage;
  accentColor?: string;
  onCitationClick?: (citation: ParsedCitation) => void;
}

export function MessageBubble({ message, accentColor = '#7C5CFF', onCitationClick }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  function renderWithCitations(text: string) {
    if (isUser) return <p className="whitespace-pre-wrap break-words">{text}</p>;

    const parts = splitTextWithCitations(text);

    // If no citations, just render with ReactMarkdown
    if (parts.every(p => p.type === 'text')) {
      return (
        <div className="prose prose-invert prose-sm max-w-none break-words
          prose-p:leading-relaxed prose-pre:bg-[#0F1115] prose-pre:border prose-pre:border-[#252B36]
          prose-headings:text-[#F5F6F8] prose-a:text-[#7C5CFF]"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {parts.map(p => p.content).join('')}
          </ReactMarkdown>
        </div>
      );
    }

    // With citations: render each part with markdown for text, links for citations
    return (
      <div className="prose prose-invert prose-sm max-w-none break-words
        prose-p:leading-relaxed prose-pre:bg-[#0F1115] prose-pre:border prose-pre:border-[#252B36]
        prose-headings:text-[#F5F6F8] prose-a:text-[#7C5CFF]"
      >
        {parts.map((part, idx) =>
          part.type === 'text' ? (
            <ReactMarkdown key={idx} remarkPlugins={[remarkGfm]}>
              {part.content}
            </ReactMarkdown>
          ) : (
            <a
              key={idx}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onCitationClick?.(part.content);
              }}
              className="citation-link inline"
              style={{
                color: '#52ebcf',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                cursor: 'pointer',
                fontSize: '0.85em',
                verticalAlign: 'super',
                marginLeft: '2px',
              }}
              title={`Go to ${part.content.label}`}
            >
              [{part.content.sectionTitle ? `§ ${part.content.sectionTitle}` : ''} {part.content.pageStart ? `p.${part.content.pageStart}${part.content.pageEnd && part.content.pageEnd !== part.content.pageStart ? `-${part.content.pageEnd}` : ''}` : `chunk ${(part.content.chunkIndex ?? 0) + 1}`}]
            </a>
          )
        )}
      </div>
    );
  }

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div
          className="w-7 h-7 rounded-[10px] flex items-center justify-center text-white text-[11px] font-extrabold shrink-0 mt-0.5 shadow-sm"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
        >
          ✦
        </div>
      )}
      <div
        className="max-w-[85%] px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm"
        style={
          isUser
            ? {
                background: '#1e1e28',
                color: '#F5F6F8',
                borderRadius: '18px 18px 4px 18px',
                border: '1px solid #252B36',
              }
            : {
                background: `${accentColor}0d`,
                color: '#F5F6F8',
                borderRadius: '18px 18px 18px 4px',
                border: `1px solid ${accentColor}20`,
              }
        }
      >
        {renderWithCitations(message.content)}
      </div>
    </div>
  );
}
