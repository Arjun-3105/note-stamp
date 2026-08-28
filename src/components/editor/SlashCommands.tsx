'use client';

import { Extension } from '@tiptap/core';
import Suggestion, { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

export interface SlashCommandItem {
  name: string;
  label: string;
  description: string;
  searchTerms: string[];
  icon: string;
  command: (props: { editor: any; range: any }) => void;
}

const commands: SlashCommandItem[] = [
  {
    name: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    searchTerms: ['heading', 'h1', 'title'],
    icon: 'H1',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    name: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    searchTerms: ['heading', 'h2', 'subtitle'],
    icon: 'H2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    name: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    searchTerms: ['heading', 'h3'],
    icon: 'H3',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
  {
    name: 'bulletList',
    label: 'Bullet List',
    description: 'Create an unordered list',
    searchTerms: ['bullet', 'list', 'ul'],
    icon: '•',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    name: 'orderedList',
    label: 'Numbered List',
    description: 'Create an ordered list',
    searchTerms: ['ordered', 'list', 'ol', 'number'],
    icon: '1.',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    name: 'todoList',
    label: 'Checklist',
    description: 'Track tasks with checkboxes',
    searchTerms: ['todo', 'task', 'check', 'checkbox'],
    icon: '☑',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().insertContent('[ ] ').run();
    },
  },
  {
    name: 'blockquote',
    label: 'Quote',
    description: 'Highlight an important quote',
    searchTerms: ['blockquote', 'quote'],
    icon: '"',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    name: 'codeBlock',
    label: 'Code Block',
    description: 'Capture a code snippet',
    searchTerms: ['code', 'block', 'snippet'],
    icon: '<>',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    name: 'horizontalRule',
    label: 'Divider',
    description: 'Insert a horizontal divider',
    searchTerms: ['hr', 'horizontal', 'divider', 'line'],
    icon: '—',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

function filterCommands(query: string): SlashCommandItem[] {
  const q = query.toLowerCase();
  return commands
    .filter(
      item =>
        item.label.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.searchTerms.some(term => term.toLowerCase().startsWith(q))
    )
    .slice(0, 10);
}

interface CommandMenuHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const CommandMenu = forwardRef<
  CommandMenuHandle,
  SuggestionProps<SlashCommandItem> & { items: SlashCommandItem[] }
>(function CommandMenu(props, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (!item) return;
    props.command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(current => (current + props.items.length - 1) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(current => (current + 1) % Math.max(props.items.length, 1));
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      className="rounded-[10px] shadow-xl overflow-hidden p-1.5 space-y-0.5"
      style={{ background: '#151922', border: '1px solid #252B36' }}
    >
      {props.items.length > 0 ? (
        props.items.map((item, index) => (
          <button
            key={item.name}
            type="button"
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className="w-full text-left px-3 py-2 rounded-md transition-colors flex items-start gap-3"
            style={index === selectedIndex ? { background: '#7C5CFF', color: '#fff' } : { color: '#F5F6F8' }}
          >
            <span
              className="text-[11px] font-mono font-bold mt-0.5 w-6 text-center shrink-0 rounded px-1 py-0.5"
              style={
                index === selectedIndex
                  ? { background: 'rgba(255,255,255,0.18)' }
                  : { background: '#252B36', color: '#52ebcf' }
              }
            >
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-sm leading-tight">{item.label}</span>
              <span
                className="block text-xs leading-tight"
                style={{ color: index === selectedIndex ? 'rgba(255,255,255,0.75)' : '#A2A8B5' }}
              >
                {item.description}
              </span>
            </span>
          </button>
        ))
      ) : (
        <p className="text-sm px-3 py-2" style={{ color: '#A2A8B5' }}>
          No commands found
        </p>
      )}
    </div>
  );
});

const POPUP_MAX_HEIGHT = 340;

function positionPopup(
  element: HTMLElement,
  clientRect: (() => DOMRect | null) | DOMRect | null | undefined
) {
  const rect = typeof clientRect === 'function' ? clientRect() : clientRect;
  if (!rect) return;
  const flipUp = rect.bottom + POPUP_MAX_HEIGHT > window.innerHeight;
  element.style.left = `${Math.max(8, rect.left)}px`;
  element.style.top = flipUp
    ? `${Math.max(8, rect.top - POPUP_MAX_HEIGHT - 6)}px`
    : `${rect.bottom + 6}px`;
}

export const SlashCommands = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        items: ({ query }: { query: string }) => filterCommands(query),
        command: ({ editor, range, props }: { editor: any; range: any; props: SlashCommandItem }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        render: () => {
          let component: ReactRenderer | null = null;
          let container: HTMLDivElement | null = null;

          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              component = new ReactRenderer(CommandMenu, {
                props: { ...props, items: props.items },
                editor: props.editor,
              });

              const menuElement = component.element as HTMLElement;
              container = document.createElement('div');
              container.style.position = 'fixed';
              container.style.zIndex = '9999';
              container.style.maxHeight = `${POPUP_MAX_HEIGHT}px`;
              container.style.overflowY = 'auto';
              container.appendChild(menuElement);
              document.body.appendChild(container);
              positionPopup(container, props.clientRect);
            },

            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
              component?.updateProps({ ...props, items: props.items });
              if (container) positionPopup(container, props.clientRect);
            },

            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === 'Escape') {
                if (container) container.style.display = 'none';
                return true;
              }
              return (component?.ref as unknown as CommandMenuHandle | null)?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              container?.remove();
              container = null;
              component?.destroy();
              component = null;
            },
          };
        },
      }),
    ];
  },
});
