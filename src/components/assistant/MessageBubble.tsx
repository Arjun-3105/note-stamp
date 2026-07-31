'use client';

import { ChatMessage } from './AssistantPanel';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface MessageBubbleProps {
  message: ChatMessage;
  accentColor?: string;
}

export function MessageBubble({ message, accentColor = '#7C5CFF' }: MessageBubbleProps) {
  const isUser = message.role === 'user';

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
        {isUser ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none break-words
            prose-p:leading-relaxed prose-pre:bg-[#0F1115] prose-pre:border prose-pre:border-[#252B36]
            prose-headings:text-[#F5F6F8] prose-a:text-[#7C5CFF]"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
