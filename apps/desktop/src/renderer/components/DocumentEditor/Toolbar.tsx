import type { Editor } from '@tiptap/react';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered,
  Undo2, Redo2,
  Image, Table,
  Heading1, Heading2, Heading3,
  Download, Palette, Highlighter, Type,
  Save, Plus, Minus, Trash2, Columns, Rows3,
  Merge, Split, ToggleRight, Shapes, PenTool, Replace, GripVertical,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { TEMPLATE_PLACEHOLDERS } from '@shared/constants';
import { SHAPE_CONFIGS, type ShapeType } from './extensions/ShapeNode';
import SignatureModal from './SignatureModal';
import ReplacePlaceholdersModal from './ReplacePlaceholdersModal';
import { useSettings } from '../../contexts/SettingsContext';

interface ToolbarProps {
  editor: Editor | null;
  pageColor: string;
  onPageColorChange: (color: string) => void;
  onExportPdf: () => void;
  onSavePdf?: () => void;
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Arial Black', value: 'Arial Black' },
  { label: 'Bookman', value: 'Bookman Old Style, Bookman' },
  { label: 'Calibri', value: 'Calibri' },
  { label: 'Cambria', value: 'Cambria' },
  { label: 'Candara', value: 'Candara' },
  { label: 'Comic Sans MS', value: 'Comic Sans MS' },
  { label: 'Consolas', value: 'Consolas' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Garamond', value: 'Garamond' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Impact', value: 'Impact' },
  { label: 'Lucida Console', value: 'Lucida Console' },
  { label: 'Palatino', value: 'Palatino Linotype, Palatino' },
  { label: 'Segoe UI', value: 'Segoe UI' },
  { label: 'Tahoma', value: 'Tahoma' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Trebuchet MS', value: 'Trebuchet MS' },
  { label: 'Verdana', value: 'Verdana' },
];

const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

const LINE_HEIGHTS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
];

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-primary-100 text-primary-700 dark:bg-[var(--primary-tint-40)] dark:text-primary-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />;
}

function ShapeIcon({ shape }: { shape: ShapeType }) {
  const s = 16;
  const stroke = 'currentColor';
  const fill = 'none';
  switch (shape) {
    case 'rectangle': return <svg width={s} height={s} viewBox="0 0 16 16"><rect x={1} y={3} width={14} height={10} fill={fill} stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'rounded-rect': return <svg width={s} height={s} viewBox="0 0 16 16"><rect x={1} y={3} width={14} height={10} rx={3} fill={fill} stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'circle': return <svg width={s} height={s} viewBox="0 0 16 16"><circle cx={8} cy={8} r={6.5} fill={fill} stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'ellipse': return <svg width={s} height={s} viewBox="0 0 16 16"><ellipse cx={8} cy={8} rx={7} ry={5} fill={fill} stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'line': return <svg width={s} height={s} viewBox="0 0 16 16"><line x1={1} y1={8} x2={15} y2={8} stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'pipe': return <svg width={s} height={s} viewBox="0 0 16 16"><line x1={8} y1={1} x2={8} y2={15} stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'arrow': return <svg width={s} height={s} viewBox="0 0 16 16"><line x1={1} y1={8} x2={12} y2={8} stroke={stroke} strokeWidth={1.5} /><polyline points="9,5 13,8 9,11" fill="none" stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'triangle': return <svg width={s} height={s} viewBox="0 0 16 16"><polygon points="8,2 15,14 1,14" fill={fill} stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'diamond': return <svg width={s} height={s} viewBox="0 0 16 16"><polygon points="8,1 15,8 8,15 1,8" fill={fill} stroke={stroke} strokeWidth={1.5} /></svg>;
    case 'star': return <svg width={s} height={s} viewBox="0 0 16 16"><polygon points="8,1 10,6 15,6 11,9.5 12.5,15 8,11.5 3.5,15 5,9.5 1,6 6,6" fill={fill} stroke={stroke} strokeWidth={1} /></svg>;
    default: return <svg width={s} height={s} />;
  }
}

