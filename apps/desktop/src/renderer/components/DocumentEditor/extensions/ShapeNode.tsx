import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { useState, useCallback } from 'react';

export type ShapeType =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'pipe'
  | 'arrow'
  | 'triangle'
  | 'diamond'
  | 'rounded-rect'
  | 'star';

const SHAPE_CONFIGS: Record<ShapeType, { label: string; defaultW: number; defaultH: number }> = {
  rectangle: { label: 'Rectangle', defaultW: 200, defaultH: 100 },
  'rounded-rect': { label: 'Rounded Rectangle', defaultW: 200, defaultH: 100 },
  circle: { label: 'Circle', defaultW: 100, defaultH: 100 },
  ellipse: { label: 'Ellipse', defaultW: 180, defaultH: 100 },
  line: { label: 'Horizontal Line', defaultW: 300, defaultH: 4 },
  pipe: { label: 'Vertical Pipe', defaultW: 4, defaultH: 120 },
  arrow: { label: 'Arrow', defaultW: 200, defaultH: 40 },
  triangle: { label: 'Triangle', defaultW: 120, defaultH: 100 },
  diamond: { label: 'Diamond', defaultW: 120, defaultH: 120 },
  star: { label: 'Star', defaultW: 120, defaultH: 120 },
};

function renderShapeSVG(
  shape: ShapeType,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  strokeWidth: number
) {
  const sw = strokeWidth;
  const half = sw / 2;

  switch (shape) {
    case 'rectangle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={half} y={half} width={w - sw} height={h - sw} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    case 'rounded-rect':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <rect x={half} y={half} width={w - sw} height={h - sw} rx={12} ry={12} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    case 'circle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2 - half} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    case 'ellipse':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - half} ry={h / 2 - half} fill={fill} stroke={stroke} strokeWidth={sw} />
        </svg>
      );
    case 'line':
      return (
        <svg width={w} height={Math.max(h, sw + 2)} viewBox={`0 0 ${w} ${Math.max(h, sw + 2)}`}>
          <line x1={0} y1={Math.max(h, sw + 2) / 2} x2={w} y2={Math.max(h, sw + 2) / 2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'pipe':
      return (
        <svg width={Math.max(w, sw + 2)} height={h} viewBox={`0 0 ${Math.max(w, sw + 2)} ${h}`}>
          <line x1={Math.max(w, sw + 2) / 2} y1={0} x2={Math.max(w, sw + 2) / 2} y2={h} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case 'arrow':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={stroke} />
            </marker>
          </defs>
          <line x1={0} y1={h / 2} x2={w - 12} y2={h / 2} stroke={stroke} strokeWidth={sw} markerEnd="url(#arrowhead)" />
        </svg>
      );
    case 'triangle':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polygon points={`${w / 2},${half} ${w - half},${h - half} ${half},${h - half}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case 'diamond':
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polygon points={`${w / 2},${half} ${w - half},${h / 2} ${w / 2},${h - half} ${half},${h / 2}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case 'star': {
      const cx = w / 2, cy = h / 2;
      const outer = Math.min(w, h) / 2 - half;
      const inner = outer * 0.4;
      const points: string[] = [];
      for (let i = 0; i < 5; i++) {
        const outerAngle = (Math.PI / 2) + (2 * Math.PI * i) / 5;
        const innerAngle = outerAngle + Math.PI / 5;
        points.push(`${cx + outer * Math.cos(-outerAngle)},${cy + outer * Math.sin(-outerAngle)}`);
        points.push(`${cx + inner * Math.cos(-innerAngle)},${cy + inner * Math.sin(-innerAngle)}`);
      }
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <polygon points={points.join(' ')} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    }
    default:
      return null;
  }
}

interface ShapeNodeViewProps {
  node: {
    attrs: {
      shape: ShapeType;
      width: number;
      height: number;
      fill: string;
      stroke: string;
      strokeWidth: number;
    };
  };
  updateAttributes: (attrs: Record<string, any>) => void;
  selected: boolean;
}

const ShapeNodeView = ({ node, updateAttributes, selected }: ShapeNodeViewProps) => {
  const { shape, width, height, fill, stroke, strokeWidth } = node.attrs;
  const [resizing, setResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = width;
    const startH = height;

    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(20, startW + (ev.clientX - startX));
      const newH = Math.max(20, startH + (ev.clientY - startY));
      updateAttributes({ width: Math.round(newW), height: Math.round(newH) });
    };

    const onUp = () => {
      setResizing(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [width, height, updateAttributes]);

  return (
    <NodeViewWrapper
      as="div"
      draggable
      data-drag-handle
      style={{ display: 'inline-block', position: 'relative', lineHeight: 0 }}
    >
      <div
        style={{
          outline: selected ? '2px solid #3b82f6' : 'none',
          borderRadius: 2,
          display: 'inline-block',
          cursor: resizing ? 'nwse-resize' : 'default',
          position: 'relative',
        }}
      >
        {renderShapeSVG(shape, width, height, fill, stroke, strokeWidth)}
        {/* Resize handle */}
        {selected && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute',
              right: -4,
              bottom: -4,
              width: 10,
              height: 10,
              background: '#3b82f6',
              border: '2px solid white',
              borderRadius: 2,
              cursor: 'nwse-resize',
            }}
          />
        )}
      </div>
    </NodeViewWrapper>
  );
};

export { SHAPE_CONFIGS };

export const ShapeNode = Node.create({
  name: 'shapeNode',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      shape: { default: 'rectangle' as ShapeType },
      width: { default: 200 },
      height: { default: 100 },
      fill: { default: '#e5e7eb' },
      stroke: { default: '#6b7280' },
      strokeWidth: { default: 2 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-shape-node]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-shape-node': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ShapeNodeView as never);
  },
});
