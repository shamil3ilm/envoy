import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

const PlaceholderNodeView = ({ node }: { node: { attrs: { label: string } } }) => {
  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        data-placeholder-node
        contentEditable={false}
        style={{
          display: 'inline',
          background: '#e0e7ff',
          color: '#3730a3',
          padding: '1px 6px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.9em',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {'{{ ' + node.attrs.label + ' }}'}
      </span>
    </NodeViewWrapper>
  );
};

export const PlaceholderNode = Node.create({
  name: 'placeholderNode',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      label: {
        default: 'variable',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-placeholder-node]',
        getAttrs: (el) => {
          const element = el as HTMLElement;
          const text = element.textContent || '';
          const match = text.match(/\{\{\s*(.+?)\s*\}\}/);
          return { label: match ? match[1] : 'variable' };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-placeholder-node': '' }),
      `{{ ${HTMLAttributes.label} }}`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlaceholderNodeView);
  },
});
