// src/UnityWebGLPlayer.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";

/** ====== 読み込み中に表示する防災 Tips ====== */
const TIPS = [
  "古い家ほど地震に弱いよ。耐震診断、いちど見てもらおう。",
  "いつもの道にも危険があるかも。ブロック塀や電柱は要チェック。",
  "避難“場所”と避難“所”は別物。どっちに行けばいいか覚えておこう。",
  "揺れた瞬間に外へ飛び出すのは危ないよ。まずは室内で安全確保！",
  "「自分は大丈夫」は危険サイン。正常性バイアスに気をつけよう。",
  "迷ったら率先して避難！あなたの行動が周りを救うかも。",
  "地震防災マップ、見たことある？自宅周りの危険度を知っておこう。",
  "1981年より前の家は特に要注意。耐震補強も選択肢の一つ！",
  "家具の固定、やってる？地震時のケガ防止の基本だよ。",
  "寝室の安全度、見直してみよう。枕元に靴とライトを置くのが◎",
  "普段から「どこで身を守る？」をイメトレしておくと冷静に動けるよ。",
  "海の近くで地震が来たら迷わず高台へ。率先避難が命を守る！",
  "ガラスの破片は危険！フィルム貼ったりスリッパ置いたりして対策を。",
  "地震後の通電火災、実は多いよ。感震ブレーカーが頼もしい。",
  "避難生活は意外とキツい。できれば自宅で過ごせる準備をしておこう。",
  "避難所はかなり狭い！在宅避難できるとグッと楽になるよ。",
  "行政備蓄は少なめ…家庭でも食料は多めにストックしておこう。",
  "断水でもトイレは工夫で使えるよ。袋＋吸収材の簡易トイレを知っておこう。",
  "ペットと避難できるかは自治体次第。事前に調べておくと安心！",
  "車中泊は血栓に注意。こまめに動いて水分もしっかり取ろう。",
  "狭い場所で火器使用は危険！一酸化炭素中毒に気を付けて。",
  "災害時は電話つながりにくいよ。家族の連絡方法を複数決めておこう。",
  "スマホの電池は命綱。モバイルバッテリーは常に持ち歩こう！",
  "長めの停電に備えて、ライトや電池を少し多めに用意しておこう。",
  "カセットコンロは最強。停電しても料理できるよ！ボンベも忘れずに。",
  "停電時の暖房は難しめ。毛布と重ね着でしっかり保温しよう。",
  "豪雨時、水路や側溝はめちゃ危険。絶対に近づかないで。",
  "浸水した道を歩くのは本当に危ないよ。避難より在宅待機が安全なことも。",
  "土砂災害は家の中が危険。早めに避難、無理なら2階へ！",
  "警戒レベル、知ってる？レベル3は「そろそろ避難スタート」の合図だよ。",
  "豪雨の中、屋根に登ったり様子を見に行くのはNG！危険すぎるよ。",
  "子どもが流される事故もあるよ。増水した川や水路には絶対近づかない！",
  "ハザードマップは命を守る地図。自宅・学校・職場で必ず見ておこう。",
  "浸水中の避難は逆に危ないことも。垂直避難も選択肢だよ。",
  "雨雲レーダーや水位情報を日常からチェックしてみよう。",
  "マイタイムラインを作って、災害時の行動を事前に決めておこう。",
  "2階で一晩過ごせる水・食料・ライトがあると心強いよ。",
  "土砂災害警戒区域かどうか、まずはハザードマップで確認しよう。",
  "洪水や内水の違いを知っておくと、避難判断がしやすくなるよ。",
  "立退き避難と在宅避難、どっちが安全か平時から考えておこう。",
  "高齢者への声かけが避難のきっかけになることも。ぜひ一声かけよう！",
  "ご近所との挨拶、実は防災にも効果アリ。つながりが命を守る！",
  "大災害の時、公助には限界があるよ。共助の力を育てよう。",
  "家にある食材でなんとかなることも。みんなで助け合えると心強いね。",
  "防災委員さんに相談してみよう。地区の防災力がぐっと上がるよ。",
  "地域の危険スポットをみんなで共有すると、防災力がアップ！",
  "支援が必要な人の避難方法は事前に決めておくと安心だよ。",
  "玄関の目印で安否確認をスムーズに。地域でルール決めてみよう！",
  "初期消火は地域の力が重要！日頃から連携できると安心だね。",
  "ご近所同士で災害時の相談をしておくと、助け合いがすごくスムーズになるよ。",
  "高齢者・障害者・外国人など、支援が必要な人を地域で見守ろう。",
  "地区防災計画を作ると、みんなで安全な地域を育てていけるよ。",
];

