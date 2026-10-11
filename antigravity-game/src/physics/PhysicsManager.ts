import { Scene, HavokPlugin, Vector3 } from "@babylonjs/core";

export class PhysicsManager {
    public scene: Scene;
    public initialized = false;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    public async initialize(): Promise<boolean> {
        try {
            // Dynamic import to avoid build errors if Havok WASM fails
            const HavokPhysics = (await import("@babylonjs/havok")).default;
            const havokInstance = await HavokPhysics();
            const hkPlugin = new HavokPlugin(true, havokInstance);
            this.scene.enablePhysics(new Vector3(0, -9.81, 0), hkPlugin);
            this.initialized = true;
            console.log("✅ Havok Physics initialized successfully.");
            return true;
        } catch (e) {
            console.warn("⚠️ Havok Physics failed to initialize. Continuing without physics.", e);
            return false;
        }
    }
}
