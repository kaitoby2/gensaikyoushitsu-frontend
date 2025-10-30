// src/UnityWebGLPlayer.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";

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
