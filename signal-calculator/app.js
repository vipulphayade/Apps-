const STORAGE_KEYS = {
  history: "signal-calculator-history",
  variables: "signal-calculator-variables",
  lastResult: "signal-calculator-last-result"
};

const FUNCTIONS = {
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  log: Math.log10 ? Math.log10 : (value) => Math.log(value) / Math.LN10,
  ln: Math.log,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan
};

const CONSTANTS = {
  e: Math.E,
  pi: Math.PI
};

const RESERVED_NAMES = new Set([
  ...Object.keys(FUNCTIONS),
  ...Object.keys(CONSTANTS),
  "ans"
]);

const KEYWORD_NAMES = new Set([
  "arguments", "await", "break", "case", "catch", "class", "const", "continue", "debugger",
  "default", "delete", "do", "else", "enum", "eval", "export", "extends", "false", "finally",
  "for", "function", "if", "implements", "import", "in", "instanceof", "interface", "let",
  "new", "null", "package", "private", "protected", "public", "return", "static", "super",
  "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield"
]);

const keypadButtons = [
  { label: "C", action: "clear", className: "utility" },
  { label: "(", action: "insert", value: "(" },
  { label: ")", action: "insert", value: ")" },
  { label: "BS", action: "backspace", className: "utility" },
  { label: "7", action: "insert", value: "7" },
  { label: "8", action: "insert", value: "8" },
  { label: "9", action: "insert", value: "9" },
  { label: "/", action: "insert", value: "/", className: "operator" },
  { label: "4", action: "insert", value: "4" },
  { label: "5", action: "insert", value: "5" },
  { label: "6", action: "insert", value: "6" },
  { label: "*", action: "insert", value: "*", className: "operator" },
  { label: "1", action: "insert", value: "1" },
  { label: "2", action: "insert", value: "2" },
  { label: "3", action: "insert", value: "3" },
  { label: "-", action: "insert", value: "-", className: "operator" },
  { label: "0", action: "insert", value: "0" },
  { label: ".", action: "insert", value: "." },
  { label: "+", action: "insert", value: "+", className: "operator" },
  { label: "=", action: "evaluate", className: "equals" },
  { label: "^", action: "insert", value: "^", className: "operator" },
  { label: "%", action: "insert", value: "%", className: "operator" }
];

const quickFunctions = ["sin(", "cos(", "tan(", "sqrt(", "log(", "ln(", "pow(", "pi", "ans"];

const state = {
  history: loadJson(STORAGE_KEYS.history, []),
  variables: loadJson(STORAGE_KEYS.variables, {}),
  lastResult: loadJson(STORAGE_KEYS.lastResult, 0),
  historyOpen: false
};

const elements = {
  expressionInput: document.getElementById("expressionInput"),
  resultValue: document.getElementById("resultValue"),
  resultMeta: document.getElementById("resultMeta"),
  historyList: document.getElementById("historyList"),
  variablesList: document.getElementById("variablesList"),
  variableForm: document.getElementById("variableForm"),
  variableNameInput: document.getElementById("variableNameInput"),
  variableValueInput: document.getElementById("variableValueInput"),
  functionChips: document.getElementById("functionChips"),
  keypad: document.getElementById("keypad"),
  saveVariableButton: document.getElementById("saveVariableButton"),
  clearInputButton: document.getElementById("clearInputButton"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  clearVariablesButton: document.getElementById("clearVariablesButton"),
  historyToggleButton: document.getElementById("historyToggleButton"),
  closeHistoryButton: document.getElementById("closeHistoryButton"),
  historyDrawer: document.getElementById("historyDrawer")
};

function loadJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
  window.localStorage.setItem(STORAGE_KEYS.variables, JSON.stringify(state.variables));
  window.localStorage.setItem(STORAGE_KEYS.lastResult, JSON.stringify(state.lastResult));
}

function buildScope() {
  return {
    ...FUNCTIONS,
    ...CONSTANTS,
    ...state.variables,
    ans: state.lastResult
  };
}

function sanitizeExpression(expression) {
  const trimmed = expression.trim().replace(/\u03C0/g, "pi");
  if (!trimmed) {
    throw new Error("Enter an expression first.");
  }

  const compact = trimmed.replace(/\s+/g, "");
  const tokenPattern = /([A-Za-z_][A-Za-z0-9_]*|\d*\.\d+(?:e[+-]?\d+)?|\d+(?:\.\d+)?(?:e[+-]?\d+)?|[()+\-*/^%,])/gi;
  const tokens = compact.match(tokenPattern);

  if (!tokens || tokens.join("") !== compact) {
    throw new Error("The expression contains unsupported characters.");
  }

  const allowedNames = new Set(Object.keys(buildScope()));
  return tokens.map((token) => {
    if (/^[A-Za-z_]/.test(token)) {
      if (!allowedNames.has(token)) {
        throw new Error(`Unknown identifier: ${token}`);
      }
      return token;
    }

    return token === "^" ? "**" : token;
  }).join("");
}

