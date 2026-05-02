// Scientific calculator logic
// - Builds an expression string and evaluates it with a custom safe parser
// - Supports: + - * / ^, parentheses, unary minus, factorial (n!)
// - Functions: sin, cos, tan, asin, acos, atan, ln, log, sqrt, exp
// - Constants: pi, e
// - Angle modes: DEG / RAD
// - Memory: MC, MR, M+, M-

(function () {
  'use strict';

  const els = {
    expression: document.getElementById('expression'),
    result: document.getElementById('result'),
    angleMode: document.getElementById('angleMode'),
    secondMode: document.getElementById('secondMode'),
    memoryIndicator: document.getElementById('memoryIndicator'),
    keys: document.getElementById('keys'),
  };

  const state = {
    tokens: [],          // array of strings building the current expression
    lastResult: null,    // last numeric result (for chaining after =)
    justEvaluated: false,
    angleMode: 'DEG',    // 'DEG' or 'RAD'
    second: false,       // 2nd function shift
    memory: 0,
    hasMemory: false,
  };

  // ---------- Display ----------

  // Convert internal token list to a human-friendly string.
  function tokensToDisplay(tokens) {
    return tokens
      .join('')
      .replace(/\*/g, '×')
      .replace(/\//g, '÷')
      .replace(/-/g, '−')
      .replace(/\bpi\b/g, 'π');
  }

  function formatNumber(n) {
    if (n === null || n === undefined || Number.isNaN(n)) return 'Error';
    if (!Number.isFinite(n)) return n > 0 ? '∞' : '−∞';
    // Avoid floating point noise; up to 12 significant digits.
    if (n === 0) return '0';
    const abs = Math.abs(n);
    if (abs >= 1e12 || abs < 1e-6) {
      return n.toExponential(8).replace('+', '');
    }
    let s = parseFloat(n.toPrecision(12)).toString();
    return s;
  }

  function render() {
    els.expression.textContent = tokensToDisplay(state.tokens);
    if (state.justEvaluated) {
      els.result.textContent = formatNumber(state.lastResult);
    } else if (state.tokens.length === 0) {
      els.result.textContent = '0';
    } else {
      // Live preview if possible
      try {
        const v = evaluateTokens(state.tokens, { allowPartial: true });
        if (v !== null && Number.isFinite(v)) {
          els.result.textContent = formatNumber(v);
        }
      } catch (_) {
        // leave previous result on screen
      }
    }
    els.angleMode.textContent = state.angleMode;
    els.secondMode.classList.toggle('hidden', !state.second);
    els.memoryIndicator.classList.toggle('hidden', !state.hasMemory);
  }

  // ---------- Token helpers ----------

  function lastToken() {
    return state.tokens.length ? state.tokens[state.tokens.length - 1] : '';
  }

  function isDigitToken(t) {
    return typeof t === 'string' && /^[0-9.]+$/.test(t);
  }

  function isOperator(t) {
    return t === '+' || t === '-' || t === '*' || t === '/' || t === '^';
  }

  function startFreshIfNeeded() {
    if (state.justEvaluated) {
      state.tokens = [];
      state.justEvaluated = false;
    }
  }

  // ---------- Actions ----------

  function inputDigit(d) {
    startFreshIfNeeded();
    const last = lastToken();
    if (isDigitToken(last)) {
      state.tokens[state.tokens.length - 1] = last + d;
    } else {
      state.tokens.push(d);
    }
  }

  function inputDot() {
    startFreshIfNeeded();
    const last = lastToken();
    if (isDigitToken(last)) {
      if (!last.includes('.')) {
        state.tokens[state.tokens.length - 1] = last + '.';
      }
    } else {
      state.tokens.push('0.');
    }
  }

  function inputOperator(op) {
    if (state.justEvaluated && state.lastResult !== null) {
      // Continue from previous result
      state.tokens = [formatNumber(state.lastResult)];
      state.justEvaluated = false;
    }
    if (state.tokens.length === 0) {
      if (op === '-') {
        state.tokens.push('-');
        return;
      }
      // Operators other than minus need a left operand
      state.tokens.push('0', op);
      return;
    }
    const last = lastToken();
    if (isOperator(last)) {
      // Replace the existing trailing operator
      state.tokens[state.tokens.length - 1] = op;
    } else if (last === '(') {
      if (op === '-') state.tokens.push('-');
    } else {
      state.tokens.push(op);
    }
  }

  function inputParen(p) {
    startFreshIfNeeded();
    const last = lastToken();
    if (p === '(') {
      // Implicit multiplication: 2( -> 2*(
      if (isDigitToken(last) || last === ')' || last === 'pi' || last === 'e') {
        state.tokens.push('*');
      }
      state.tokens.push('(');
    } else {
      // Only close if there is something to close and last isn't an operator/'('
      const opens = state.tokens.filter(t => t === '(').length;
      const closes = state.tokens.filter(t => t === ')').length;
      if (opens > closes && last && !isOperator(last) && last !== '(') {
        state.tokens.push(')');
      }
    }
  }

  function inputFunction(name) {
    startFreshIfNeeded();
    const last = lastToken();
    if (isDigitToken(last) || last === ')' || last === 'pi' || last === 'e') {
      state.tokens.push('*');
    }
    state.tokens.push(name, '(');
  }

  function inputConstant(name) {
    startFreshIfNeeded();
    const last = lastToken();
    if (isDigitToken(last) || last === ')' || last === 'pi' || last === 'e') {
      state.tokens.push('*');
    }
    state.tokens.push(name);
  }

  function inputFactorial() {
    startFreshIfNeeded();
    const last = lastToken();
    if (isDigitToken(last) || last === ')' || last === 'pi' || last === 'e' || last === '!') {
      state.tokens.push('!');
    }
  }

  function inputSquare() {
    startFreshIfNeeded();
    const last = lastToken();
    if (isDigitToken(last) || last === ')' || last === 'pi' || last === 'e' || last === '!') {
      state.tokens.push('^', '2');
    }
  }

  function negate() {
    // Toggle sign of the most recent number literal if possible,
    // otherwise wrap whole expression.
    if (state.justEvaluated && state.lastResult !== null) {
      state.lastResult = -state.lastResult;
      state.tokens = [formatNumber(state.lastResult)];
      return;
    }
    // Find last contiguous numeric token
    for (let i = state.tokens.length - 1; i >= 0; i--) {
      const t = state.tokens[i];
      if (isDigitToken(t)) {
        // Check what's before it
        const prev = i > 0 ? state.tokens[i - 1] : '';
        if (prev === '-' && (i === 1 || isOperator(state.tokens[i - 2]) || state.tokens[i - 2] === '(')) {
          // Remove leading minus
          state.tokens.splice(i - 1, 1);
        } else {
          state.tokens.splice(i, 0, '-');
        }
        return;
      }
      if (isOperator(t) || t === '(' || t === ')') break;
    }
    // No numeric tail; insert -( ... or just -
    if (state.tokens.length === 0) state.tokens.push('-');
  }

  function percent() {
    // Convert most recent number into number/100
    for (let i = state.tokens.length - 1; i >= 0; i--) {
      if (isDigitToken(state.tokens[i])) {
        const val = parseFloat(state.tokens[i]);
        state.tokens[i] = formatNumber(val / 100);
        return;
      }
      if (isOperator(state.tokens[i]) || state.tokens[i] === '(' || state.tokens[i] === ')') break;
    }
  }

  function backspace() {
    if (state.justEvaluated) {
      // After equals, backspace clears the staged result
      state.tokens = [];
      state.justEvaluated = false;
      state.lastResult = null;
      return;
    }
    if (state.tokens.length === 0) return;
    const last = lastToken();
    if (isDigitToken(last) && last.length > 1) {
      state.tokens[state.tokens.length - 1] = last.slice(0, -1);
    } else {
      state.tokens.pop();
    }
  }

  function clearAll() {
    state.tokens = [];
    state.lastResult = null;
    state.justEvaluated = false;
  }

  function equals() {
    if (state.tokens.length === 0) return;
    try {
      const v = evaluateTokens(state.tokens, { allowPartial: false });
      if (v === null || !Number.isFinite(v)) {
        els.result.textContent = 'Error';
        return;
      }
      state.lastResult = v;
      state.justEvaluated = true;
    } catch (e) {
      els.result.textContent = 'Error';
    }
  }

  function memoryAction(kind) {
    // Use currently displayed result (or live eval) as the operand
    let current = 0;
    try {
      current = evaluateTokens(state.tokens, { allowPartial: true });
      if (current === null || !Number.isFinite(current)) current = state.lastResult || 0;
    } catch (_) {
      current = state.lastResult || 0;
    }
    if (kind === 'mc') {
      state.memory = 0;
      state.hasMemory = false;
    } else if (kind === 'mr') {
      startFreshIfNeeded();
      const last = lastToken();
      if (isDigitToken(last) || last === ')' || last === 'pi' || last === 'e') {
        state.tokens.push('*');
      }
      state.tokens.push(formatNumber(state.memory));
    } else if (kind === 'mplus') {
      state.memory += current || 0;
      state.hasMemory = state.memory !== 0;
    } else if (kind === 'mminus') {
      state.memory -= current || 0;
      state.hasMemory = state.memory !== 0;
    }
  }

  function toggleAngle() {
    state.angleMode = state.angleMode === 'DEG' ? 'RAD' : 'DEG';
  }

  function toggleSecond() {
    state.second = !state.second;
    // Swap labels for trig and log functions
    document.querySelectorAll('[data-func]').forEach(btn => {
      const f = btn.getAttribute('data-func');
      const map = state.second
        ? { sin: 'sin⁻¹', cos: 'cos⁻¹', tan: 'tan⁻¹', ln: 'eˣ', log: '10ˣ', sqrt: 'x³' }
        : { sin: 'sin', cos: 'cos', tan: 'tan', ln: 'ln', log: 'log', sqrt: '√' };
      if (map[f]) btn.textContent = map[f];
    });
  }

  function applyFunction(name) {
    // Map 2nd-mode aliases to actual function applied
    if (state.second) {
      if (name === 'sin') return inputFunction('asin');
      if (name === 'cos') return inputFunction('acos');
      if (name === 'tan') return inputFunction('atan');
      if (name === 'ln')  return inputFunction('exp');
      if (name === 'log') {
        // 10^x — wrap next number, but easiest: insert 10^(
        startFreshIfNeeded();
        const last = lastToken();
        if (isDigitToken(last) || last === ')' || last === 'pi' || last === 'e') {
          state.tokens.push('*');
        }
        state.tokens.push('10', '^', '(');
        return;
      }
      if (name === 'sqrt') {
        // x³: append ^3 to most recent value if possible, else open cube
        const last = lastToken();
        if (isDigitToken(last) || last === ')' || last === 'pi' || last === 'e' || last === '!') {
          state.tokens.push('^', '3');
          return;
        }
      }
    }
    inputFunction(name);
  }

  // ---------- Parser / evaluator ----------
  // Recursive-descent parser over the token array.
  // Grammar:
  //   expr    := term (('+'|'-') term)*
  //   term    := factor (('*'|'/') factor)*
  //   factor  := unary ('^' factor)?      (right-assoc)
  //   unary   := ('-'|'+') unary | postfix
  //   postfix := primary ('!')*
  //   primary := number | constant | '(' expr ')' | func '(' expr ')'

  function evaluateTokens(tokens, opts) {
    const allowPartial = !!(opts && opts.allowPartial);
    if (tokens.length === 0) return null;

    // Sanitize trailing partials when computing live preview
    let working = tokens.slice();
    if (allowPartial) {
      // Drop trailing operators / open-only states
      while (working.length) {
        const last = working[working.length - 1];
        if (isOperator(last) || last === '(' ||
            last === 'sin' || last === 'cos' || last === 'tan' ||
            last === 'asin' || last === 'acos' || last === 'atan' ||
            last === 'ln' || last === 'log' || last === 'sqrt' || last === 'exp') {
          working.pop();
        } else if (isDigitToken(last) && (last === '.' || last.endsWith('.'))) {
          // tolerate
          break;
        } else break;
      }
      if (working.length === 0) return null;
      // Auto-close any unmatched parens
      const opens = working.filter(t => t === '(').length;
      const closes = working.filter(t => t === ')').length;
      for (let i = 0; i < opens - closes; i++) working.push(')');
    }

    let pos = 0;
    function peek() { return working[pos]; }
    function consume(expected) {
      const t = working[pos];
      if (expected !== undefined && t !== expected) {
        throw new Error('Expected ' + expected + ' got ' + t);
      }
      pos++;
      return t;
    }

    function parseExpr() {
      let value = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = consume();
        const rhs = parseTerm();
        value = op === '+' ? value + rhs : value - rhs;
      }
      return value;
    }

    function parseTerm() {
      let value = parseFactor();
      while (peek() === '*' || peek() === '/') {
        const op = consume();
        const rhs = parseFactor();
        value = op === '*' ? value * rhs : value / rhs;
      }
      return value;
    }

    function parseFactor() {
      const value = parseUnary();
      if (peek() === '^') {
        consume('^');
        const rhs = parseFactor(); // right-associative
        return Math.pow(value, rhs);
      }
      return value;
    }

    function parseUnary() {
      if (peek() === '-') { consume('-'); return -parseUnary(); }
      if (peek() === '+') { consume('+'); return parseUnary(); }
      return parsePostfix();
    }

    function parsePostfix() {
      let value = parsePrimary();
      while (peek() === '!') {
        consume('!');
        value = factorial(value);
      }
      return value;
    }

    function parsePrimary() {
      const t = peek();
      if (t === undefined) throw new Error('Unexpected end');
      if (t === '(') {
        consume('(');
        const v = parseExpr();
        consume(')');
        return v;
      }
      if (t === 'pi') { consume(); return Math.PI; }
      if (t === 'e')  { consume(); return Math.E; }
      if (isFunctionName(t)) {
        const name = consume();
        consume('(');
        const arg = parseExpr();
        consume(')');
        return applyMathFunction(name, arg);
      }
      if (isDigitToken(t)) {
        consume();
        const n = parseFloat(t);
        if (Number.isNaN(n)) throw new Error('Bad number ' + t);
        return n;
      }
      throw new Error('Unexpected token ' + t);
    }

    const result = parseExpr();
    if (pos !== working.length) throw new Error('Trailing tokens');
    return result;
  }

  function isFunctionName(t) {
    return t === 'sin' || t === 'cos' || t === 'tan' ||
           t === 'asin' || t === 'acos' || t === 'atan' ||
           t === 'ln' || t === 'log' || t === 'sqrt' || t === 'exp';
  }

  function toRadians(x) { return state.angleMode === 'DEG' ? x * Math.PI / 180 : x; }
  function fromRadians(x) { return state.angleMode === 'DEG' ? x * 180 / Math.PI : x; }

  function applyMathFunction(name, x) {
    switch (name) {
      case 'sin':  return Math.sin(toRadians(x));
      case 'cos':  return Math.cos(toRadians(x));
      case 'tan':  return Math.tan(toRadians(x));
      case 'asin': return fromRadians(Math.asin(x));
      case 'acos': return fromRadians(Math.acos(x));
      case 'atan': return fromRadians(Math.atan(x));
      case 'ln':   return Math.log(x);
      case 'log':  return Math.log10(x);
      case 'sqrt': return Math.sqrt(x);
      case 'exp':  return Math.exp(x);
    }
    throw new Error('Unknown function ' + name);
  }

  function factorial(n) {
    if (n < 0 || !Number.isFinite(n)) return NaN;
    if (Math.floor(n) !== n) {
      // Gamma via Lanczos for non-integers
      return gamma(n + 1);
    }
    if (n > 170) return Infinity;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  // Lanczos approximation for the Gamma function
  function gamma(z) {
    const g = 7;
    const c = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
    ];
    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    }
    z -= 1;
    let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }

  // ---------- Event wiring ----------

  function handleAction(action, btn) {
    switch (action) {
      case 'digit':     inputDigit(btn.getAttribute('data-digit')); break;
      case 'dot':       inputDot(); break;
      case 'op':        inputOperator(btn.getAttribute('data-op')); break;
      case 'paren':     inputParen(btn.getAttribute('data-paren')); break;
      case 'func':      applyFunction(btn.getAttribute('data-func')); break;
      case 'const':     inputConstant(btn.getAttribute('data-const')); break;
      case 'factorial': inputFactorial(); break;
      case 'square':    inputSquare(); break;
      case 'negate':    negate(); break;
      case 'percent':   percent(); break;
      case 'backspace': backspace(); break;
      case 'clear':     clearAll(); break;
      case 'equals':    equals(); break;
      case 'mem':       memoryAction(btn.getAttribute('data-mem')); break;
      case 'toggle-angle':
        toggleAngle();
        return; // angle label updated in render
      case 'toggle-2nd':
        toggleSecond();
        btn.classList.toggle('toggled', state.second);
        break;
    }
    render();
  }

  els.keys.addEventListener('click', function (e) {
    const btn = e.target.closest('button.key');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    if (!action) return;
    handleAction(action, btn);
  });

  // Keyboard support
  document.addEventListener('keydown', function (e) {
    const k = e.key;
    if (/^[0-9]$/.test(k)) { inputDigit(k); render(); e.preventDefault(); return; }
    if (k === '.') { inputDot(); render(); e.preventDefault(); return; }
    if (k === '+' || k === '-' || k === '*' || k === '/' || k === '^') {
      inputOperator(k); render(); e.preventDefault(); return;
    }
    if (k === '(' || k === ')') { inputParen(k); render(); e.preventDefault(); return; }
    if (k === 'Enter' || k === '=') { equals(); render(); e.preventDefault(); return; }
    if (k === 'Backspace') { backspace(); render(); e.preventDefault(); return; }
    if (k === 'Escape') { clearAll(); render(); e.preventDefault(); return; }
    if (k === '%') { percent(); render(); e.preventDefault(); return; }
    if (k === '!') { inputFactorial(); render(); e.preventDefault(); return; }
  });

  // Initial render
  render();
})();
