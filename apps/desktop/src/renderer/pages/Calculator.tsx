import { useState, useEffect } from 'react';
import { Delete, Divide, X, Minus, Plus, Equal, Bookmark, BookmarkCheck, Trash2 } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

type Operation = '+' | '-' | '*' | '/' | null;

interface HistoryEntry {
  expression: string;
  result: string;
}

const SAVED_KEY = 'envoy-calculator-saved';

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [saved, setSaved] = useState<HistoryEntry[]>([]);
  const [memory, setMemory] = useState<number>(0);
  const toast = useToast();

  // Load saved calculations from localStorage
  useEffect(() => {
    try {
      const data = localStorage.getItem(SAVED_KEY);
      if (data) setSaved(JSON.parse(data));
    } catch { /* ignore */ }
  }, []);

  const saveCalculation = (entry: HistoryEntry) => {
    const already = saved.some(s => s.expression === entry.expression && s.result === entry.result);
    if (already) {
      toast.info('Already saved');
      return;
    }
    const updated = [entry, ...saved.slice(0, 19)];
    setSaved(updated);
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
    toast.success('Saved');
  };

  const removeSaved = (index: number) => {
    const updated = saved.filter((_, i) => i !== index);
    setSaved(updated);
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  };

  const clearSaved = () => {
    setSaved([]);
    localStorage.removeItem(SAVED_KEY);
  };

  const clearAll = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const clearEntry = () => {
    setDisplay('0');
  };

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const toggleSign = () => {
    const value = parseFloat(display);
    setDisplay(String(-value));
  };

  const inputPercent = () => {
    const value = parseFloat(display);
    if (previousValue !== null && operation) {
      // Context-aware: 100 + 10% = 110
      setDisplay(String(previousValue * value / 100));
    } else {
      setDisplay(String(value / 100));
    }
  };

  const inputSquare = () => {
    const value = parseFloat(display);
    const result = value * value;
    setHistory((prev) => [
      { expression: `${value}²`, result: String(result) },
      ...prev.slice(0, 9),
    ]);
    setDisplay(String(result));
    setWaitingForOperand(true);
  };

  const inputSqrt = () => {
    const value = parseFloat(display);
    if (value < 0) {
      toast.error('Cannot take square root of negative number');
      return;
    }
    const result = Math.sqrt(value);
    setHistory((prev) => [
      { expression: `√${value}`, result: String(result) },
      ...prev.slice(0, 9),
    ]);
    setDisplay(String(result));
    setWaitingForOperand(true);
  };

  const inputReciprocal = () => {
    const value = parseFloat(display);
    if (value === 0) {
      toast.error('Cannot divide by zero');
      return;
    }
    const result = 1 / value;
    setHistory((prev) => [
      { expression: `1/${value}`, result: String(result) },
      ...prev.slice(0, 9),
    ]);
    setDisplay(String(result));
    setWaitingForOperand(true);
  };

  const performOperation = (nextOperation: Operation) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue;
      let result = 0;

      switch (operation) {
        case '+':
          result = currentValue + inputValue;
          break;
        case '-':
          result = currentValue - inputValue;
          break;
        case '*':
          result = currentValue * inputValue;
          break;
        case '/':
          result = inputValue !== 0 ? currentValue / inputValue : 0;
          break;
      }

      // Add to history if this is an equals operation
      if (nextOperation === null) {
        const operationSymbol = operation === '*' ? '×' : operation === '/' ? '÷' : operation;
        setHistory((prev) => [
          { expression: `${currentValue} ${operationSymbol} ${inputValue}`, result: String(result) },
          ...prev.slice(0, 9),
        ]);
      }

      setDisplay(String(result));
      setPreviousValue(result);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  // Memory functions
  const memoryClear = () => setMemory(0);
  const memoryRecall = () => {
    setDisplay(String(memory));
    setWaitingForOperand(true);
  };
  const memoryAdd = () => setMemory(memory + parseFloat(display));
  const memorySubtract = () => setMemory(memory - parseFloat(display));

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const Button = ({
    children,
    onClick,
    variant = 'default',
    span = 1,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'operator' | 'equals' | 'function' | 'memory';
    span?: number;
  }) => {
    const baseClasses = 'h-14 rounded-lg font-medium text-lg transition-all active:scale-95 flex items-center justify-center';
    const variantClasses = {
      default: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600',
      operator: 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500',
      equals: 'bg-primary-500 text-white hover:bg-primary-600',
      function: 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500 text-sm',
      memory: 'bg-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xs font-normal',
    };

    return (
      <button
        onClick={onClick}
        className={`${baseClasses} ${variantClasses[variant]} ${span === 2 ? 'col-span-2' : ''}`}
      >
        {children}
      </button>
    );
  };

  const hasPanel = history.length > 0 || saved.length > 0;

  return (
    <div className="min-h-full bg-white dark:bg-gray-900">
      <div className="px-4 sm:px-6 md:px-8 pt-4 sm:pt-6 md:pt-8 pb-4">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Calculator</h1>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8">
        <div className={`flex gap-6 ${hasPanel ? 'items-start' : 'justify-center'}`}>
        {/* Calculator */}
        <div className="w-full max-w-sm flex-shrink-0">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
            {/* Display */}
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 mb-4">
              <div className="text-right">
                {previousValue !== null && operation && (
                  <div className="text-sm text-gray-400 dark:text-gray-500 mb-1">
                    {previousValue} {operation === '*' ? '×' : operation === '/' ? '÷' : operation}
                  </div>
                )}
                <div className="text-3xl font-light text-gray-900 dark:text-white truncate">
                  {display}
                </div>
              </div>
            </div>

            {/* Memory buttons */}
            <div className="grid grid-cols-6 gap-1 mb-2">
              <Button onClick={memoryClear} variant="memory">MC</Button>
              <Button onClick={memoryRecall} variant="memory">MR</Button>
              <Button onClick={memoryAdd} variant="memory">M+</Button>
              <Button onClick={memorySubtract} variant="memory">M-</Button>
              <button
                onClick={() => saveCalculation({ expression: 'Value', result: display })}
                className="h-14 text-xs text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 flex items-center justify-center gap-1 transition-colors"
                title="Save current value"
              >
                <Bookmark className="w-3 h-3" />
                Save
              </button>
              <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center justify-center">
                {memory !== 0 && `M: ${memory}`}
              </div>
            </div>

            {/* Buttons grid */}
            <div className="grid grid-cols-4 gap-2">
              {/* Scientific row */}
              <Button onClick={inputPercent} variant="function">%</Button>
              <Button onClick={inputSqrt} variant="function">√</Button>
              <Button onClick={inputSquare} variant="function">x²</Button>
              <Button onClick={inputReciprocal} variant="function">1/x</Button>

              {/* Row 1 */}
              <Button onClick={clearAll} variant="function">AC</Button>
              <Button onClick={clearEntry} variant="function">CE</Button>
              <Button onClick={handleBackspace} variant="function">
                <Delete className="w-5 h-5" />
              </Button>
              <Button onClick={() => performOperation('/')} variant="operator">
                <Divide className="w-5 h-5" />
              </Button>

              {/* Row 2 */}
              <Button onClick={() => inputDigit('7')}>7</Button>
              <Button onClick={() => inputDigit('8')}>8</Button>
              <Button onClick={() => inputDigit('9')}>9</Button>
              <Button onClick={() => performOperation('*')} variant="operator">
                <X className="w-5 h-5" />
              </Button>

              {/* Row 3 */}
              <Button onClick={() => inputDigit('4')}>4</Button>
              <Button onClick={() => inputDigit('5')}>5</Button>
              <Button onClick={() => inputDigit('6')}>6</Button>
              <Button onClick={() => performOperation('-')} variant="operator">
                <Minus className="w-5 h-5" />
              </Button>

              {/* Row 4 */}
              <Button onClick={() => inputDigit('1')}>1</Button>
              <Button onClick={() => inputDigit('2')}>2</Button>
              <Button onClick={() => inputDigit('3')}>3</Button>
              <Button onClick={() => performOperation('+')} variant="operator">
                <Plus className="w-5 h-5" />
              </Button>

              {/* Row 5 */}
              <Button onClick={toggleSign}>+/-</Button>
              <Button onClick={() => inputDigit('0')}>0</Button>
              <Button onClick={inputDecimal}>.</Button>
              <Button onClick={() => performOperation(null)} variant="equals">
                <Equal className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Side Panel - History & Saved */}
        {hasPanel && (
          <div className="flex-1 min-w-0 max-w-md space-y-6">
            {/* History */}
            {history.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    History
                  </h2>
                  <button
                    onClick={() => setHistory([])}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1.5">
                  {history.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg group"
                    >
                      <div
                        onClick={() => {
                          setDisplay(entry.result);
                          setWaitingForOperand(true);
                        }}
                        className="flex-1 flex items-center justify-between cursor-pointer hover:opacity-75 transition-opacity min-w-0"
                      >
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{entry.expression}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white ml-2 flex-shrink-0">= {entry.result}</span>
                      </div>
                      <button
                        onClick={() => saveCalculation(entry)}
                        className="p-1 text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        title="Save calculation"
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Saved Calculations */}
            {saved.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    Saved
                  </h2>
                  <button
                    onClick={clearSaved}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    Clear all
                  </button>
                </div>
                <div className="space-y-1.5">
                  {saved.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2.5 bg-primary-50 dark:bg-[var(--primary-tint-10)] rounded-lg group"
                    >
                      <div
                        onClick={() => {
                          setDisplay(entry.result);
                          setWaitingForOperand(true);
                        }}
                        className="flex-1 flex items-center justify-between cursor-pointer hover:opacity-75 transition-opacity min-w-0"
                      >
                        <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{entry.expression}</span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white ml-2 flex-shrink-0">= {entry.result}</span>
                      </div>
                      <button
                        onClick={() => removeSaved(i)}
                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