function evaluateExpression(expression) {
  const compiled = sanitizeExpression(expression);
  const scope = buildScope();
  const names = Object.keys(scope);
  const values = Object.values(scope);

  try {
    const evaluator = new Function(...names, `"use strict"; return (${compiled});`);
    const result = evaluator(...values);
    if (!Number.isFinite(result)) {
      throw new Error("Expression did not produce a finite number.");
    }
    return result;
  } catch (error) {
    throw new Error(error.message || "Unable to evaluate the expression.");
  }
}

function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const rounded = Number.parseFloat(value.toPrecision(12));
  return rounded.toLocaleString(undefined, { maximumFractionDigits: 12 });
}

function setResult(value, meta, isError = false) {
  elements.resultValue.textContent = value;
  elements.resultMeta.textContent = meta;
  elements.resultMeta.classList.toggle("status-error", isError);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function appendAtCursor(text) {
  const input = elements.expressionInput;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const current = input.value;
  input.value = `${current.slice(0, start)}${text}${current.slice(end)}`;
  const nextPosition = start + text.length;
  input.focus();
  input.setSelectionRange(nextPosition, nextPosition);
}

function backspaceAtCursor() {
  const input = elements.expressionInput;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  const current = input.value;

  if (start !== end) {
    input.value = `${current.slice(0, start)}${current.slice(end)}`;
    input.focus();
    input.setSelectionRange(start, start);
    return;
  }

  if (start === 0) {
    return;
  }

  input.value = `${current.slice(0, start - 1)}${current.slice(end)}`;
  input.focus();
  input.setSelectionRange(start - 1, start - 1);
}

function addHistoryEntry(expression, result, note = "") {
  state.history.unshift({
    id: Date.now(),
    expression,
    result,
    note,
    createdAt: new Date().toLocaleString()
  });
  state.history = state.history.slice(0, 20);
  saveState();
  renderHistory();
}

function storeVariable(name, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error("Variable names must start with a letter or underscore.");
  }

  if (RESERVED_NAMES.has(name) || KEYWORD_NAMES.has(name)) {
    throw new Error(`"${name}" cannot be used as a variable name.`);
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error("Variables must store a valid number.");
  }

  state.variables[name] = numericValue;
  saveState();
  renderVariables();
}

function handleEvaluation() {
  const expression = elements.expressionInput.value.trim();

  try {
    const assignment = expression.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    let result;
    let meta = "Calculated successfully.";

    if (assignment) {
      const [, name, rhs] = assignment;
      result = evaluateExpression(rhs);
      storeVariable(name, result);
      meta = `Stored ${name} for later use.`;
      addHistoryEntry(expression, result, `Saved as ${name}`);
    } else {
      result = evaluateExpression(expression);
      addHistoryEntry(expression, result);
    }

    state.lastResult = result;
    saveState();
    setResult(formatNumber(result), meta);
  } catch (error) {
    setResult("Error", error.message, true);
  }
}

function setHistoryOpen(isOpen) {
  state.historyOpen = isOpen;
  elements.historyDrawer.classList.toggle("open", isOpen);
  elements.historyDrawer.setAttribute("aria-hidden", String(!isOpen));
  elements.historyToggleButton.setAttribute("aria-expanded", String(isOpen));
}

function renderHistory() {
  const container = elements.historyList;
  container.innerHTML = "";

  if (state.history.length === 0) {
    container.innerHTML = '<div class="empty-state">Your recent calculations will appear here.</div>';
    return;
  }

  state.history.forEach((entry) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "history-item";
    card.innerHTML = `
      <p class="history-expression">${escapeHtml(entry.expression)}</p>
      <p class="history-result">${escapeHtml(formatNumber(entry.result))}</p>
      ${entry.note ? `<p class="history-time">${escapeHtml(entry.note)}</p>` : ""}
      <p class="history-time">${escapeHtml(entry.createdAt)}</p>
    `;

    card.addEventListener("click", () => {
      elements.expressionInput.value = entry.expression;
      elements.expressionInput.focus();
      setHistoryOpen(false);
    });

    container.appendChild(card);
  });
}

