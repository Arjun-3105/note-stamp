'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExt from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useCallback } from 'react';
import { SlashCommands } from './SlashCommands';

interface BlockNoteEditorProps {
  initialContent?: string;
  sourceId: string;
  onSave?: (content: string, wordCount: number) => Promise<any>;
  placeholder?: string;
}

export function BlockNoteEditor({
  initialContent = '',
  sourceId,
  onSave,
  placeholder = 'Start writing or type "/" for AI commands…',
}: BlockNoteEditorProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      LinkExt.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
      SlashCommands,
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'ws-tiptap-editor',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => {
      if (!onSave) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        const html = editor.getHTML();
        const wordCount = editor.getText().split(/\s+/).filter(Boolean).length;
        await onSave(html, wordCount).catch(console.error);
      }, 1500);
    },
  });

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}
