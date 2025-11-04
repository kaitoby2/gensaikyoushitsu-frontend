// =============================
// APIベースURL設定
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

  // FormData のときは Content-Type を付けない（ブラウザが自動付与）
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";

  const r = await fetch(url, {
    method: "POST",
    headers,
    body: isForm ? body : JSON.stringify(body ?? {}),
  });

  if (!r.ok) {
    // レスポンス本文を読み取ってエラーに含めるとデバッグしやすい
    const text = await r.text().catch(() => "");
    throw new Error(`${r.status} ${r.statusText} ${text}`);
  }
  // 画像アップロードも JSON を返す想定
  return r.json();
}

// =============================
// 画像アップロード用ヘルパ（お好みで）
// =============================
export async function apiUpload(path, file, fieldName = "file") {
  const fd = new FormData();
  fd.append(fieldName, file); // ← FastAPI 側は "file" で受け取る
  return apiPost(path, fd);
}
