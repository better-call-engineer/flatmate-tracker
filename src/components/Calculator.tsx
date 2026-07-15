'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Delete, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  onClose: () => void;
}

export default function Calculator({ onClose }: Props) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const containerMouseDownRef = useRef(false);

  // Handle keyboard inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { key } = e;
      if (key >= '0' && key <= '9') {
        handlePress(key);
      } else if (['+', '-', '*', '/'].includes(key)) {
        handlePress(key);
      } else if (key === '.' || key === ',') {
        handlePress('.');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEvaluate();
      } else if (key === 'Backspace') {
        handleDelete();
      } else if (key === 'Escape') {
        onClose();
      } else if (key.toLowerCase() === 'c') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [input]);

  const handlePress = (value: string) => {
    setInput(prev => {
      // Prevent consecutive operators
      const lastChar = prev.slice(-1);
      if (['+', '-', '*', '/'].includes(value) && ['+', '-', '*', '/'].includes(lastChar)) {
        return prev.slice(0, -1) + value;
      }
      return prev + value;
    });
  };

  const handleClear = () => {
    setInput('');
    setResult('');
  };

  const handleDelete = () => {
    setInput(prev => prev.slice(0, -1));
  };

  const handleEvaluate = () => {
    if (!input) return;
    try {
      // Replace symbols for evaluation if necessary, but standard JavaScript eval uses +, -, *, /
      // Sanitizing input to only allow mathematical expressions
      const sanitized = input.replace(/[^0-9+\-*/().]/g, '');
      // Evaluate sanitised input safely
      const evalResult = new Function(`return ${sanitized}`)();
      if (evalResult === undefined || isNaN(evalResult) || !isFinite(evalResult)) {
        setResult('Error');
      } else {
        setResult(String(Math.round(evalResult * 100) / 100));
      }
    } catch {
      setResult('Error');
    }
  };

  const handleCopy = () => {
    const valToCopy = result || input;
    if (!valToCopy || valToCopy === 'Error') return;
    navigator.clipboard.writeText(valToCopy);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const buttons = [
    { label: 'C', onClick: handleClear, type: 'clear' },
    { label: '(', onClick: () => handlePress('('), type: 'op' },
    { label: ')', onClick: () => handlePress(')'), type: 'op' },
    { label: '/', onClick: () => handlePress('/'), type: 'op' },

    { label: '7', onClick: () => handlePress('7'), type: 'num' },
    { label: '8', onClick: () => handlePress('8'), type: 'num' },
    { label: '9', onClick: () => handlePress('9'), type: 'num' },
    { label: '*', onClick: () => handlePress('*'), type: 'op' },

    { label: '4', onClick: () => handlePress('4'), type: 'num' },
    { label: '5', onClick: () => handlePress('5'), type: 'num' },
    { label: '6', onClick: () => handlePress('6'), type: 'num' },
    { label: '-', onClick: () => handlePress('-'), type: 'op' },

    { label: '1', onClick: () => handlePress('1'), type: 'num' },
    { label: '2', onClick: () => handlePress('2'), type: 'num' },
    { label: '3', onClick: () => handlePress('3'), type: 'num' },
    { label: '+', onClick: () => handlePress('+'), type: 'op' },

    { label: '0', onClick: () => handlePress('0'), type: 'num' },
    { label: '.', onClick: () => handlePress('.'), type: 'num' },
    { label: '⌫', onClick: handleDelete, type: 'delete' },
    { label: '=', onClick: handleEvaluate, type: 'equal' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onMouseDown={e => { containerMouseDownRef.current = e.target === e.currentTarget; }}
      onClick={e => { if (e.target === e.currentTarget && containerMouseDownRef.current) onClose(); }}
    >
      <div
        className="w-full max-w-[320px] rounded-3xl p-5 modal-content space-y-4 shadow-2xl relative"
        style={{
          background: '#0d1220',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 40px rgba(124,58,237,0.05)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Calculator</span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-200 bg-white/5 border border-white/5 hover:border-white/10 active:scale-95 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Display Screen */}
        <div
          className="rounded-2xl p-4 flex flex-col justify-end items-end min-h-[100px] space-y-1 relative group"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          <div className="text-sm text-slate-400 font-mono tracking-tight break-all max-w-full truncate mb-1">
            {input || '0'}
          </div>
          <div className="text-3xl font-extrabold text-white font-mono tracking-tight break-all max-w-full">
            {result || '0'}
          </div>

          {(result || input) && (
            <button
              onClick={handleCopy}
              className="absolute top-2 left-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200"
              title="Copy result"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>
          )}
        </div>

        {/* Numpad buttons grid */}
        <div className="grid grid-cols-4 gap-2">
          {buttons.map((btn, idx) => {
            let bg = 'rgba(255,255,255,0.03)';
            let color = '#f1f5f9';
            let border = '1px solid rgba(255,255,255,0.06)';

            if (btn.type === 'op') {
              bg = 'rgba(124,58,237,0.08)';
              color = '#a78bfa';
              border = '1px solid rgba(124,58,237,0.15)';
            } else if (btn.type === 'clear') {
              bg = 'rgba(244,63,94,0.08)';
              color = '#fda4af';
              border = '1px solid rgba(244,63,94,0.15)';
            } else if (btn.type === 'delete') {
              bg = 'rgba(245,158,11,0.08)';
              color = '#fde047';
              border = '1px solid rgba(245,158,11,0.15)';
            } else if (btn.type === 'equal') {
              bg = 'linear-gradient(135deg, #7c3aed, #5b21b6)';
              color = '#ffffff';
              border = '1px solid transparent';
            }

            return (
              <button
                key={idx}
                onClick={btn.onClick}
                className="h-12 rounded-2xl font-bold font-mono text-base flex items-center justify-center transition-all duration-100 hover:scale-[1.03] active:scale-95"
                style={{
                  background: bg,
                  color,
                  border,
                  boxShadow: btn.type === 'equal' ? '0 4px 12px rgba(124,58,237,0.3)' : 'none',
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
