'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState, useCallback } from 'react';
import { BubbleMenu } from './BubbleMenu';
import { SlashCommands } from './SlashCommands';

export interface TiptapEditorProps {
  initialContent?: string;
  sourceId: string;
  onSave?: (content: string, wordCount: number) => Promise<void>;
  placeholder?: string;
}

export function TiptapEditor({
  initialContent = '',
  sourceId,
  onSave,
  placeholder = 'Start typing or use / for commands...',
}: TiptapEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [wordCount, setWordCount] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      SlashCommands,
    ],
    content: initialContent,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      // Update word count
      const text = editor.getText();
      const words = text.split(/\s+/).filter(w => w.length > 0).length;
      setWordCount(words);
    },
  });

  // Auto-save every 30 seconds
  useEffect(() => {
    if (!editor) return;

    const autoSaveInterval = setInterval(async () => {
      if (editor.isEditable && onSave) {
        try {
          setIsSaving(true);
          const html = editor.getHTML();
          await onSave(html, wordCount);
          setLastSaved(new Date());
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setIsSaving(false);
        }
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [editor, onSave, wordCount]);

  if (!editor) {
    return null;
  }

  return (
    <div className="prose prose-sm max-w-none">
      {/* Toolbar */}
      <div className="border-b border-gray-200 rounded-t-lg bg-gray-50 p-3 flex items-center gap-2 flex-wrap">
        <ToolbarButton
          isActive={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>

        <ToolbarButton
          isActive={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300" />

        <ToolbarButton
          isActive={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1"
        >
          H1
        </ToolbarButton>

        <ToolbarButton
          isActive={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2"
        >
          H2
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300" />

        <ToolbarButton
          isActive={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          •
        </ToolbarButton>

        <ToolbarButton
          isActive={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          1.
        </ToolbarButton>

        <ToolbarButton
          isActive={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Quote"
        >
          "
        </ToolbarButton>

        <div className="flex-1" />

        <div className="text-xs text-gray-600">
          {wordCount} words
          {lastSaved && ` • Saved ${formatTime(lastSaved)}`}
          {isSaving && ' • Saving...'}
        </div>
      </div>

      {/* Editor with Bubble Menu */}
      <div className="border border-t-0 border-gray-200 rounded-b-lg bg-white min-h-96">
        {editor && <BubbleMenu editor={editor} sourceId={sourceId} />}
        <EditorContent
          editor={editor}
          className="p-4 prose prose-sm max-w-none focus:outline-none"
        />
      </div>
    </div>
  );
}

function ToolbarButton({
  isActive,
  onClick,
  children,
  title,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-700 hover:bg-gray-100'
      } border border-gray-300`}
    >
      {children}
    </button>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

