import React, { useState, useEffect, MouseEvent, useRef } from 'react';

interface HistoryItem {
  expr: string;
  result: string;
}

const AdBanner = () => {
  const adRef = useRef<HTMLModElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;

    const timer = setTimeout(() => {
      if (!adRef.current) return;
      
      // Check if already processed by AdSense
      if (adRef.current.getAttribute('data-adsbygoogle-status') === 'processed') {
        initialized.current = true;
        return;
      }

      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        initialized.current = true;
      } catch (e) {
        console.error("AdSense error", e);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="w-full flex flex-col items-center bg-[#0c0c12] border-b border-white/5 py-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Sponsored</span>
      <div className="w-full flex justify-center overflow-hidden" style={{ minHeight: '90px' }}>
        <ins ref={adRef}
             className="adsbygoogle"
             style={{ display: 'block', width: '100%', maxWidth: '728px', height: '90px' }}
             data-ad-client="ca-pub-9185302217443888"
             data-ad-slot="9959869898"
             data-ad-format="horizontal"
             data-full-width-responsive="true"></ins>
      </div>
    </div>
  );
};

class ErrorBoundary extends (React.Component as any) {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("App Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[#0c0c12] text-white p-8 text-center">
          <h1 className="text-2xl font-bold mb-4 text-[#ff6b6b]">Something went wrong</h1>
          <p className="text-gray-400 mb-8">The application encountered an unexpected error.</p>
          <button 
            className="px-6 py-3 bg-[#c9ff47] text-black font-bold rounded-full"
            onClick={() => window.location.reload()}
          >
            Restart Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <Calculator />
    </ErrorBoundary>
  );
}

function Calculator() {
  const [input, setInput] = useState('0');
  const [prevExpr, setPrevExpr] = useState('');
  const [openBrackets, setOpenBrackets] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [justEvaled, setJustEvaled] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const [isSidebarClosed, setIsSidebarClosed] = useState(true); // Closed by default for full screen
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('calcHv4') || '[]');
      setHistory(saved);
    } catch (e) {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, [isLightMode]);

  const calc = (expr: string) => {
    try {
      let e = expr
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/(\d+\.?\d*|\))\²/g, '($1**2)')
        .replace(/√\(/g, 'Math.sqrt(')
        .replace(/√(\d+\.?\d*)/g, 'Math.sqrt($1)');
      // eslint-disable-next-line no-new-func
      const r = Function('"use strict";return(' + e + ')')();
      if (!isFinite(r)) return null;
      return +r.toPrecision(14);
    } catch (err) {
      return null;
    }
  };

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1e12 || (n !== 0 && Math.abs(n) < 1e-9)) return n.toExponential(6);
    const s = n.toString();
    return s.length > 14 ? n.toExponential(6) : s;
  };

  useEffect(() => {
    const ops = ['+', '−', '×', '÷'];
    const last = input.slice(-1);
    if (input !== '0' && input !== 'Error' && !justEvaled && !ops.includes(last) && last !== '.' && last !== '(') {
      let e = input;
      let ob = openBrackets;
      while (ob-- > 0) e += ')';
      const r = calc(e);
      if (r !== null && fmt(r) !== input) {
        setPreview('= ' + fmt(r));
      } else {
        setPreview(null);
      }
    } else {
      setPreview(null);
    }
  }, [input, justEvaled, openBrackets]);

  const saveHist = (newHist: HistoryItem[]) => {
    try {
      localStorage.setItem('calcHv4', JSON.stringify(newHist.slice(0, 50)));
    } catch (e) {}
  };

  const addHist = (expr: string, result: string) => {
    const newHist = [{ expr, result }, ...history].slice(0, 50);
    setHistory(newHist);
    setActiveIdx(0);
    saveHist(newHist);
  };

  const act = (action: string, value: string = '') => {
    const ops = ['+', '−', '×', '÷'];
    const last = input.slice(-1);

    let newInput = input;
    let newPrevExpr = prevExpr;
    let newOpenBrackets = openBrackets;
    let newJustEvaled = justEvaled;

    switch (action) {
      case 'num':
        if (justEvaled) {
          newInput = value;
          newPrevExpr = '';
          newOpenBrackets = 0;
          newJustEvaled = false;
        } else if (input === '0' || input === 'Error') {
          newInput = value;
        } else {
          newInput += value;
        }
        break;

      case 'dot':
        if (justEvaled) {
          newInput = '0.';
          newJustEvaled = false;
        } else {
          const seg = input.split(/[\+\-×÷(]/).pop() || '';
          if (!seg.includes('.')) {
            if (input === '0' || ops.includes(last) || last === '(') newInput += '0.';
            else newInput += '.';
          }
        }
        break;

      case 'op':
        newJustEvaled = false;
        if (ops.includes(last)) newInput = input.slice(0, -1) + value;
        else if (last !== '(' && input !== '0' && input !== 'Error') newInput += value;
        break;

      case 'bracket':
        newJustEvaled = false;
        if (openBrackets > 0 && !ops.includes(last) && last !== '(') {
          newInput += ')';
          newOpenBrackets--;
        } else {
          if (input === '0' || input === 'Error') newInput = '(';
          else if (!ops.includes(last) && last !== '(') newInput += '×(';
          else newInput += '(';
          newOpenBrackets++;
        }
        break;

      case 'percent':
        if (input !== '0' && input !== 'Error') {
          const r = calc(input);
          if (r !== null) newInput = fmt(r / 100);
        }
        newJustEvaled = false;
        break;

      case 'sqrt':
        newJustEvaled = false;
        if (input === '0' || input === 'Error') newInput = '√(';
        else if (!ops.includes(last) && last !== '(') newInput += '×√(';
        else newInput += '√(';
        newOpenBrackets++;
        break;

      case 'power':
        if (input !== '0' && input !== 'Error' && !ops.includes(last) && last !== '(') newInput += '²';
        newJustEvaled = false;
        break;

      case 'toggle':
        if (input !== '0' && input !== 'Error') {
          if (input.startsWith('-(')) newInput = input.slice(2, -1);
          else if (input.startsWith('-')) newInput = input.slice(1);
          else newInput = '-(' + input + ')';
        }
        break;

      case 'backspace':
        newJustEvaled = false;
        if (input === 'Error' || input.length <= 1) {
          newInput = '0';
          newOpenBrackets = 0;
        } else {
          const rm = input.slice(-1);
          newInput = input.slice(0, -1);
          if (rm === '(') newOpenBrackets = Math.max(0, openBrackets - 1);
          if (rm === ')') newOpenBrackets++;
        }
        break;

      case 'clear':
        newInput = '0';
        newPrevExpr = '';
        newOpenBrackets = 0;
        newJustEvaled = false;
        break;

      case 'equals':
        if (input === '0' || input === 'Error') return;
        let expr = input;
        
        // Robust cleanup: trim trailing operators and dots
        const tOps = ['+', '−', '×', '÷', '.'];
        while (expr.length > 0 && tOps.includes(expr.slice(-1))) {
          expr = expr.slice(0, -1);
        }
        
        if (!expr || expr === '(') {
          newInput = '0';
          newOpenBrackets = 0;
          break;
        }

        let toClose = openBrackets;
        // Count actual open brackets in the cleaned expression
        const actualOpen = (expr.match(/\(/g) || []).length;
        const actualClosed = (expr.match(/\)/g) || []).length;
        const needed = Math.max(0, actualOpen - actualClosed);
        
        for (let i = 0; i < needed; i++) expr += ')';
        
        const result = calc(expr);
        if (result !== null) {
          const resStr = fmt(result);
          newPrevExpr = expr + ' =';
          newInput = resStr;
          addHist(expr, resStr);
          newOpenBrackets = 0;
          newJustEvaled = true;
        } else {
          newInput = 'Error';
        }
        break;
    }

    setInput(newInput);
    setPrevExpr(newPrevExpr);
    setOpenBrackets(newOpenBrackets);
    setJustEvaled(newJustEvaled);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ('0123456789'.includes(e.key)) act('num', e.key);
      else if (e.key === '.') act('dot');
      else if (e.key === '+') act('op', '+');
      else if (e.key === '-') act('op', '−');
      else if (e.key === '*') act('op', '×');
      else if (e.key === '/') act('op', '÷');
      else if (e.key === 'Enter' || e.key === '=') act('equals');
      else if (e.key === 'Backspace') act('backspace');
      else if (e.key === 'Escape') act('clear');
      else if (e.key === '%') act('percent');
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [input, prevExpr, openBrackets, justEvaled]);

  const handleBtnClick = (e: MouseEvent<HTMLButtonElement>, action: string, value: string = '') => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    
    const x = e.clientX ? e.clientX - rect.left : rect.width / 2;
    const y = e.clientY ? e.clientY - rect.top : rect.height / 2;

    const r = document.createElement('span');
    r.className = 'ripple';
    r.style.width = r.style.height = `${size}px`;
    r.style.left = `${x - size / 2}px`;
    r.style.top = `${y - size / 2}px`;
    
    btn.appendChild(r);
    setTimeout(() => { if (r.parentNode) r.remove(); }, 600);
    act(action, value);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0c0c12]">
      {/* AdSense Banner at the Very Top */}
      <AdBanner />

      <div className="app-container flex-1 overflow-hidden">
        {/* SIDEBAR OVERLAY */}
        {!isSidebarClosed && (
          <div 
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarClosed(true)}
          />
        )}
        
        <aside className={`sidebar ${isSidebarClosed ? 'closed' : ''}`} id="sidebar">
          <div className="sb-top">
            <button className="icon-btn" onClick={() => setIsSidebarClosed(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <span className="sb-brand">History</span>
          </div>

          <button className="new-calc-btn" onClick={() => { act('clear'); setIsSidebarClosed(true); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span className="nc-txt">New Calculation</span>
          </button>

          <div className="sb-label">Recent</div>

          <div className="hist-scroll">
            {history.length === 0 && <div className="hist-empty">No history yet</div>}
            {history.map((h, i) => (
              <div 
                key={i} 
                className={`hist-item ${i === activeIdx ? 'active' : ''}`}
                onClick={() => {
                  setInput(h.result);
                  setPrevExpr(h.expr + ' =');
                  setOpenBrackets(0);
                  setJustEvaled(true);
                  setActiveIdx(i);
                  setIsSidebarClosed(true);
                }}
              >
                <div className="hi-icon">=</div>
                <div className="hi-info">
                  <div className="hi-expr">{h.expr}</div>
                  <div className="hi-res">{h.result}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="sb-bottom">
            <button className="clear-btn" onClick={() => {
              if (window.confirm('Clear all history?')) {
                setHistory([]);
                setActiveIdx(null);
                saveHist([]);
              }
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
              <span className="cl-txt">Clear History</span>
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main">
          {/* Display */}
          <div className="display-panel">
            <div className="dp-top">
              <button className="menu-btn" onClick={() => setIsSidebarClosed(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
                History
              </button>
              <button className="theme-btn" onClick={() => setIsLightMode(!isLightMode)}>
                {isLightMode ? 'Dark' : 'Light'}
              </button>
            </div>
            <div className="dp-display">
              <div className="prev-expr">{prevExpr}</div>
              <div className={`preview ${preview ? 'show' : ''}`}>{preview}</div>
              <div className={`main-val ${input.length > 18 ? 'sm' : input.length > 12 ? 'md' : ''}`}>
                {input}
              </div>
              <div className="accent-line"></div>
            </div>
          </div>

          {/* Buttons */}
          <div className="buttons-panel">
            <div className="btn-row">
              <button className="btn clear" onClick={(e) => handleBtnClick(e, 'clear')}>C</button>
              <button className="btn op" onClick={(e) => handleBtnClick(e, 'bracket')}>(  )</button>
              <button className="btn aop" onClick={(e) => handleBtnClick(e, 'percent')}>%</button>
              <button className="btn op" onClick={(e) => handleBtnClick(e, 'op', '÷')}>÷</button>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '7')}>7</button>
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '8')}>8</button>
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '9')}>9</button>
              <button className="btn op" onClick={(e) => handleBtnClick(e, 'op', '×')}>×</button>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '4')}>4</button>
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '5')}>5</button>
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '6')}>6</button>
              <button className="btn op" onClick={(e) => handleBtnClick(e, 'op', '−')}>−</button>
            </div>
            <div className="btn-row">
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '1')}>1</button>
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '2')}>2</button>
              <button className="btn" onClick={(e) => handleBtnClick(e, 'num', '3')}>3</button>
              <button className="btn op" onClick={(e) => handleBtnClick(e, 'op', '+')}>+</button>
            </div>
            <div className="btn-row">
              <button className="btn aop" onClick={(e) => handleBtnClick(e, 'sqrt')}>√</button>
              <button className="btn zero" onClick={(e) => handleBtnClick(e, 'num', '0')}>0</button>
              <button className="btn" onClick={(e) => handleBtnClick(e, 'dot')}>.</button>
              <button className="btn aop" onClick={(e) => handleBtnClick(e, 'power')}>x²</button>
            </div>
            <div className="btn-row">
              <button className="btn aop" onClick={(e) => handleBtnClick(e, 'toggle')}>±</button>
              <button className="btn op" onClick={(e) => handleBtnClick(e, 'backspace')}>⌫</button>
              <button className="btn eq" onClick={(e) => handleBtnClick(e, 'equals')}>=</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
