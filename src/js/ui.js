// 화면 전환 + DOM 헬퍼

export function showScreen(name) {
  document.querySelectorAll(".screen").forEach(el => el.classList.remove("active"));
  const target = document.getElementById(`${name}-screen`);
  if (target) target.classList.add("active");
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class")      node.className = v;
    else if (k === "style") Object.assign(node.style, v);
    else if (k === "text")  node.textContent = v;
    else if (k === "html")  throw new Error("[ui] innerHTML 사용 금지 — text 또는 children 사용");
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "data")  Object.entries(v).forEach(([dk, dv]) => node.dataset[dk] = dv);
    else if (k === "aria")  Object.entries(v).forEach(([ak, av]) => node.setAttribute(`aria-${ak}`, av));
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function toast(message, opts = {}) {
  const layer = document.getElementById("toast-layer");
  if (!layer) return;
  const t = el("div", { class: `toast ${opts.kind || ""}`, text: message });
  layer.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    t.addEventListener("transitionend", () => t.remove(), { once: true });
  }, opts.duration || 1800);
}

export function showModal(content, opts = {}) {
  const overlay = el("div", { class: "modal-overlay", onclick: (ev) => {
    if (ev.target === overlay && opts.dismissible !== false) closeModal(overlay);
  }});
  const modal = el("div", { class: "modal" });
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  return overlay;
}

export function closeModal(overlay) {
  overlay.classList.add("closing");
  setTimeout(() => overlay.remove(), 180);
}

export function applyFontSize(size) {
  document.documentElement.style.setProperty("--reading-font-size", `${size}px`);
}

export function applyDarkMode(on) {
  document.documentElement.classList.toggle("dark", !!on);
}