function renderVariables() {
  const container = elements.variablesList;
  container.innerHTML = "";
  const entries = Object.entries(state.variables);

  if (entries.length === 0) {
    container.innerHTML = '<div class="empty-state">Store values here for reusable calculations.</div>';
    return;
  }

  entries.sort(([a], [b]) => a.localeCompare(b)).forEach(([name, value]) => {
    const chip = document.createElement("div");
    chip.className = "variable-chip";
    chip.innerHTML = `
      <span class="variable-name">${escapeHtml(name)}</span>
      <span class="variable-value">${escapeHtml(formatNumber(value))}</span>
      <button class="mini-delete" type="button" aria-label="Delete ${escapeHtml(name)}">×</button>
    `;

    chip.querySelector(".mini-delete").addEventListener("click", () => {
      delete state.variables[name];
      saveState();
      renderVariables();
    });

    chip.addEventListener("click", (event) => {
      if (event.target.closest(".mini-delete")) {
        return;
      }
      appendAtCursor(name);
    });

    container.appendChild(chip);
  });
}

function renderFunctionChips() {
  quickFunctions.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip-button";
    button.textContent = value;
    button.addEventListener("click", () => appendAtCursor(value));
    elements.functionChips.appendChild(button);
  });
}

function renderKeypad() {
  elements.keypad.innerHTML = "";

  keypadButtons.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "key-button";
    button.textContent = item.label;

    if (item.className) {
      button.classList.add(item.className);
    }

    button.addEventListener("click", () => {
      if (item.action === "evaluate") {
        handleEvaluation();
        return;
      }

      if (item.action === "clear") {
        elements.expressionInput.value = "";
        elements.expressionInput.focus();
        return;
      }

      if (item.action === "backspace") {
        backspaceAtCursor();
        return;
      }

      appendAtCursor(item.value);
    });

    elements.keypad.appendChild(button);
  });
}

function attachEventListeners() {
  elements.saveVariableButton.addEventListener("click", () => {
    elements.variableValueInput.value = String(state.lastResult);
    elements.variableNameInput.focus();
    setResult(formatNumber(state.lastResult), "Enter a variable name, then press Store.");
  });

  elements.clearInputButton.addEventListener("click", () => {
    elements.expressionInput.value = "";
    elements.expressionInput.focus();
  });

  elements.clearHistoryButton.addEventListener("click", () => {
    state.history = [];
    saveState();
    renderHistory();
  });

  elements.clearVariablesButton.addEventListener("click", () => {
    state.variables = {};
    saveState();
    renderVariables();
  });

  elements.variableForm.addEventListener("submit", (event) => {
    event.preventDefault();

    try {
      storeVariable(elements.variableNameInput.value.trim(), elements.variableValueInput.value.trim());
      elements.variableNameInput.value = "";
      elements.variableValueInput.value = "";
      setResult(formatNumber(state.lastResult), "Variable stored successfully.");
    } catch (error) {
      setResult("Error", error.message, true);
    }
  });

  elements.historyToggleButton.addEventListener("click", () => {
    setHistoryOpen(!state.historyOpen);
  });

  elements.closeHistoryButton.addEventListener("click", () => {
    setHistoryOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    const activeElement = document.activeElement;
    const typingIntoField = activeElement && ["INPUT", "TEXTAREA"].includes(activeElement.tagName);

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "h") {
      event.preventDefault();
      setHistoryOpen(!state.historyOpen);
      return;
    }

    if (event.key === "Escape") {
      if (state.historyOpen) {
        setHistoryOpen(false);
      } else if (activeElement === elements.expressionInput) {
        elements.expressionInput.value = "";
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      if (activeElement === elements.expressionInput || !typingIntoField) {
        event.preventDefault();
        handleEvaluation();
      }
      return;
    }

    if (activeElement === elements.expressionInput) {
      return;
    }

    if (/^[0-9]$/.test(event.key) || ["+", "-", "*", "/", "%", "^", ".", "(", ")"].includes(event.key)) {
      appendAtCursor(event.key);
      event.preventDefault();
      return;
    }

    if (event.key === "Backspace" && !typingIntoField) {
      backspaceAtCursor();
      event.preventDefault();
    }
  });
}

function initialize() {
  renderFunctionChips();
  renderKeypad();
  renderHistory();
  renderVariables();
  attachEventListeners();
  setResult(formatNumber(state.lastResult), "Ready for your next calculation.");
  setHistoryOpen(false);
}

initialize();
