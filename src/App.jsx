import { useEffect, useMemo, useState } from "react";
import { API_BASE, apiGet, apiPost, apiUpload, apiGetAuth } from "./api";
import "./App.css";
import UnityWebGLPlayer from "./UnityWebGLPlayer.jsx";

/** ====== ストレージ鍵（新方式と旧方式） ====== */
const LS_USERS = "demo_users"; // [{id,name}]
const LS_CURRENT_USER_ID = "demo_current_user_id";
const LS_LEGACY_NAME = "demo_user_name";
const LS_LEGACY_ID = "demo_user_id";
const LS_GROUP_ID = "demo_group_id"; // ★ 追加：チームID保存用キー

/** ====== ユーティリティ ====== */
const generateUserId = () => "u" + Math.random().toString(36).slice(2, 10);
const loadUsers = () => {
    try {
        const raw = localStorage.getItem(LS_USERS);
        const arr = JSON.parse(raw || "[]");
        return Array.isArray(arr) ? arr : [];
    } catch {
        return [];
    }
};
const saveUsers = (users) => {
    localStorage.setItem(LS_USERS, JSON.stringify(users));
};
const findUserById = (users, id) => users.find((u) => u.id === id);

/** ====== 旧キーから新方式へマイグレーション ====== */
const migrateLegacyUserIfNeeded = () => {
    const name = localStorage.getItem(LS_LEGACY_NAME);
    const id = localStorage.getItem(LS_LEGACY_ID);
    if (!name || !id) return; // 旧データなし

    const users = loadUsers();
    if (!users.some((u) => u.id === id)) {
        users.push({ id, name });
        saveUsers(users);
    }
    // 現在ユーザーとして記憶（画面は必ずログインから）
    localStorage.setItem(LS_CURRENT_USER_ID, id);
    // 旧キーは必要に応じて削除してOK
    // localStorage.removeItem(LS_LEGACY_NAME);
    // localStorage.removeItem(LS_LEGACY_ID);
};

