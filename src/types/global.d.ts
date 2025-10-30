declare global {
    interface Window {
        createUnityInstance?: (
            canvas: HTMLCanvasElement,
            config: any,
            onProgress?: (p: number) => void
        ) => Promise<any>;
    }
}

export { };
