// =============================
// APIベースURL設定
// =============================
export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE) ||
  "http://localhost:8000";

// =============================
// 共通GETメソッド
// =============================
export async function apiGet(path) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

// =============================
// 共通POSTメソッド
// =============================
export async function apiPost(path, body = {}) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

// =============================
// 共通UPLOAD（FormData）
// =============================
export async function apiUpload(path, formData) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, {
    method: "POST",
    body: formData,          // ← Content-Typeは付けない（ブラウザ任せ）
    credentials: "include",
  });
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) {
    const msg = ct.includes("application/json")
      ? (await r.json())?.detail || `${r.status} ${r.statusText}`
      : `${r.status} ${r.statusText}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return ct.includes("application/json") ? r.json() : {};
}

// =============================
// 管理者トークン付き（X-Admin-Token）
// =============================
export async function apiGetAuth(path, token) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, {
    headers: { "X-Admin-Token": token },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

export async function apiPostAuth(path, body = {}, token) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Token": token,
    },
    body: JSON.stringify(body),
    credentials: "include",
  });
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) {
    const msg = ct.includes("application/json")
      ? (await r.json())?.detail || `${r.status} ${r.statusText}`
      : `${r.status} ${r.statusText}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return ct.includes("application/json") ? r.json() : {};
}

export async function apiUploadAuth(path, formData, token) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "X-Admin-Token": token },
    body: formData,
    credentials: "include",
  });
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) {
    const msg = ct.includes("application/json")
      ? (await r.json())?.detail || `${r.status} ${r.statusText}`
      : `${r.status} ${r.statusText}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return ct.includes("application/json") ? r.json() : {};
}
