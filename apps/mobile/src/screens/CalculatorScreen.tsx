import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Op = '+' | '-' | '×' | '÷' | null;

interface CalcState {
  display: string;
  previous: number | null;
  operator: Op;
  overwrite: boolean;
  history: string;
}

const INITIAL: CalcState = {
  display: '0',
  previous: null,
  operator: null,
  overwrite: true,
  history: '',
};

function operate(a: number, b: number, op: Op): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

function formatNumber(n: number): string {
  if (Number.isNaN(n)) return 'Error';
  if (!Number.isFinite(n)) return 'Error';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e12)) {
    return n.toExponential(6);
  }
  const s = n.toString();
  return s.length > 12 ? Number(n.toPrecision(10)).toString() : s;
}

export default function CalculatorScreen() {
  const [state, setState] = useState<CalcState>(INITIAL);

  const inputDigit = (d: string) => {
    setState((prev) => {
      if (prev.overwrite) return { ...prev, display: d, overwrite: false };
      if (prev.display.length >= 12) return prev;
      return { ...prev, display: prev.display === '0' ? d : prev.display + d };
    });
  };

  const inputDot = () => {
    setState((prev) => {
      if (prev.overwrite) return { ...prev, display: '0.', overwrite: false };
      if (prev.display.includes('.')) return prev;
      return { ...prev, display: prev.display + '.' };
    });
  };

  const clearAll = () => setState(INITIAL);

  const toggleSign = () => {
    setState((prev) => {
      if (prev.display === '0') return prev;
      const next = prev.display.startsWith('-')
        ? prev.display.slice(1)
        : '-' + prev.display;
      return { ...prev, display: next };
    });
  };

  const percent = () => {
    setState((prev) => {
      const current = parseFloat(prev.display);
      const next = current / 100;
      return { ...prev, display: formatNumber(next) };
    });
  };

  const applyOp = (op: Op) => {
    setState((prev) => {
      const current = parseFloat(prev.display);
      if (prev.previous !== null && prev.operator !== null && !prev.overwrite) {
        const result = operate(prev.previous, current, prev.operator);
        const formatted = formatNumber(result);
        return {
          display: formatted,
          previous: result,
          operator: op,
          overwrite: true,
          history: `${formatted} ${op ?? ''}`,
        };
      }
      return {
        ...prev,
        previous: current,
        operator: op,
        overwrite: true,
        history: `${formatNumber(current)} ${op ?? ''}`,
      };
    });
  };

  const equals = () => {
    setState((prev) => {
      if (prev.previous === null || prev.operator === null) return prev;
      const current = parseFloat(prev.display);
      const result = operate(prev.previous, current, prev.operator);
      const formatted = formatNumber(result);
      return {
        display: formatted,
        previous: null,
        operator: null,
        overwrite: true,
        history: `${formatNumber(prev.previous)} ${prev.operator} ${formatNumber(current)} =`,
      };
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.displayBox}>
        {state.history ? <Text style={styles.history}>{state.history}</Text> : null}
        <Text style={styles.display} numberOfLines={1} adjustsFontSizeToFit>
          {state.display}
        </Text>
      </View>

      <View style={styles.buttonGrid}>
        <Row>
          <Btn label="AC" variant="fn" onPress={clearAll} />
          <Btn label="±" variant="fn" onPress={toggleSign} />
          <Btn label="%" variant="fn" onPress={percent} />
          <Btn label="÷" variant="op" active={state.operator === '÷'} onPress={() => applyOp('÷')} />
        </Row>
        <Row>
          <Btn label="7" onPress={() => inputDigit('7')} />
          <Btn label="8" onPress={() => inputDigit('8')} />
          <Btn label="9" onPress={() => inputDigit('9')} />
          <Btn label="×" variant="op" active={state.operator === '×'} onPress={() => applyOp('×')} />
        </Row>
        <Row>
          <Btn label="4" onPress={() => inputDigit('4')} />
          <Btn label="5" onPress={() => inputDigit('5')} />
          <Btn label="6" onPress={() => inputDigit('6')} />
          <Btn label="-" variant="op" active={state.operator === '-'} onPress={() => applyOp('-')} />
        </Row>
        <Row>
          <Btn label="1" onPress={() => inputDigit('1')} />
          <Btn label="2" onPress={() => inputDigit('2')} />
          <Btn label="3" onPress={() => inputDigit('3')} />
          <Btn label="+" variant="op" active={state.operator === '+'} onPress={() => applyOp('+')} />
        </Row>
        <Row>
          <Btn label="0" wide onPress={() => inputDigit('0')} />
          <Btn label="." onPress={inputDot} />
          <Btn label="=" variant="op" onPress={equals} />
        </Row>
      </View>
    </View>
  );
}

function Row({ children }: { children: unknown }) {
  return <View style={styles.row}>{children as any}</View>;
}

interface BtnProps {
  label: string;
  onPress: () => void;
  variant?: 'digit' | 'fn' | 'op';
  wide?: boolean;
  active?: boolean;
}

function Btn({ label, onPress, variant = 'digit', wide, active }: BtnProps) {
  const bg =
    variant === 'op'
      ? active
        ? '#1d4ed8'
        : '#3b82f6'
      : variant === 'fn'
      ? '#d1d5db'
      : '#ffffff';
  const color = variant === 'op' ? '#ffffff' : variant === 'fn' ? '#1f2937' : '#111827';
  return (
    <TouchableOpacity
      style={[styles.btn, wide && styles.btnWide, { backgroundColor: bg }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.btnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  displayBox: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'flex-end',
    backgroundColor: '#f9fafb',
  },
  history: { fontSize: 16, color: '#9ca3af', marginBottom: 6 },
  display: { fontSize: 60, fontWeight: '300', color: '#111827' },
  buttonGrid: { flex: 1, padding: 8, backgroundColor: '#f9fafb' },
  row: { flexDirection: 'row', flex: 1 },
  btn: {
    flex: 1,
    margin: 4,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  btnWide: { flex: 2, borderRadius: 40 },
  btnText: { fontSize: 26, fontWeight: '500' },
});
