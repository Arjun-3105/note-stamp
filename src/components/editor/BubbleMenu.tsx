'use client';

import { BubbleMenu as TiptapBubbleMenu, Editor } from '@tiptap/react';
import { useState } from 'react';

export interface BubbleMenuProps {
  editor: Editor;
  sourceId: string;
}

export function BubbleMenu({ editor, sourceId }: BubbleMenuProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSelectedText = () => {
    return editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to,
      ' '
    );
  };

  const handleCorrect = async () => {
    const text = getSelectedText();
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/assistant/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to correct text');
      }

      const { corrected } = await response.json();

      // Replace selected text with corrected version
      editor
        .chain()
        .focus()
        .insertContent(corrected, {
          parseOptions: {
            preserveWhitespace: 'full',
          },
        })
        .run();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarize = async () => {
    const text = getSelectedText();
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/editor/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to summarize');
      }

      const { summary } = await response.json();

      // Insert summary below current paragraph
      editor.chain().focus().insertContent(`\n\n**Summary:** ${summary}`).run();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplain = async () => {
    const text = getSelectedText();
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/editor/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, sourceId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to explain');
      }

      const { explanation } = await response.json();

      // Insert explanation below current paragraph
      editor
        .chain()
        .focus()
        .insertContent(`\n\n**Explanation:** ${explanation}`)
        .run();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TiptapBubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100 }}
      className="flex gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-2"
    >
      <BubbleMenuButton
        onClick={handleCorrect}
        disabled={isLoading}
        title="Correct text"
      >
        ✓ Fix
      </BubbleMenuButton>
      <BubbleMenuButton
        onClick={handleSummarize}
        disabled={isLoading}
        title="Summarize selection"
      >
        📋 Summarize
      </BubbleMenuButton>
      <BubbleMenuButton
        onClick={handleExplain}
        disabled={isLoading}
        title="Explain selection"
      >
        💡 Explain
      </BubbleMenuButton>

      {error && (
        <div className="px-2 py-1 text-xs text-red-600 whitespace-nowrap">
          {error}
        </div>
      )}
    </TiptapBubbleMenu>
  );
}

function BubbleMenuButton({
  onClick,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-3 py-1 text-sm rounded font-medium transition-colors bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
    >
      {children}
    </button>
  );
}

