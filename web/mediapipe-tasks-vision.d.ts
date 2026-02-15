declare module "@mediapipe/tasks-vision" {
    export class FilesetResolver {
        static forVisionTasks(wasmPath: string): Promise<any>;
    }

    export class HandLandmarker {
        static createFromOptions(
            fileset: any,
            options: {
                baseOptions: {
                    modelAssetPath: string;
                    delegate?: string;
                };
                runningMode: string;
                numHands?: number;
                minHandDetectionConfidence?: number;
                minHandPresenceConfidence?: number;
                minTrackingConfidence?: number;
            }
        ): Promise<HandLandmarker>;

        detectForVideo(
            video: HTMLVideoElement,
            timestamp: number
        ): {
            landmarks: { x: number; y: number; z: number }[][];
            handedness: { categoryName: string }[][];
        };

        close(): void;
    }
}
