import { useState, useRef, useEffect, useCallback } from 'react';
import { X, PenTool, Type, Upload } from 'lucide-react';

type Tab = 'draw' | 'type' | 'upload';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (dataUrl: string) => void;
}

const SIGNATURE_FONTS = [
  { label: 'Brush Script', value: "'Brush Script MT', 'Segoe Script', cursive" },
  { label: 'Segoe Script', value: "'Segoe Script', 'Comic Sans MS', cursive" },
  { label: 'Lucida Handwriting', value: "'Lucida Handwriting', 'Segoe Script', cursive" },
  { label: 'Palace Script', value: "'Palace Script MT', 'Segoe Script', cursive" },
  { label: 'Comic Sans', value: "'Comic Sans MS', cursive" },
  { label: 'Monotype Corsiva', value: "'Monotype Corsiva', 'Segoe Script', cursive" },
];

const PEN_COLORS = ['#000000', '#1e3a5f', '#1a1a2e', '#4a0e0e', '#2d3436'];

export default function SignatureModal({ isOpen, onClose, onInsert }: SignatureModalProps) {
  const [tab, setTab] = useState<Tab>('draw');
  const [signatureText, setSignatureText] = useState('');
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0].value);
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(2);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize canvas
  useEffect(() => {
    if (!isOpen || tab !== 'draw') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 480;
    canvas.height = 180;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    // Draw baseline
    ctx.beginPath();
    ctx.moveTo(20, 130);
    ctx.lineTo(460, 130);
    ctx.stroke();
  }, [isOpen, tab]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    lastPoint.current = getCanvasPoint(e);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const point = getCanvasPoint(e);
    if (!point || !lastPoint.current) return;

    ctx.strokeStyle = penColor;
    ctx.lineWidth = penSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    lastPoint.current = point;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    lastPoint.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(20, 130);
    ctx.lineTo(460, 130);
    ctx.stroke();
  };

  const insertDrawnSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trim whitespace from the canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;

    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        // Check if pixel is not white
        if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX <= minX || maxY <= minY) return; // Empty canvas

    const pad = 10;
    const trimW = maxX - minX + pad * 2;
    const trimH = maxY - minY + pad * 2;

    const trimCanvas = document.createElement('canvas');
    trimCanvas.width = trimW;
    trimCanvas.height = trimH;
    const trimCtx = trimCanvas.getContext('2d');
    if (!trimCtx) return;

    // Transparent background
    trimCtx.drawImage(canvas, minX - pad, minY - pad, trimW, trimH, 0, 0, trimW, trimH);

    // Make white pixels transparent
    const trimData = trimCtx.getImageData(0, 0, trimW, trimH);
    for (let i = 0; i < trimData.data.length; i += 4) {
      if (trimData.data[i] > 245 && trimData.data[i + 1] > 245 && trimData.data[i + 2] > 245) {
        trimData.data[i + 3] = 0; // Make transparent
      }
    }
    trimCtx.putImageData(trimData, 0, 0);

    onInsert(trimCanvas.toDataURL('image/png'));
    onClose();
  };

  const insertTypedSignature = () => {
    if (!signatureText.trim()) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fontSize = 48;
    ctx.font = `${fontSize}px ${selectedFont}`;
    const metrics = ctx.measureText(signatureText);
    const textWidth = metrics.width;

    canvas.width = textWidth + 40;
    canvas.height = fontSize + 30;

    // Transparent background, draw text
    ctx.font = `${fontSize}px ${selectedFont}`;
    ctx.fillStyle = penColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(signatureText, 20, canvas.height / 2);

    onInsert(canvas.toDataURL('image/png'));
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onInsert(result);
      onClose();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Insert Signature</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { key: 'draw' as Tab, label: 'Draw', icon: PenTool },
            { key: 'type' as Tab, label: 'Type', icon: Type },
            { key: 'upload' as Tab, label: 'Upload', icon: Upload },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === key
                  ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {tab === 'draw' && (
            <div>
              {/* Pen controls */}
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Color</span>
                  {PEN_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setPenColor(color)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        penColor === color ? 'border-primary-500 scale-110' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Size</span>
                  <select
                    value={penSize}
                    onChange={(e) => setPenSize(Number(e.target.value))}
                    className="h-6 text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-1 text-gray-700 dark:text-gray-300"
                  >
                    {[1, 2, 3, 4, 5].map((s) => (
                      <option key={s} value={s}>{s}px</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={clearCanvas}
                  className="ml-auto text-xs text-gray-500 hover:text-red-500 transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Canvas */}
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg cursor-crosshair"
                style={{ height: 180 }}
              />
              <p className="text-[10px] text-gray-400 mt-1.5">Draw your signature above the line</p>
            </div>
          )}

          {tab === 'type' && (
            <div>
              <input
                type="text"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="Type your name..."
                className="w-full px-4 py-3 text-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
                style={{ fontFamily: selectedFont }}
              />

              <div className="flex items-center gap-3 mb-3">
                <label className="text-xs text-gray-500 dark:text-gray-400">Font</label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="flex-1 h-7 text-xs bg-transparent border border-gray-200 dark:border-gray-600 rounded px-2 text-gray-700 dark:text-gray-300"
                >
                  {SIGNATURE_FONTS.map((f) => (
                    <option key={f.label} value={f.value}>{f.label}</option>
                  ))}
                </select>

                <label className="text-xs text-gray-500 dark:text-gray-400">Color</label>
                <div className="flex items-center gap-1">
                  {PEN_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setPenColor(color)}
                      className={`w-5 h-5 rounded-full border-2 transition-all ${
                        penColor === color ? 'border-primary-500 scale-110' : 'border-gray-300 dark:border-gray-600'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              {signatureText && (
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Preview</p>
                  <p
                    className="text-3xl"
                    style={{ fontFamily: selectedFont, color: penColor }}
                  >
                    {signatureText}
                  </p>
                </div>
              )}
            </div>
          )}

          {tab === 'upload' && (
            <div>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <Upload className="w-8 h-8 text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Click to upload signature image</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, or SVG</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {tab !== 'upload' && (
            <button
              onClick={tab === 'draw' ? insertDrawnSignature : insertTypedSignature}
              disabled={tab === 'type' && !signatureText.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Insert Signature
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
