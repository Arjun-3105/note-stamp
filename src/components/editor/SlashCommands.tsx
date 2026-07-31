'use client';

import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance } from 'tippy.js';

export const SlashCommands = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
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
      }),
    ];
  },
});

const commands = [
  {
    name: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    searchTerms: ['heading', 'h1', 'title'],
    icon: 'H1',
    command: ({ editor, range }: any) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 1 })
        .run();
    },
  },
  {
    name: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    searchTerms: ['heading', 'h2', 'subtitle'],
    icon: 'H2',
    command: ({ editor, range }: any) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 2 })
        .run();
    },
  },
  {
    name: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    searchTerms: ['heading', 'h3'],
    icon: 'H3',
    command: ({ editor, range }: any) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleHeading({ level: 3 })
        .run();
    },
  },
  {
    name: 'bulletList',
    label: 'Bullet List',
    description: 'Create an unordered list',
    searchTerms: ['bullet', 'list', 'ul'],
    icon: '•',
    command: ({ editor, range }: any) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBulletList()
        .run();
    },
  },
  {
    name: 'orderedList',
    label: 'Numbered List',
    description: 'Create an ordered list',
    searchTerms: ['ordered', 'list', 'ol', 'number'],
    icon: '1.',
    command: ({ editor, range }: any) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleOrderedList()
        .run();
    },
  },
  {
    name: 'blockquote',
    label: 'Quote',
    description: 'Highlight an important quote',
    searchTerms: ['blockquote', 'quote'],
    icon: '"',
    command: ({ editor, range }: any) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBlockquote()
        .run();
    },
  },
  {
    name: 'codeBlock',
    label: 'Code Block',
    description: 'Capture a code snippet',
    searchTerms: ['code', 'block', 'snippet'],
    icon: '<>',
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    name: 'horizontalRule',
    label: 'Divider',
    description: 'Insert a horizontal divider',
    searchTerms: ['hr', 'horizontal', 'divider', 'line'],
    icon: '—',
    command: ({ editor, range }: any) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

export const CommandMenu = ({
  editor,
  items,
  command,
}: {
  editor: any;
  items: any[];
  command: any;
}) => {
  const onCommand = (item: any) => {
    command(item);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden p-2 space-y-1">
      {items.length > 0 ? (
        items.map((item, index) => (
          <button
            key={index}
            onClick={() => onCommand(item.command)}
            className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 transition-colors"
          >
            <div className="font-semibold text-sm text-gray-900">{item.label}</div>
            <div className="text-xs text-gray-600">{item.description}</div>
          </button>
        ))
      ) : (
        <p className="text-sm text-gray-600 px-3 py-2">No commands found</p>
      )}
    </div>
  );
};

export default {
  items: ({ query }: { query: string }) => {
    return commands
      .filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.searchTerms.some(term =>
          term.toLowerCase().startsWith(query.toLowerCase())
        )
      )
      .slice(0, 10);
  },

  render: () => {
    let component: ReactRenderer | null = null;
    let popup: Instance | null = null;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(CommandMenu, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        })[0];
      },

      onUpdate(props: any) {
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        (popup as any)?.setOptions({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup?.hide();
          return true;
        }

        if (props.event.key === 'ArrowUp') {
          props.event.preventDefault();
          props.event.stopPropagation();
          return true;
        }

        if (props.event.key === 'ArrowDown') {
          props.event.preventDefault();
          props.event.stopPropagation();
          return true;
        }

        if (props.event.key === 'Enter') {
          props.event.preventDefault();
          props.event.stopPropagation();
          return true;
        }

        return false;
      },

      onExit() {
        popup?.destroy();
        component?.destroy();
      },
    };
  },
};

