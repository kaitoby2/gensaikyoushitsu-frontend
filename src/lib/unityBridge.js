// src/lib/unityBridge.js
let unityRef = null;

export function setUnityInstance(i) {
    unityRef = i;
}

export function sendToUnity(type, payload) {
    if (!unityRef) return;
    const json = JSON.stringify({ type, payload: JSON.stringify(payload) });
    try {
        unityRef.SendMessage("WebBridge", "OnFromWeb", json);
    } catch (e) {
        console.warn("SendMessage failed:", e);
    }
}

export function onUnityEvent(handler) {
    const f = (e) => handler(e?.detail);
    window.addEventListener("unity-event", f);
    return () => window.removeEventListener("unity-event", f);
}
