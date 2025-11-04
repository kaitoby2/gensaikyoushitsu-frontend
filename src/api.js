// src/api.js

// =============================
// APIベースURL
// =============================
export const API_BASE =
  (import.meta.env && import.meta.env.VITE_API_BASE) ||
  "http://localhost:8000";

// =============================
// 共通GET
// =============================
export async function apiGet(path) {
  const url = `${API_BASE}${path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

// =============================
// 共通POST（FormData対応）
// =============================
export async function apiPost(path, body) {
  const url = `${API_BASE}${path}`;
  const isForm =
    typeof FormData !== "undefined" && body instanceof FormData;

  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: isForm ? body : JSON.stringify(body ?? {}),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText} ${text}`);
  }
  return r.json();
}

// =============================
// 画像アップロード用ヘルパ
// =============================
export async function apiUpload(path, file, extra = {}) {
  const fd = new FormData();
  // ★ FastAPI 側は "file" というフィールド名で受け取る想定
  fd.append("file", file);
  // 追加の数値や文字列があればここで一緒に送れる
  Object.entries(extra).forEach(([k, v]) => fd.append(k, String(v)));
  return apiPost(path, fd);
}