export default function Toolbar({ editor, pageColor, onPageColorChange, onExportPdf, onSavePdf }: ToolbarProps) {
  const textColorRef = useRef<HTMLInputElement>(null);
  const highlightColorRef = useRef<HTMLInputElement>(null);
  const pageColorRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [shapesOpen, setShapesOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const shapeFillRef = useRef<HTMLInputElement>(null);
  const shapeStrokeRef = useRef<HTMLInputElement>(null);
  const { settings } = useSettings();
  const [sigDropdownOpen, setSigDropdownOpen] = useState(false);
  const [replacePlaceholdersOpen, setReplacePlaceholdersOpen] = useState(false);
  const [dragEnabled, setDragEnabled] = useState(false);
  const savedSignatures = settings.profile?.signatures || [];
  const defaultSig = savedSignatures.find(s => s.id === settings.profile?.defaultSignatureId) || savedSignatures[0];

  if (!editor) return null;

  const handleInsertSignature = (dataUrl: string) => {
    editor.chain().focus().setImage({ src: dataUrl }).run();
  };

  const insertShape = (shape: ShapeType) => {
    const config = SHAPE_CONFIGS[shape];
    editor.chain().focus().insertContent({
      type: 'shapeNode',
      attrs: {
        shape,
        width: config.defaultW,
        height: config.defaultH,
        fill: shape === 'line' || shape === 'pipe' || shape === 'arrow' ? 'none' : '#e5e7eb',
        stroke: '#6b7280',
        strokeWidth: shape === 'line' || shape === 'pipe' ? 3 : 2,
      },
    }).run();
    setShapesOpen(false);
  };

  const handleImageUpload = () => {
    imageInputRef.current?.click();
  };

  const onImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      editor.chain().focus().setImage({ src }).run();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const insertPlaceholder = (label: string) => {
    editor.chain().focus().insertContent({
      type: 'placeholderNode',
      attrs: { label },
    }).run();
  };

  const currentFontFamily = editor.getAttributes('textStyle').fontFamily || '';
  const currentFontSize = editor.getAttributes('textStyle').fontSize || '';

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 min-h-[40px]">
      {/* Undo / Redo */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo2 className="w-4 h-4" />
      </ToolbarButton>

      {/* Drag & Drop toggle */}
      <ToolbarButton
        onClick={() => {
          const next = !dragEnabled;
          setDragEnabled(next);
          (editor.storage as unknown as Record<string, { enabled: boolean }>).dragHandle.enabled = next;
        }}
        active={dragEnabled}
        title={dragEnabled ? 'Disable Drag & Drop' : 'Enable Drag & Drop'}
      >
        <GripVertical className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* Font family */}
      <select
        value={currentFontFamily}
        onChange={(e) => {
          if (e.target.value) {
            editor.chain().focus().setFontFamily(e.target.value).run();
          } else {
            editor.chain().focus().unsetFontFamily().run();
          }
        }}
        className="h-7 text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 text-gray-700 dark:text-gray-300"
        title="Font Family"
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      {/* Font size */}
      <select
        value={currentFontSize}
        onChange={(e) => {
          if (e.target.value) {
            editor.chain().focus().setFontSize(e.target.value).run();
          } else {
            editor.chain().focus().unsetFontSize().run();
          }
        }}
        className="h-7 text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 w-16 text-gray-700 dark:text-gray-300"
        title="Font Size"
      >
        <option value="">Size</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <Divider />

      {/* Text style */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold">
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic">
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline">
        <Underline className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* Headings */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">
        <Heading1 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">
        <Heading2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3">
        <Heading3 className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* Text color */}
      <div className="relative">
        <ToolbarButton onClick={() => textColorRef.current?.click()} title="Text Color">
          <Type className="w-4 h-4" />
        </ToolbarButton>
        <input
          ref={textColorRef}
          type="color"
          value={editor.getAttributes('textStyle').color || '#000000'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      {/* Highlight */}
      <div className="relative">
        <ToolbarButton onClick={() => highlightColorRef.current?.click()} active={editor.isActive('highlight')} title="Highlight">
          <Highlighter className="w-4 h-4" />
        </ToolbarButton>
        <input
          ref={highlightColorRef}
          type="color"
          value="#fef08a"
          onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <Divider />

      {/* Alignment */}
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align Left">
        <AlignLeft className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align Center">
        <AlignCenter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align Right">
        <AlignRight className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">
        <AlignJustify className="w-4 h-4" />
      </ToolbarButton>

      <Divider />

      {/* Lists */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>

      {/* Line spacing */}
      <select
        value={editor.getAttributes('paragraph').lineHeight || '1.5'}
        onChange={(e) => editor.chain().focus().setLineHeight(e.target.value).run()}
        className="h-7 text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 text-gray-700 dark:text-gray-300"
        title="Line Spacing"
      >
        {LINE_HEIGHTS.map((lh) => (
          <option key={lh.value} value={lh.value}>{lh.label}x</option>
        ))}
      </select>

      <Divider />

      {/* Table */}
      <ToolbarButton
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="Insert Table"
      >
        <Table className="w-4 h-4" />
      </ToolbarButton>

      {/* Image */}
      <ToolbarButton onClick={handleImageUpload} title="Insert Image">
        <Image className="w-4 h-4" />
      </ToolbarButton>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={onImageSelected}
        className="hidden"
      />

      {/* Shapes */}
      <div className="relative">
        <ToolbarButton onClick={() => setShapesOpen(!shapesOpen)} title="Insert Shape">
          <Shapes className="w-4 h-4" />
        </ToolbarButton>
        {shapesOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShapesOpen(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 w-48">
              <div className="px-2 py-1 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Shapes</div>
              <div className="grid grid-cols-2 gap-0.5 px-1">
                {(Object.entries(SHAPE_CONFIGS) as [ShapeType, { label: string }][]).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => insertShape(key)}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors text-left"
                  >
                    <ShapeIcon shape={key} />
                    {config.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Signature */}
      <div className="relative">
        <ToolbarButton
          onClick={() => {
            if (savedSignatures.length > 0) {
              setSigDropdownOpen(!sigDropdownOpen);
            } else {
              setSignatureOpen(true);
            }
          }}
          title={savedSignatures.length > 0 ? 'Insert Signature' : 'Create Signature'}
        >
          <PenTool className="w-4 h-4" />
        </ToolbarButton>
        {sigDropdownOpen && savedSignatures.length > 0 && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSigDropdownOpen(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 py-1 w-56">
              <div className="px-2 py-1 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium">Saved Signatures</div>
              {savedSignatures.map((sig) => (
                <button
                  key={sig.id}
                  onClick={() => {
                    editor.chain().focus().setImage({ src: sig.dataUrl }).run();
                    setSigDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <img src={sig.dataUrl} alt={sig.name} className="h-6 max-w-[80px] object-contain" />
                  <span className="truncate flex-1">{sig.name}</span>
                  {sig.id === defaultSig?.id && (
                    <span className="text-[10px] text-primary-500">default</span>
                  )}
                </button>
              ))}
              <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
                <button
                  onClick={() => {
                    setSigDropdownOpen(false);
                    setSignatureOpen(true);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <PenTool className="w-3 h-3" />
                  Draw new...
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Divider />

      {/* Placeholder */}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) {
            insertPlaceholder(e.target.value);
            e.target.value = '';
          }
        }}
        className="h-7 text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 text-gray-700 dark:text-gray-300"
        title="Insert Placeholder"
      >
        <option value="">Placeholder</option>
        {TEMPLATE_PLACEHOLDERS.map((p) => (
          <option key={p.key} value={p.key}>{p.key}</option>
        ))}
      </select>

      {/* Replace Placeholders */}
      <ToolbarButton
        onClick={() => setReplacePlaceholdersOpen(true)}
        title="Replace Placeholders"
      >
        <Replace className="w-4 h-4" />
      </ToolbarButton>

      {/* Page color */}
      <div className="relative">
        <ToolbarButton onClick={() => pageColorRef.current?.click()} title="Page Color">
          <Palette className="w-4 h-4" />
        </ToolbarButton>
        <input
          ref={pageColorRef}
          type="color"
          value={pageColor}
          onChange={(e) => onPageColorChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>

      <Divider />

      {/* Save to App */}
      {onSavePdf && (
        <button
          type="button"
          onClick={onSavePdf}
          title="Save as PDF (for attachments)"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-primary-600 text-white hover:bg-primary-700 transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          Save
        </button>
      )}

      {/* Export PDF */}
      <button
        type="button"
        onClick={onExportPdf}
        title="Export PDF"
        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        PDF
      </button>

      {/* Table context controls - shown when cursor is in a table */}
      {editor.isActive('table') && (
        <div className="w-full flex items-center gap-0.5 mt-1 pt-1.5 border-t border-gray-200 dark:border-gray-700">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-2 font-medium">Table</span>

          <ToolbarButton onClick={() => editor.chain().focus().addRowBefore().run()} title="Add Row Above">
            <div className="flex items-center"><Rows3 className="w-3.5 h-3.5" /><Plus className="w-2.5 h-2.5 -ml-0.5" /></div>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add Row Below">
            <div className="flex items-center"><Rows3 className="w-3.5 h-3.5" /><Plus className="w-2.5 h-2.5 -ml-0.5 text-primary-500" /></div>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteRow().run()} title="Delete Row">
            <div className="flex items-center"><Rows3 className="w-3.5 h-3.5" /><Minus className="w-2.5 h-2.5 -ml-0.5 text-red-500" /></div>
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().addColumnBefore().run()} title="Add Column Before">
            <div className="flex items-center"><Columns className="w-3.5 h-3.5" /><Plus className="w-2.5 h-2.5 -ml-0.5" /></div>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add Column After">
            <div className="flex items-center"><Columns className="w-3.5 h-3.5" /><Plus className="w-2.5 h-2.5 -ml-0.5 text-primary-500" /></div>
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete Column">
            <div className="flex items-center"><Columns className="w-3.5 h-3.5" /><Minus className="w-2.5 h-2.5 -ml-0.5 text-red-500" /></div>
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().mergeCells().run()} title="Merge Cells">
            <Merge className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().splitCell().run()} title="Split Cell">
            <Split className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Toggle Header Row">
            <ToggleRight className="w-4 h-4" />
          </ToolbarButton>

          <Divider />

          <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete Table">
            <Trash2 className="w-4 h-4 text-red-500" />
          </ToolbarButton>
        </div>
      )}

      {/* Shape context controls - shown when a shape is selected */}
      {editor.isActive('shapeNode') && (
        <div className="w-full flex items-center gap-1 mt-1 pt-1.5 border-t border-gray-200 dark:border-gray-700">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider mr-2 font-medium">Shape</span>

          {/* Fill color */}
          <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            Fill
            <button
              onClick={() => editor.commands.updateAttributes('shapeNode', { fill: 'none' })}
              title="No fill (transparent)"
              className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center text-[8px] font-bold ${
                editor.getAttributes('shapeNode').fill === 'none'
                  ? 'border-primary-500 bg-gray-100 dark:bg-gray-700 text-primary-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-400'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
            <label className="cursor-pointer">
              <input
                ref={shapeFillRef}
                type="color"
                value={editor.getAttributes('shapeNode').fill === 'none' ? '#e5e7eb' : (editor.getAttributes('shapeNode').fill || '#e5e7eb')}
                onChange={(e) => editor.commands.updateAttributes('shapeNode', { fill: e.target.value })}
                className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600 cursor-pointer p-0"
              />
            </label>
          </div>

          {/* Stroke color */}
          <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 ml-2">
            Stroke
            <button
              onClick={() => editor.commands.updateAttributes('shapeNode', { stroke: 'none' })}
              title="No stroke"
              className={`w-5 h-5 rounded border cursor-pointer flex items-center justify-center ${
                editor.getAttributes('shapeNode').stroke === 'none'
                  ? 'border-primary-500 bg-gray-100 dark:bg-gray-700 text-primary-600'
                  : 'border-gray-300 dark:border-gray-600 text-gray-400'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5"/></svg>
            </button>
            <label className="cursor-pointer">
              <input
                ref={shapeStrokeRef}
                type="color"
                value={editor.getAttributes('shapeNode').stroke === 'none' ? '#6b7280' : (editor.getAttributes('shapeNode').stroke || '#6b7280')}
                onChange={(e) => editor.commands.updateAttributes('shapeNode', { stroke: e.target.value })}
                className="w-5 h-5 rounded border border-gray-300 dark:border-gray-600 cursor-pointer p-0"
              />
            </label>
          </div>

          {/* Stroke width */}
          <label className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 ml-2">
            Width
            <select
              value={editor.getAttributes('shapeNode').strokeWidth || 2}
              onChange={(e) => editor.commands.updateAttributes('shapeNode', { strokeWidth: Number(e.target.value) })}
              className="h-6 text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 text-gray-700 dark:text-gray-300"
            >
              {[1, 2, 3, 4, 5, 6, 8].map(w => (
                <option key={w} value={w}>{w}px</option>
              ))}
            </select>
          </label>

          <Divider />

          <ToolbarButton onClick={() => editor.commands.deleteSelection()} title="Delete Shape">
            <Trash2 className="w-4 h-4 text-red-500" />
          </ToolbarButton>
        </div>
      )}

      {/* Signature Modal */}
      <SignatureModal
        isOpen={signatureOpen}
        onClose={() => setSignatureOpen(false)}
        onInsert={handleInsertSignature}
      />

      {/* Replace Placeholders Modal */}
      <ReplacePlaceholdersModal
        isOpen={replacePlaceholdersOpen}
        onClose={() => setReplacePlaceholdersOpen(false)}
        editor={editor}
      />
    </div>
  );
}