export default function App() {
    const baseTextStyle = { fontSize: 18, lineHeight: 1.7 };

    /** ============ 画面遷移（ログイン/登録/メイン） ============ */
    const [screen, setScreen] = useState("login"); // "login" | "create" | "main"

    /** ============ Backend health ============ */
    const [health, setHealth] = useState("...");
    useEffect(() => {
        apiGet("/")
            .then((d) => setHealth(d.message))
            .catch(() => setHealth("NG"));
    }, []);

    /** ============ ユーザー管理（複数） ============ */
    const [users, setUsers] = useState([]); // [{id,name}]
    const [selectedUserId, setSelectedUserId] = useState(""); // ログイン画面用
    const [createName, setCreateName] = useState(""); // 新規登録画面用

    // 送信前に溜めておく“下書き”
    const [progressDraft, setProgressDraft] = useState({
        created_at: null,      // ISO文字列
        group_id: "",          // チームID
        score_total: null,     // 数値
        rank: "",              // "Beginner" 等
        answers_count: 0,      // 回答数
        advice: [],            // 文字列配列（後で {msg,done:false} に整形）
    });

    // 現在ログイン中のユーザー（メイン画面で使用）
    const [userName, setUserName] = useState("");
    const [userId, setUserId] = useState("");
    const [setupDone, setSetupDone] = useState(false);

    // 起動時：旧データ移行→一覧読込→（あっても）まずはログイン画面
    useEffect(() => {
        migrateLegacyUserIfNeeded();
        const arr = loadUsers();
        setUsers(arr);

        const cur = localStorage.getItem(LS_CURRENT_USER_ID) || "";
        if (cur && findUserById(arr, cur)) {
            setSelectedUserId(cur); // 直前ユーザーを初期選択
        }
        setScreen("login");
    }, []);

    // === 管理者モード state ===
    const [adminToken, setAdminToken] = useState("");
    const [adminUsers, setAdminUsers] = useState([]); // /admin/users の結果
    const [adminScreen, setAdminScreen] = useState("list"); // list | detail
    const [adminSelectedUser, setAdminSelectedUser] = useState(null);
    const [adminRows, setAdminRows] = useState([]); // /admin/responses
    
    /** ============ ユーザー切替時クリア ============ */
    const clearPerUserState = () => {
        // 設問・スコア・助言
        setAnswersMap({});
        setScore(null);
        setAdvice([]);
        setShowComparison(false);

        // 備蓄診断（水）
        setInv({ persons: 1, bottles500: 0, bottles2l: 0, water_l: 0, overrideLiters: false });
        setInvResult(null);
        setPhotoPreviewUrl("");
        setPhotoResultUrl("");
        setBusy(false);
        setErr("");

        // シナリオの進行
        setPath([]);
        setVisitedIds([]);
        setCurrentNodeId(null);

        // チーム比較
        setGroupId("");
        setGroupName("");
        setGroupMembers([]);
        setJustCreatedId("");

        // Unity モーダル
        setIsUnityOpen(false);
    };

    /** ============ ログイン/登録/ログアウト ============ */
    const handleLogin = () => {
        const uid = selectedUserId.trim();
        if (!uid) {
            alert("既存ユーザーを選択してください。ユーザーがいない場合は「新規ユーザー登録」を行ってください。");
            return;
        }
        const u = findUserById(users, uid);
        if (!u) {
            alert("ユーザーが見つかりません。");
            return;
        }
        clearPerUserState(); // 先に全クリア
        setUserId(u.id);
        setUserName(u.name);
        setSetupDone(true);
        localStorage.setItem(LS_CURRENT_USER_ID, u.id);
        setScreen("main");
    };

    const completeSetup = () => {
        const name = createName.trim();
        if (!name) return alert("ユーザー名を入力してください");

        // 一意ID生成（衝突時は再生成）
        let id = generateUserId();
        while (users.some((u) => u.id === id)) id = generateUserId();

        const nextUsers = [...users, { id, name }];
        setUsers(nextUsers);
        saveUsers(nextUsers);

        clearPerUserState(); // 新規でも前の表示を一掃
        setUserId(id);
        setUserName(name);
        setSetupDone(true);
        localStorage.setItem(LS_CURRENT_USER_ID, id);

        alert(`ようこそ、${name} さん！（ID: ${id}）`);
        setScreen("main");
        // ★ 追加（任意）：保存済みチームIDの自動復元
        const gid = (localStorage.getItem(LS_GROUP_ID) || "").trim();
        if (gid) setGroupId(gid);
    };

    const goToCreate = () => {
        setCreateName("");
        clearPerUserState(); // 見た目もスッキリ
        setScreen("create");
    };

    const handleLogout = () => {
        clearPerUserState();
        setScreen("login");
    };

    const resetAllUsers = () => {
        if (!confirm("保存されているすべてのユーザーを削除します。よろしいですか？")) return;
        localStorage.removeItem(LS_USERS);
        localStorage.removeItem(LS_CURRENT_USER_ID);
        // 旧キーも削除（任意）
        localStorage.removeItem(LS_LEGACY_NAME);
        localStorage.removeItem(LS_LEGACY_ID);

        setUsers([]);
        setSelectedUserId("");
        clearPerUserState();
        setUserId("");
        setUserName("");
        setSetupDone(false);
        setScreen("create");
    };

    /** ============ Unity モーダル ============ */
    const [isUnityOpen, setIsUnityOpen] = useState(false);

    /** ============ シナリオ ============ */
    const [audience, setAudience] = useState("general");
    const [scenariosRaw, setScenariosRaw] = useState([]);
    const [scenarios, setScenarios] = useState([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [currentNodeId, setCurrentNodeId] = useState(null);
    const [path, setPath] = useState([]);
    const [visitedIds, setVisitedIds] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const d = await apiGet(`/scenarios?place=gifu_gotanda&_=${Date.now()}`);
                const items = Array.isArray(d?.items) ? d.items : [];
                setScenariosRaw(items);
            } catch {
                setScenariosRaw([]);
            }
        })();
    }, []);

    useEffect(() => {
        const filtered = scenariosRaw.filter((s) => {
            const t = String(s.type || "").toLowerCase();
            if (audience === "general") return t.includes("simplified") || s.audience === "general";
            return t.includes("detailed") || s.audience === "expert";
        });
        const result = filtered.length ? filtered : scenariosRaw;
        setScenarios(result);
        setActiveIndex(0); // ← 切替時は先頭を選ぶ
    }, [audience, scenariosRaw]);

    const activeScenario = scenarios[activeIndex];
    const flow = useMemo(() => {
        if (activeScenario?.flow && Array.isArray(activeScenario.flow) && activeScenario.flow.length > 0) {
            return activeScenario.flow;
        }
        const paras = Array.isArray(activeScenario?.narrative) ? activeScenario.narrative : [];
        if (!paras.length) return [];
        return paras.map((p, i) => ({
            id: `s${i + 1}`,
            text: p,
            choices: i < paras.length - 1 ? [{ label: "次へ", next: `s${i + 2}` }] : [],
        }));
    }, [activeScenario]);

    // ★★★ 初期表示＆切替時の「種まき」ロジックを強化
    useEffect(() => {
        if (flow.length === 0) {
            setCurrentNodeId(null);
            setPath([]);
            setVisitedIds([]);
            return;
        }

        // currentNodeId が今の flow にあるか
        const exists = currentNodeId && flow.some((n) => n.id === currentNodeId);

        // まだ未初期化、または flow 切替で currentNodeId が無効なら先頭をセット
        if (visitedIds.length === 0 || !exists) {
            setCurrentNodeId(flow[0].id);
            setPath([]);
            setVisitedIds([flow[0].id]);
        }
    }, [flow, audience, activeIndex, currentNodeId, visitedIds.length]);

    const jumpTo = (nextId, label) => {
        if (!nextId) return;
        setPath((prev) => [...prev, { from: currentNodeId, choice: label, to: nextId }]);
        setCurrentNodeId(nextId);
        setVisitedIds((prev) => (prev[prev.length - 1] === nextId ? prev : [...prev, nextId]));
    };

    const visitedNodes = useMemo(
        () => visitedIds.map((id) => flow.find((n) => n.id === id)).filter(Boolean),
        [visitedIds, flow]
    );
    const lastVisited = visitedNodes[visitedNodes.length - 1] ?? null;
    const isScenarioFinished =
        !!lastVisited && (!Array.isArray(lastVisited.choices) || lastVisited.choices.length === 0);


    /** ============ 設問 ============ */
    const [quiz, setQuiz] = useState([]);
    const [answersMap, setAnswersMap] = useState({});
    useEffect(() => {
        (async () => {
            try {
                const d = await apiGet("/quiz");
                const items = Array.isArray(d?.items) ? d.items : [];
                const sorted = items.slice().sort((a, b) => Number(a.no) - Number(b.no));
                setQuiz(sorted);
                const init = {};
                sorted.forEach((it) => (init[it.id] = ""));
                setAnswersMap(init);
            } catch {
                setQuiz([]);
            }
        })();
    }, []);
    const qaOptions = useMemo(
        () => [
            { label: "はい", value: "yes" },
            { label: "少し", value: "some" },
            { label: "いいえ", value: "no" },
        ],
        []
    );
    const setAnswer = (id, value) => setAnswersMap((prev) => ({ ...prev, [id]: value }));

    /** ============ 備蓄診断（水） ============ */
    const [inv, setInv] = useState({
        persons: 1,
        bottles500: 0,
        bottles2l: 0,
        water_l: 0,
        overrideLiters: false,
    });
    const calcWaterLiters = useMemo(
        () =>
            inv.overrideLiters ? Number(inv.water_l) : Number(inv.bottles500) * 0.5 + Number(inv.bottles2l) * 2,
        [inv.bottles500, inv.bottles2l, inv.overrideLiters, inv.water_l]
    );
    const [invResult, setInvResult] = useState(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState("");
    const [photoResultUrl, setPhotoResultUrl] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState("");

    const analyzeInventory = async (e) => {
        e?.preventDefault();
        setErr("");
        setBusy(true);
        try {
            const qs = new URLSearchParams({
                water_l: String(calcWaterLiters),
                meals: String(0),
                toilet_bags: String(0),
                persons: String(inv.persons),
            }).toString();
            const d = await apiPost(`/inventory/analyze?${qs}`);
            setInvResult(d);
        } catch (error) {
            setErr(error?.message || "診断に失敗しました");
        } finally {
            setBusy(false);
        }
    };

    const onPickPhoto = async (file) => {
        if (!file) return;

        // 画像以外は弾く（念のため）
        if (!file.type?.startsWith("image/")) {
            setErr("画像ファイルを選んでください");
            return;
        }

        setErr("");
        setBusy(true);
        setPhotoResultUrl(""); // 前の結果画像をクリア

        try {
            // プレビュー
            setPhotoPreviewUrl(URL.createObjectURL(file));

            // FormData: バックエンドの両パターンに対応（"file" / "image"）
            const fd = new FormData();
            fd.append("image", file);     // FastAPIが"image"という名前で受け取る場合
            fd.append("persons", String(inv.persons));  // 人数情報を添付
            fd.append("conf_thresh", "0.5");  // 信頼度の閾値

            // 画像アップロード（共通ヘルパーでの送信）
            const response = await apiUpload(`/inventory/photo`, fd);

            // レスポンスデータ（Visual Path の取得）
            const visPath = response.visual_path || response.image_url || response.result_url || "";
            const visUrl = visPath ? (visPath.startsWith("http") ? visPath : `${API_BASE}${visPath}`) : "";
            setPhotoResultUrl(visUrl);  // 結果画像のURLをセット

            // 数をフォームに反映
            setInv((prevInv) => ({
                ...prevInv,
                bottles500: Number(response?.counts?.water_500ml ?? prevInv.bottles500 ?? 0),
                bottles2l: Number(response?.counts?.water_2l ?? prevInv.bottles2l ?? 0),
                overrideLiters: typeof response.total_l === "number" ? true : prevInv.overrideLiters,
                water_l: typeof response.total_l === "number" ? Number(response.total_l) : prevInv.water_l,
            }));

            // 推定日数があればセット
            if (typeof response.estimated_days === "number") {
                setInvResult({ estimated_days: response.estimated_days });
            }
        } catch (error) {
            setErr(error?.message || "画像解析に失敗しました");  // エラーメッセージをセット
        } finally {
            setBusy(false);  // 処理終了
        }
    };

    /** ============ 評価 & 保存/復元 ============ */
    const answersArray = useMemo(
        () =>
            Object.entries(answersMap)
                .filter(([, v]) => v === "yes" || v === "some" || v === "no")
                .map(([id, value]) => ({ id, value })),
        [answersMap]
    );
    const [score, setScore] = useState(null);
    const [advice, setAdvice] = useState([]);
    const [showComparison, setShowComparison] = useState(false);
    const scored = !!score;

    async function saveResponse(payload) {
        try {
            await apiPost("/responses/save", payload);
        } catch (e) {
            console.warn("saveResponse failed:", e?.message);
        }
    }
    async function loadLastResponse(uid) {
        try {
            const last = await apiGet(`/responses/last?user_id=${encodeURIComponent(uid)}`);
            return last && Object.keys(last).length ? last : null;
        } catch (e) {
            console.warn("loadLastResponse failed:", e?.message);
            return null;
        }
    }

    const scoreNow = async () => {
        setErr("");
        setBusy(true);
        try {
            const body = {
                answers: answersArray,
                inventory_days: invResult?.estimated_days ?? 0,
                flood_depth_m: 0.0,
                scenario_path: path,
            };
            const d = await apiPost("/levels/score", body);
            setScore(d);
            setAdvice([]);
            setShowComparison(false);

            // 下書きを更新（この時点で日時・スコア・回答数を確定）
            setProgressDraft((prev) => ({
                ...prev,
                created_at: prev.created_at || new Date().toISOString(),
                answers_count: answersArray.length,
                score_total: d?.score_total ?? null,
                rank: d?.rank ?? "",
            }));

            await saveResponse({
                user_id: userId,
                user_name: userName,
                answers: answersArray,
                scenario_path: path,
                inventory_days: invResult?.estimated_days ?? 0,
                score: d, // ← スコアはオブジェクトでOK（バックエンドでscore_totalを抜いています）
                group_id: (groupId || "").trim() || null, // ★ 変数名修正
                advice: [],
            });
        } catch (error) {
            setErr(error?.message || "スコア計算に失敗しました");
        } finally {
            setBusy(false);
        }
    };

    const getAdvice = async () => {
        setErr("");
        setBusy(true);
        try {
            const body = {
                answers: answersArray,
                inventory_days: invResult?.estimated_days ?? 0,
                flood_depth_m: 0.0,
                scenario_path: path,
            };
            const d = await apiPost("/advice", body);
            const actions = Array.isArray(d.actions) ? d.actions : [];
            setAdvice(actions);

            // 下書きにアドバイスと回答数・日時を保存（日時が未設定なら今）
            setProgressDraft((prev) => ({
                ...prev,
                created_at: prev.created_at || new Date().toISOString(),
                answers_count: answersArray.length,
                advice: actions,
            }));

            await saveResponse({
                user_id: userId,
                user_name: userName,
                answers: answersArray,
                scenario_path: path,
                inventory_days: invResult?.estimated_days ?? 0,
                score, // ← そのままオブジェクトで保存してOK
                advice: actions,
                group_id: (groupId || "").trim() || null, // ★ 変数名修正
            });
        } catch (error) {
            setErr(error?.message || "アドバイスの取得に失敗しました");
        } finally {
            setBusy(false);
        }
    };

    const rankInfo = (rank) => {
        switch (rank) {
            case "Beginner":
                return { label: "初級", sub: "はじめての備え", color: "#e74c3c" };
            case "Intermediate":
                return { label: "中級", sub: "しっかりした備え", color: "#f39c12" };
            case "Advanced":
                return { label: "上級", sub: "模範的な備え", color: "#27ae60" };
            default:
                return { label: String(rank || "-"), sub: "", color: "#555" };
        }
    };

    /** ============ チーム比較 ============ */
    const [groupId, setGroupId] = useState("");
    const [groupName, setGroupName] = useState("");
    const [groupMembers, setGroupMembers] = useState([]);
    const [justCreatedId, setJustCreatedId] = useState("");

    const createGroup = async () => {
        try {
            const fd = new FormData();
            fd.append("name", (groupName || "").trim() || "My Group");
            const r = await fetch(`${API_BASE}/groups/create`, { method: "POST", body: fd });
            const d = await r.json();
            if (d.group_id) {
                setGroupId(d.group_id);
                setJustCreatedId(d.group_id);
                localStorage.setItem(LS_GROUP_ID, d.group_id); // ★ 追加
                setProgressDraft((p) => ({ ...p, group_id: d.group_id }));
                alert(`グループを作成しました: ${d.group_id}`);
                await fetchGroupProgress(d.group_id);   
            }
        } catch (err) {
            console.error(err);
            alert(`グループ作成に失敗しました：${err?.message ?? ""}`);
        }
    };

    const joinGroup = async () => {
        try {
            const gid = (groupId || "").trim();
            if (!gid) return alert("チームIDを入力してください");
            const fd = new FormData();
            fd.append("user_id", userId);
            fd.append("user_name", userName || "");
            fd.append("group_id", gid);
            const r = await fetch(`${API_BASE}/groups/join`, { method: "POST", body: fd });
            const d = await r.json();
            if (d.group_id) {
                alert("参加しました");
                localStorage.setItem(LS_GROUP_ID, gid); // ★ 追加：保持
                await fetchGroupProgress(gid);
                setProgressDraft((p) => ({ ...p, group_id: gid }));
            }
        } catch (err) {
            console.error(err);
            alert(`参加に失敗しました：${err?.message ?? ""}`);
        }
    };

    const updateProgress = async () => {
        const gid = (progressDraft.group_id || groupId).trim();
        if (!gid) return alert("チームIDが未入力です");
        // スコアは下書き優先、なければ現在のscoreから
        const score_total = progressDraft.score_total ?? score?.score_total;
        const rank = progressDraft.rank ?? score?.rank;
        if (score_total == null || !rank) {
            return alert("先にスコア計算してください");
        }
        try {
            const body = {
                user_id: userId,
                user_name: userName,
                group_id: gid,
                score: score_total,
                rank,
                // 下書きのアドバイスを優先（無ければ現在state）
                advice: (progressDraft.advice?.length ? progressDraft.advice : (advice || []))
                    .map((a) => ({ msg: a, done: false })),
                // ユーザー希望に合わせ、集計時刻は下書きの created_at を使う
                last_updated: progressDraft.created_at || new Date().toISOString(),
                // 追加情報（サーバーが無視してもOK）
                answers_count: progressDraft.answers_count ?? answersArray.length,
                created_at: progressDraft.created_at || new Date().toISOString(),
            };
            const r = await fetch(`${API_BASE}/progress/update`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            await r.json();
            alert("進捗を送信しました");
            await fetchGroupProgress(gid);
            // 送信後は下書きをクリアしておく（任意）
            setProgressDraft((_) => ({
                created_at: null, group_id: gid, score_total: null, rank: "", answers_count: 0, advice: [],
            }));
        } catch (err) {
            console.error(err);
            alert(`進捗送信に失敗しました：${err?.message ?? ""}`);
        }
    };

    const fetchGroupProgress = async (gidOptional) => {
        try {
            const gid = (gidOptional ?? groupId).trim();
            if (!gid) return;
            const r = await fetch(`${API_BASE}/groups/${gid}/progress`);
            const d = await r.json();
            if (Array.isArray(d.members)) setGroupMembers(d.members);
        } catch (err) {
            console.error(err);
            alert(`グループ情報の取得に失敗しました：${err?.message ?? ""}`);
        }
    };

    const copy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            alert("コピーしました");
        } catch (err) {
            console.error("Clipboard copy failed", err);
        }
    };

    /** 起動後（ログイン後）：最後の記録を復元 */
    useEffect(() => {
        (async () => {
            if (!userId) return;
            const last = await loadLastResponse(userId);
            if (!last) return;

            if (Array.isArray(last.answers)) {
                const restored = {};
                last.answers.forEach(({ id, value }) => (restored[id] = value));
                setAnswersMap((prev) => ({ ...prev, ...restored }));
            }
            if (last.score) setScore(last.score);
            if (typeof last.inventory_days === "number") {
                setInvResult({ estimated_days: last.inventory_days });
            }
            if (Array.isArray(last.advice)) setAdvice(last.advice);
            // ★ 追加：最後の記録にgroup_idがあれば反映＆保持
            if (last.group_id) {
                setGroupId(last.group_id);
                localStorage.setItem(LS_GROUP_ID, last.group_id);
                setProgressDraft((p) => ({ ...p, group_id: last.group_id }));
            }
        })();
    }, [userId]);

    /** ============ ここから画面切り替え描画 ============ */
    // === 管理者画面 ===
    if (screen === "admin") {
      return (
        <div className="container">
          <h1>管理者ダッシュボード</h1>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <button onClick={async () => {
              const u = await apiGetAuth("/admin/users", adminToken);
              setAdminUsers(Array.isArray(u.users) ? u.users : []);
              setAdminScreen("list");
            }}>更新</button>
            <button onClick={() => { setScreen("login"); setAdminToken(""); }}>ログアウト</button>
          </div>
    
          {adminScreen === "list" && (
            <table className="progress-table">
              <thead>
                <tr>
                  <th>ユーザー</th>
                  <th>ID</th>
                  <th>件数</th>
                  <th>最終回答</th>
                  <th>所属チーム</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(adminUsers || []).map((u, i) => (
                  <tr key={i}>
                    <td>{u.user_name || "(未設定)"}</td>
                    <td><code>{u.user_id}</code></td>
                    <td>{u.count}</td>
                    <td>{u.last_seen}</td>
                    <td>{(u.groups || []).join(", ") || "-"}</td>  {/* ★ 修正：groups */}
                    <td>
                      <button onClick={async () => {
                        setAdminSelectedUser(u);
                        const rows = await apiGetAuth(`/admin/responses?user_id=${encodeURIComponent(u.user_id)}`, adminToken);
                        setAdminRows(Array.isArray(rows) ? rows : []);
                        setAdminScreen("detail");
                      }}>詳細</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
    
          {adminScreen === "detail" && (
            <div>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0 }}>ユーザー詳細：{adminSelectedUser?.user_name || "(未設定)"} (<code>{adminSelectedUser?.user_id}</code>)</h2>
                <button onClick={() => setAdminScreen("list")}>一覧に戻る</button>
              </div>
              <table className="progress-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>チーム</th>
                    <th>スコア</th>
                    <th>回答数</th>
                    <th>アドバイス</th>
                  </tr>
                </thead>
                <tbody>
                  {(adminRows || []).map((r, i) => (
                    <tr key={i}>
                      <td>{r.created_at}</td>
                      <td>{r.group_id || "-"}</td>  {/* ★ 修正：group_id */}
                      <td>{r.score ?? "-"}</td>
                      <td>{Array.isArray(r.answers) ? r.answers.length : 0}</td>
                      <td>
                        <ul style={{ margin: 0, paddingLeft: 16 }}>
                          {(r.advice || []).map((a, j) => <li key={j}>{a}</li>)}
                        </ul>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      );
    }

    // ログイン画面（既存ユーザーを選ぶ）
    if (screen === "login") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    background: "#f5f7fb",
                    padding: 16,
                }}
            >
                <div
                    style={{
                        background: "#fff",
                        borderRadius: 16,
                        boxShadow: "0 10px 30px rgba(0,0,0,.08)",
                        width: "min(420px, 92vw)",
                        padding: 24,
                        textAlign: "center",
                    }}
                >
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "#333" }}>ログイン</h1>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>Backend: {health}</p>

                    <div style={{ textAlign: "left", marginBottom: 12 }}>
                        <label style={{ display: "block", fontSize: 13, color: "#4b5563", marginBottom: 6 }}>
                            既存ユーザーを選択
                        </label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            style={{
                                width: "100%",
                                height: 44,
                                display: "block",
                                boxSizing: "border-box",
                                padding: "10px 12px",
                                borderRadius: 10,
                                border: "1px solid #d1d5db",
                                outline: "none",
                            }}
                        >
                            <option value="">（選択してください）</option>
                            {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}（{u.id}）
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={users.length === 0}
                        style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "none",
                            background: users.length === 0 ? "#cbd5e1" : "#3b82f6",
                            color: "#fff",
                            fontSize: 16,
                            fontWeight: 700,
                            cursor: users.length === 0 ? "not-allowed" : "pointer",
                            marginBottom: 8,
                        }}
                    >
                        ログイン
                    </button>

                    <div style={{ color: "#9ca3af", fontSize: 12, margin: "8px 0" }}>— または —</div>

                    <button
                        onClick={goToCreate}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#2563eb",
                            textDecoration: "underline",
                            fontSize: 13,
                            cursor: "pointer",
                        }}
                    >
                        新規ユーザー登録はこちら
                    </button>

                    <div style={{ marginTop: 16 }}>
                        <button
                            onClick={resetAllUsers}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                textDecoration: "underline",
                                fontSize: 12,
                                cursor: "pointer",
                            }}
                        >
                            （開発用）保存された全ユーザーを削除
                        </button>
                    </div>
                    {/* 管理者ログイン */}
                    <button
                        onClick={async () => {
                        const t = prompt("管理者トークンを入力してください");
                        if (!t) return;
                        try {
                        　await apiGetAuth("/admin/ping", t);
                        　setAdminToken(t);
                        　const u = await apiGetAuth("/admin/users", t);
                        　setAdminUsers(Array.isArray(u.users) ? u.users : []);
                        　setScreen("admin");
                        } catch (e) {
                        　alert("認証に失敗しました: " + (e?.message || ""));
                        }
                    　}}
                    　style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid #94a3b8",
                        background: "#fff",
                        color: "#0f172a",
                        fontSize: 14,
                        cursor: "pointer",
                        marginTop: 12,
                    　}}
                    >
                    　管理者ログイン
                    </button>
                </div>
            </div>
        );
    }
    
    // 新規ユーザー登録画面
    if (screen === "create") {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    background: "#f5f7fb",
                    padding: 16,
                }}
            >
                <div
                    style={{
                        background: "#fff",
                        borderRadius: 16,
                        boxShadow: "0 10px 30px rgba(0,0,0,.08)",
                        width: "min(420px, 92vw)",
                        padding: 24,
                        textAlign: "center",
                    }}
                >
                    <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "#333" }}>新規ユーザー登録</h1>
                    <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 16px" }}>
                        ニックネームを登録するとIDを自動発行します（同名OK）。
                    </p>

                    <input
                        type="text"
                        placeholder="ニックネームを入力"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        style={{
                            width: "100%",
                            height: 44,
                            display: "block",
                            boxSizing: "border-box",  // ← 重要：はみ出し防止
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid #d1d5db",
                            outline: "none",
                            textAlign: "center",
                            margin: "0 0 12px",       // ← 左右の余白ゼロ
                        }}
                    />

                    <button
                        onClick={completeSetup}
                        style={{
                            width: "100%",
                            padding: "10px 14px",
                            borderRadius: 10,
                            border: "none",
                            background: "#10b981",
                            color: "#fff",
                            fontSize: 16,
                            fontWeight: 700,
                            cursor: "pointer",
                            marginBottom: 8,
                        }}
                    >
                        登録して開始
                    </button>

                    <button
                        onClick={() => setScreen("login")}
                        style={{
                            background: "transparent",
                            border: "none",
                            color: "#2563eb",
                            textDecoration: "underline",
                            fontSize: 13,
                            cursor: "pointer",
                        }}
                    >
                        ログイン画面に戻る
                    </button>
                </div>
            </div>
        );
    }

    // メイン画面（ログイン完了後のみ表示）
    // メイン画面（ログイン完了後のみ表示）
    return (
        <div className="app-shell patterned-bg" style={baseTextStyle}>
            {/* 共通ヘッダー */}
            <header className="app-header">
                <div className="header-inner">
                    <div className="brand">
                        <span className="brand-title">
                            <span className="first">減</span><span className="second">災</span>教室
                        </span>
                        <small>『わかる』から『できる』へ</small>
                    </div>
                    <div className="langs">
                        <button type="button" className="pill jp">Japanese</button>
                        <button type="button" className="pill en">English</button>
                    </div>
                </div>
            </header>


            <div className="container">

                <p className={health === "Backend OK" ? "ok" : "ng"}>
                    Backend: {health}（{API_BASE}）
                </p>

                {/* ユーザーバー */}
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div className="muted">
                        ようこそ，<b>{userName}</b> さん（ID: <code>{userId}</code>）
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                        <button onClick={handleLogout} className="btn-ghost">ログアウト</button>
                        <button
                            onClick={() => { clearPerUserState(); setScreen("login"); }}
                            className="btn-ghost"
                        >
                            別ユーザーでログイン
                        </button>
                    </div>
                </div>

                {/* ① 地域シナリオ */}
                <section className="card">
                    <h2>地域シナリオを読んでみよう！</h2>
                    <div className="row" style={{ marginBottom: 8, gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
                        <label>
                            <input
                                type="radio"
                                name="aud"
                                value="general"
                                checked={audience === "general"}
                                onChange={() => setAudience("general")}
                            />{" "}
                            一般向け
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="aud"
                                value="expert"
                                checked={audience === "expert"}
                                onChange={() => setAudience("expert")}
                            />{" "}
                            専門家向け
                        </label>
                        {scenarios.length > 1 && (
                            <select
                                value={activeIndex}
                                onChange={(e) => setActiveIndex(Number(e.target.value))}
                                style={{ marginLeft: "auto" }}
                            >
                                {scenarios.map((s, i) => (
                                    <option key={s.id ?? i} value={i}>
                                        {s.title ?? `シナリオ${i + 1}`}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {!flow.length && <div className="muted">シナリオが見つかりませんでした。</div>}

                    {flow.length > 0 &&
                        visitedNodes.length > 0 &&
                        (isScenarioFinished ? (
                            <div style={{ marginTop: 12 }}>
                                <div className="callout" style={{ fontSize: 22, lineHeight: 1.9, padding: "18px 20px", textAlign: "center", fontWeight: 800 }}>
                                    備えをするかしないか、その選択が未来を変えます。
                                    <br />
                                    今、この瞬間、あなたは何を準備しますか？
                                </div>
                                <div className="row" style={{ gap: 8, marginTop: 12 }}>
                                    <button
                                        type="button"
                                        onClick={() => setIsUnityOpen(true)}
                                        className="btn-primary"
                                        style={{ padding: "10px 14px", fontSize: 18 }}
                                    >
                                        3Dシミュレーションを開始
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (flow.length) {
                                                setCurrentNodeId(flow[0].id);
                                                setPath([]);
                                                setVisitedIds([flow[0].id]);
                                            }
                                        }}
                                        className="btn-ghost"
                                    >
                                        シナリオをやり直す
                                    </button>
                                </div>
                                {activeScenario?.source_note && (
                                    <p className="muted" style={{ fontSize: 14, marginTop: 12 }}>
                                        {activeScenario.source_note}
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div>
                                {activeScenario?.title && <div style={{ fontWeight: 700, marginBottom: 6 }}>{activeScenario.title}</div>}
                                {activeScenario?.summary && (
                                    <p className="muted" style={{ marginTop: 0 }}>
                                        {activeScenario.summary}
                                    </p>
                                )}
                                {visitedNodes.map((node, idx) => {
                                    const isLast = idx === visitedIds.length - 1;
                                    return (
                                        <div key={node.id} style={{ marginBottom: 12 }}>
                                            <p style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>{node.text}</p>
                                            {isLast ? (
                                                <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 4, justifyContent: "center" }}>
                                                    {(node.choices ?? []).map((c, i) => (
                                                        <button
                                                            key={`${node.id}-${i}`}
                                                            onClick={() => jumpTo(c.next, c.label)}
                                                            className="btn-primary"
                                                            style={{ padding: "10px 14px" }}
                                                        >
                                                            {c.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="muted" style={{ fontSize: 13 }}>
                                                    （経過）
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {activeScenario?.source_note && (
                                    <p className="muted" style={{ fontSize: 14 }}>
                                        {activeScenario.source_note}
                                    </p>
                                )}
                            </div>
                        ))}
                </section>

                {/* ② 設問 */}
                <section className="card">
                    <h2>災害への備えを確認してみよう！</h2>
                    <div className="muted">すべての設問について選択してください。</div>
                    <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 8 }}>
                        {quiz.map((q) => (
                            <div key={q.id} className="qrow">
                                <div className="qno">No.{q.no}</div>
                                <div className="qtext">{q.question}</div>
                                <div className="qopts">
                                    {qaOptions.map((opt) => {
                                        const selected = answersMap[q.id] === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                className={`chip ${selected ? "selected" : ""}`}
                                                aria-pressed={selected}
                                                onClick={() => setAnswer(q.id, opt.value)}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {/* ▲ 置き換えここまで */}
                            </div>
                        ))}
                        {!quiz.length && <div className="muted">設問を読み込み中、または見つかりません。</div>}
                    </div>
                </section>

                {/* ③ 備蓄診断 */}
                <section className="card">
                    <h2>飲料水の備蓄診断をしてみよう！</h2>
                    <form onSubmit={analyzeInventory} className="grid" style={{ gap: 16 }}>
                        <NumberField
                            label="人数"
                            value={inv.persons}
                            min={1}
                            step={1}
                            onChange={(val) => setInv((v) => ({ ...v, persons: val }))}
                        />
                        <NumberField
                            label="500ml 本数"
                            value={inv.bottles500}
                            min={0}
                            step={1}
                            onChange={(val) => setInv((v) => ({ ...v, bottles500: val, overrideLiters: false }))}
                        />
                        <NumberField
                            label="2L 本数"
                            value={inv.bottles2l}
                            min={0}
                            step={1}
                            onChange={(val) => setInv((v) => ({ ...v, bottles2l: val, overrideLiters: false }))}
                        />
                        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                                type="checkbox"
                                checked={inv.overrideLiters}
                                onChange={(e) => setInv((v) => ({ ...v, overrideLiters: e.target.checked }))}
                            />
                            直接 L 数を入力する
                        </label>
                        {inv.overrideLiters && (
                            <NumberField
                                label="水 (L)"
                                value={inv.water_l}
                                min={0}
                                step={0.1}
                                decimals={1}
                                onChange={(val) => setInv((v) => ({ ...v, water_l: val }))}
                            />
                        )}
                        <div className="muted" style={{ alignSelf: "center" }}>
                            現在の合計水量：<b>{calcWaterLiters}</b>L
                        </div>
                        <button type="submit" disabled={busy} className="btn-primary" style={{ height: 48, fontSize: 18 }}>
                            診断（この水量で計算）
                        </button>
                    </form>

                    <div className="divider" />

                    <div className="photo">
                        {/* 左：元画像 */}
                        <div className="photo-col">
                            <label className="file">
                                画像から推定：
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => onPickPhoto(e.target.files?.[0])}
                                />
                            </label>
                            <div className="muted">※ 500ml / 2L ボトルの検出に対応</div>

                            {photoPreviewUrl && (
                                <>
                                    <div className="muted" style={{ marginTop: 6 }}>
                                        プレビュー（送信した画像）
                                    </div>
                                    <img src={photoPreviewUrl} alt="preview" className="imgbox" />
                                </>
                            )}
                        </div>

                        {/* 真ん中：矢印（検出結果があるときだけ表示） */}
                        {photoPreviewUrl && photoResultUrl && (
                            <div className="photo-arrow" aria-hidden="true">
                                ➜
                            </div>
                        )}

                        {/* 右：検出結果 */}
                        <div className="photo-col">
                            {photoResultUrl && (
                                <>
                                    <div className="muted">検出結果（可視化）</div>
                                    <img src={photoResultUrl} alt="result" className="imgbox" />
                                </>
                            )}
                        </div>
                    </div>


                    {invResult && (
                        <div className="muted result">
                            推定備蓄日数：<b>{invResult.estimated_days}</b> 日（指標：水）
                        </div>
                    )}
                    {err && <div className="error">⚠ {err}</div>}
                </section>

                {/* ④ 評価 */}
                <section className="card">
                    <h2>あなたの評価を見てみよう！</h2>

                    <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                        <button onClick={scoreNow} disabled={!invResult || busy} className="btn-primary" style={{ height: 44, fontSize: 18 }}>
                            スコア計算
                        </button>
                    </div>

                    {score &&
                        (() => {
                            const info = rankInfo(score.rank);
                            const pct = Math.round((Number(score.score_rate) || 0) * 100);
                            return (
                                <div style={{ marginBottom: 12 }}>
                                    <div style={{ fontSize: 18 }}>
                                        スコア：<b>{score.score_total}</b> / {score.score_max} 点（達成率 {pct}%）
                                    </div>
                                    <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                                        <span
                                            style={{
                                                padding: "4px 10px",
                                                borderRadius: 999,
                                                background: info.color,
                                                color: "#fff",
                                                fontWeight: 700,
                                            }}
                                        >
                                            {info.label}
                                        </span>
                                        {info.sub && <span className="muted">{info.sub}</span>}
                                        <span className="muted">（{score.rank}）</span>
                                    </div>

                                    {!advice.length && (
                                        <div style={{ marginTop: 12 }}>
                                            <button onClick={getAdvice} disabled={busy} className="btn-primary" style={{ height: 44, fontSize: 18 }}>
                                                アドバイスを取得
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                    {!scored && (
                        <div className="muted" style={{ marginTop: 8 }}>
                            ※ 友達や家族との比較は、スコア計算後に表示されます。
                        </div>
                    )}

                    {!!advice.length && (
                        <>
                            <ol>{advice.map((a, i) => <li key={i}>{a}</li>)}</ol>
                            {!showComparison && (
                                <div style={{ marginTop: 10 }}>
                                    <button onClick={() => setShowComparison(true)} className="btn-ghost" style={{ height: 44, fontSize: 16 }}>
                                        友達や家族と比較してみよう
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </section>

                {/* ⑤ 比較 */}
                {showComparison && (
                    <section className="card">
                        <h2>友達や家族と比較</h2>

                        <div
                            className="callout"
                            style={{ border: "1px solid #d0ebff", background: "#f0f9ff", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>スコアの比較を始めましょう</div>
                            <div className="muted">まずはチームを作成するか、既存のチームに参加してください。</div>
                            <div className="muted">
                                あなた：<b>{userName || "(未設定)"}</b>（ID: <code>{userId || "-"}</code>）
                            </div>
                        </div>

                        {/* 作成 */}
                        <div className="subcard" style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>初めての方はこちら（新しいチームを作成）</div>
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <input
                                    placeholder="チーム名（例：家族グループ）"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    style={{ padding: 6, minWidth: 240 }}
                                    disabled={!setupDone}
                                />
                                <button onClick={createGroup} disabled={!setupDone} className="btn-ghost">チームを作成</button>
                            </div>
                            {justCreatedId && (
                                <div className="muted" style={{ marginTop: 8 }}>
                                    作成したチームID：<code style={{ fontWeight: 700 }}>{justCreatedId}</code>{" "}
                                    <button type="button" onClick={() => copy(justCreatedId)} className="btn-ghost" style={{ marginLeft: 6 }}>
                                        コピー
                                    </button>
                                    <div>このIDを友達や家族に共有してください。</div>
                                </div>
                            )}
                        </div>

                        {/* 参加 */}
                        <div className="subcard" style={{ border: "1px solid #eee", borderRadius: 10, padding: 12, marginBottom: 10 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>すでに入る予定のチームがある場合はこちら（参加）</div>
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <input
                                    placeholder="チームIDを入力"
                                    value={groupId}
                                    onChange={(e) => setGroupId(e.target.value)}
                                    style={{ padding: 6, minWidth: 240 }}
                                    disabled={!setupDone}
                                />
                                <button onClick={joinGroup} disabled={!setupDone || !groupId.trim()} className="btn-ghost">参加</button>
                                <button onClick={() => fetchGroupProgress()} disabled={!setupDone || !groupId.trim()} className="btn-ghost">
                                    チームの進捗を表示/更新
                                </button>
                            </div>
                            <div className="muted" style={{ marginTop: 6 }}>
                                ※ 「参加」で自分をチームに登録、「表示/更新」でチーム全体の最新状況を取得します。
                            </div>
                        </div>

                        {/* 進捗送信 */}
                        <div className="subcard" style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
                            <div style={{ fontWeight: 700, marginBottom: 6 }}>自分の進捗をチームに送信</div>
                            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <button onClick={updateProgress} disabled={!setupDone || !score || !groupId.trim()} className="btn-primary">
                                    自分のスコア・アドバイスを送信
                                </button>
                                <span className="muted">※ スコア（{score?.score_total ?? "-"}点）とランク、改善アドバイスを共有します。</span>
                            </div>
                        </div>

                        {/* 一覧 */}
                        <div style={{ marginTop: 16 }}>
                            {groupMembers.length === 0 && (
                                <div className="muted">まだメンバー情報がありません。上の「参加」または「送信」をお試しください。</div>
                            )}
                            {groupMembers.length > 0 && (
                                <table className="progress-table">
                                    <thead>
                                        <tr>
                                            <th>ユーザー</th>
                                            <th>スコア</th>
                                            <th>ランク</th>
                                            <th>改善アドバイス</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupMembers.map((m, i) => (
                                            <tr key={i}>
                                                <td>{m.user_name || "(名前未設定)"} ({m.user_id})</td>
                                                <td>{m.score ?? "-"}</td>
                                                <td>{m.rank ?? "-"}</td>
                                                <td>
                                                    <ul>
                                                        {(m.advice || []).map((a, j) => (
                                                            <li key={j}>{a.msg} {a.done ? "✅" : "⏳"}</li>
                                                        ))}
                                                    </ul>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </section>
                )}

                {/* Unity モーダル */}
                {isUnityOpen && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        className="unity-modal"
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 9999,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 12,
                        }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setIsUnityOpen(false);
                        }}
                    >
                        <div
                            style={{
                                width: "min(1280px, 96vw)",
                                background: "#fff",
                                borderRadius: 12,
                                boxShadow: "0 10px 30px rgba(0,0,0,.2)",
                                padding: 12,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                <h3 style={{ margin: 0 }}>3Dシミュレーション</h3>
                                <button onClick={() => setIsUnityOpen(false)} className="btn-ghost">閉じる</button>
                            </div>
                            <p className="muted" style={{ marginTop: 0 }}>
                                画面をクリック（タップ）した地点から散策を開始できます。閉じるとこのページに戻ります。
                            </p>
                            <UnityWebGLPlayer />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

}

/** ===== 補助コンポーネント ===== */
function NumberField({ label, value, onChange, min = 0, step = 1, decimals = 0, width = 140 }) {
    const toNum = (v) => {
        const n = typeof v === "number" ? v : parseFloat(String(v));
        return isNaN(n) ? 0 : n;
    };
    const round = (v) => (decimals > 0 ? Number(v.toFixed(decimals)) : Math.round(v));
    const clamp = (v) => Math.max(min, v);
    const change = (next) => onChange(clamp(round(toNum(next))));
    const btn = {
        width: 44,
        height: 44,
        borderRadius: 8,
        border: "1px solid #ccc",
        background: "#fafafa",
        cursor: "pointer",
        fontSize: 22,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
    };
    const inp = {
        width,
        height: 44,
        borderRadius: 8,
        border: "1px solid #ccc",
        padding: "0 10px",
        fontSize: 18,
    };
    return (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span>{label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" aria-label={`${label} を減らす`} style={btn} onClick={() => change(toNum(value) - step)}>
                    -
                </button>
                <input type="number" value={value} onChange={(e) => change(e.target.value)} style={inp} />
                <button type="button" aria-label={`${label} を増やす`} style={btn} onClick={() => change(toNum(value) + step)}>
                    +
                </button>
            </div>
        </label>
    );
}