/** 配列をランダムに並べ替える（フィッシャー–イェーツ） */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function UnityWebGLPlayer({
    onUnloadReady,                 // optional: 親から破棄を呼びたい場合に関数を渡す
}) {
    const {
        unityProvider,
        isLoaded,
        loadingProgression,
        sendMessage,
        addEventListener,
        removeEventListener,
        unload,                       // v9 以降
    } = useUnityContext({
        loaderUrl: "/unity/Build/unity.loader.js",
        dataUrl: "/unity/Build/unity.data.unityweb",
        frameworkUrl: "/unity/Build/unity.framework.js.unityweb",
        codeUrl: "/unity/Build/unity.wasm.unityweb",
        streamingAssetsUrl: "/unity/StreamingAssets",
        companyName: "Gensai Kyoshitsu",
        productName: "3D Simulator",
        productVersion: "1.0",
        decompressionFallback: true,  // サーバで Content-Encoding を付けなくても動かす
    });

    const frameRef = useRef(null);
    const canvasRef = useRef(null);

    const [awaitingStart, setAwaitingStart] = useState(true);
    const [lastPick, setLastPick] = useState(null);

    // ★ Tipsの表示順（インデックスのシャッフル結果）と今どこまで使ったか
    const [tipOrder, setTipOrder] = useState([]);
    const [tipPointer, setTipPointer] = useState(0);

    // ---------------- Utilities ----------------
    const clamp01 = (t) => Math.max(0, Math.min(1, t));

    const focusCanvas = useCallback(() => {
        try {
            const root = frameRef.current;
            if (!root) return;
            const canvas = root.querySelector("canvas");
            if (canvas) {
                canvas.tabIndex = 0;
                canvas.style.outline = "none";
                canvasRef.current = canvas;
                canvas.focus({ preventScroll: true });
            }
        } catch {
            /* noop */
        }
    }, []);

    // Unity に安全にメッセージを送る（起動前は送らない）
    const safeSend = useCallback(
        (obj, method, arg) => {
            if (!isLoaded) return;
            try {
                if (arg !== undefined) sendMessage(obj, method, arg);
                else sendMessage(obj, method);
            } catch (e) {
                console.warn("[Unity safeSend] failed:", e);
            }
        },
        [isLoaded, sendMessage]
    );

    // Web→Unity（Bridge 経由の JSON一括）
    const sendToUnity = useCallback(
        (type, payload) => {
            const msg = JSON.stringify({
                type,
                payload: JSON.stringify(payload ?? {}),
            });
            safeSend("WebBridge", "OnFromWeb", msg);
        },
        [safeSend]
    );

    // 変更点3: シーン名を "岐阜駅前_試作品_3" に固定
    const getSceneName = useCallback(() => {
        // URLパラメータやdefaultSceneを無視して、常に固定シーン名を返す
        return "岐阜駅前_試作品_3";
    }, []); // 依存配列から defaultScene, allowedScenes を削除

    // 起動完了時の初期化処理（loaded イベントで必ず isLoaded 後に実行）
    const onUnityLoaded = useCallback(() => {
        const scene = getSceneName();
        sendToUnity("loadScene", { name: scene });
        sendToUnity("enableClickToStart", { enabled: true });
        setAwaitingStart(true);
        requestAnimationFrame(focusCanvas);
    }, [getSceneName, sendToUnity, focusCanvas]);

    // Unity -> Web のイベント
    useEffect(() => {
        // react-unity-webgl の標準 "loaded" イベントで初期化
        addEventListener?.("loaded", onUnityLoaded);

        // もし Unity 側がカスタムで "UnityEvent: ready" を投げるなら併用可能
        const handleUnityEvent = (msg) => {
            if (msg === "ready") onUnityLoaded();
        };
        addEventListener?.("UnityEvent", handleUnityEvent);

        return () => {
            removeEventListener?.("loaded", onUnityLoaded);
            removeEventListener?.("UnityEvent", handleUnityEvent);
        };
    }, [addEventListener, removeEventListener, onUnityLoaded]);

    // 安全な unload（起動済みのときだけ、await で完了待ち）
    const safeUnload = useCallback(async () => {
        if (!isLoaded) return;
        try {
            await unload();
        } catch (e) {
            console.warn("[Unity safeUnload] failed:", e);
        }
    }, [isLoaded, unload]);

    // ★ Unity読み込み中にシャッフル順を作る
    useEffect(() => {
      if (!isLoaded) {
        const order = shuffleArray([...Array(TIPS.length).keys()]);
        setTipOrder(order);
        setTipPointer(0);
      }
    }, [isLoaded]);
    
    // ★ Unity読み込み中だけ一定間隔で次のTipsへ（例：5秒おき）
    useEffect(() => {
      if (isLoaded || tipOrder.length === 0) return;
    
      const id = setInterval(() => {
        setTipPointer((prev) => {
          const next = prev + 1;
          if (next >= tipOrder.length) {
            const newOrder = shuffleArray([...Array(TIPS.length).keys()]);
            setTipOrder(newOrder);
            return 0;
          }
          return next;
        });
      }, 5000);
    
      return () => clearInterval(id);
    }, [isLoaded, tipOrder]);
    
        // 親から破棄したい場合に渡す
        useEffect(() => {
            if (typeof onUnloadReady === "function") {
                onUnloadReady(() => safeUnload());
            }
        }, [onUnloadReady, safeUnload]);
    
        // アンマウント時も安全に破棄（非同期は then/catch で）
        useEffect(() => {
            return () => {
                if (isLoaded) {
                    unload()?.catch(() => { });
                }
            };
        }, [isLoaded, unload]);

    // ピック（クリック/タッチ/ペン）で開始地点を指定
    const handlePickPointer = useCallback(
        (ev) => {
            const el = frameRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            if (typeof ev.preventDefault === "function") ev.preventDefault();

            let x, y;
            if (typeof ev.clientX === "number" && typeof ev.clientY === "number") {
                x = ev.clientX;
                y = ev.clientY;
            } else {
                const touches =
                    ev.touches ||
                    (ev.changedTouches && ev.changedTouches.length ? ev.changedTouches : null);
                const t = touches && touches.length ? touches[0] : null;
                x = t ? t.clientX : undefined;
                y = t ? t.clientY : undefined;
            }
            if (typeof x !== "number" || typeof y !== "number") return;

            const u = clamp01((x - rect.left) / rect.width);
            const v = clamp01((y - rect.top) / rect.height);

            sendToUnity("pickStart", { u, v });
            setLastPick({ u, v });
            setAwaitingStart(false);
            requestAnimationFrame(focusCanvas);
        },
        [sendToUnity, focusCanvas]
    );

    // キーボードで中央指定（Enter/Space）
    const handleKeyDown = useCallback(
        (ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                sendToUnity("pickStart", { u: 0.5, v: 0.5 });
                setLastPick({ u: 0.5, v: 0.5 });
                setAwaitingStart(false);
                requestAnimationFrame(focusCanvas);
            }
        },
        [sendToUnity, focusCanvas]
    );

    const rearmPick = useCallback(() => {
        setAwaitingStart(true);
        sendToUnity("enableClickToStart", { enabled: true });
        requestAnimationFrame(focusCanvas);
    }, [sendToUnity, focusCanvas]);

    const pct = Math.round((loadingProgression ?? 0) * 100);

    return (
        <div ref={frameRef} style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
            <Unity
                unityProvider={unityProvider}
                style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    visibility: isLoaded ? "visible" : "hidden",
                    background: "#000",
                }}
                devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
            />

            {/* Loading overlay */}
            {!isLoaded && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,.6)",
                        color: "#fff",
                        flexDirection: "column",
                        gap: 8,
                        fontWeight: 700,
                    }}
                >
                    <div aria-live="polite">読み込み中… {pct}%</div>
                    <div
                        style={{
                            width: "60%",
                            height: 10,
                            background: "rgba(255,255,255,.2)",
                            borderRadius: 6,
                        }}
                    >
                        <div
                            style={{
                                width: `${pct}%`,
                                height: "100%",
                                background: "#3fa7ff",
                                borderRadius: 6,
                                transition: "width .2s ease",
                            }}
                        />
                    </div>
                    {tipOrder.length > 0 && (
                      <div
                        style={{
                          marginTop: 12,
                          width: "min(720px, 92%)",
                          background: "rgba(255,255,255,.10)",
                          border: "1px solid rgba(255,255,255,.18)",
                          borderRadius: 12,
                          padding: "10px 12px",
                          lineHeight: 1.6,
                          fontWeight: 700,
                        }}
                      >
                        <div style={{ opacity: 0.9, fontSize: 12, marginBottom: 4 }}>
                          💡 防災ワンポイント
                        </div>
                        <div aria-live="polite">{TIPS[tipOrder[tipPointer]]}</div>
                      </div>
                    )}
                </div>
            )}

            {/* Start overlay */}
            {isLoaded && awaitingStart && (
                <div
                    onPointerDown={handlePickPointer}
                    onClick={(e) => {
                        // 一部ブラウザの保険
                        if (!e.nativeEvent.pointerType) handlePickPointer(e);
                    }}
                    onTouchEnd={handlePickPointer}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-label="開始地点を選択"
                    style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(0,0,0,.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 18,
                        cursor: "crosshair",
                        userSelect: "none",
                        outline: "none",
                    }}
                >
                    {/* 「クリック（タップ）で開始地点を選択」等の誘導文をここに置けます */}
                </div>
            )}

            {/* After pick */}
            {isLoaded && !awaitingStart && (
                <div
                    style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                    }}
                >
                    {lastPick && (
                        <span
                            style={{
                                background: "rgba(0,0,0,.5)",
                                color: "#fff",
                                padding: "4px 8px",
                                borderRadius: 6,
                                fontSize: 12,
                            }}
                        >
                            pick: u={lastPick.u.toFixed(2)}, v={lastPick.v.toFixed(2)}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={rearmPick}
                        style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #ccc",
                            background: "#fafafa",
                            fontSize: 12,
                        }}
                    >
                        開始地点を選び直す
                    </button>
                </div>
            )}
        </div>
    );
}
