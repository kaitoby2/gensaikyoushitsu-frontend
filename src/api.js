// =============================
// APIベースURL設定
// =============================
// .env.development または .env.production の内容を自動的に読み込む。
// フォールバックとして localhost を指定しておくと安全。
export const API_BASE =
    (import.meta.env && import.meta.env.VITE_API_BASE) ||
    "http://localhost:8000";

// =============================
// 共通GETメソッド
// =============================
export async function apiGet(path) {
    const url = `${API_BASE}${path}`;
    console.log(`[GET] ${url}`); // デバッグ用ログ（本番では削除OK）
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
}

// =============================
// 共通POSTメソッド
// =============================
export async function apiPost(path, body) {
    const url = `${API_BASE}${path}`;
    console.log(`[POST] ${url}`, body); // デバッグ用ログ
    const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
    });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
}
