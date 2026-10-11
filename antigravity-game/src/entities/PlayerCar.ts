import {
    Scene,
    Vector3,
    AbstractMesh,
    MeshBuilder,
    PBRMaterial,
    Color3,
    TransformNode,
    SceneLoader,
    BoundingInfo,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import type { ShadowGenerator } from "@babylonjs/core";
import type { ObstacleCircle } from "../core/EngineManager";

export interface CarConfig {
    engineForce: number;
    brakeForce: number;
    maxSteerAngle: number;
    steerSpeed: number;
    drag: number;
}

const DEFAULT_CONFIG: CarConfig = {
    engineForce: 0.09,
    brakeForce: 0.055,
    maxSteerAngle: 0.038,
    steerSpeed: 0.0028,
    drag: 0.012,
};

const CAR_RADIUS = 1.4;

export class PlayerCar {
    public scene: Scene;
    public root!: TransformNode;
    public visualMesh!: AbstractMesh;

    private _config: CarConfig;
    private _speed: number = 0;
    private _steer: number = 0;
    private _keys: Record<string, boolean> = {};
    private _shadowGenerator: ShadowGenerator;
    private _obstacles: ObstacleCircle[];
    // Y position at which the car sits on the ground
    private _groundY: number = 0;

    constructor(
        scene: Scene,
        shadowGenerator: ShadowGenerator,
        obstacles: ObstacleCircle[],
        config: Partial<CarConfig> = {}
    ) {
        this.scene = scene;
        this._config = { ...DEFAULT_CONFIG, ...config };
        this._shadowGenerator = shadowGenerator;
        this._obstacles = obstacles;
        this._bindKeys();
    }

    private _bindKeys() {
        window.addEventListener("keydown", (e) => {
            this._keys[e.key] = true;
            if (e.key === " ") e.preventDefault();
        });
        window.addEventListener("keyup", (e) => { this._keys[e.key] = false; });
    }

    public async loadModel(modelUrl: string): Promise<TransformNode> {
        // Root sits exactly on ground at Y=0
        this.root = new TransformNode("carRoot", this.scene);
        this.root.position = new Vector3(0, 0, 0);

        try {
            const result = await SceneLoader.ImportMeshAsync("", modelUrl, "", this.scene);
            const loadedRoot = result.meshes[0];

            // ✅ Car orientation: rotation.y = 0 keeps front facing +Z (matches forward vector)
            loadedRoot.rotation = new Vector3(0, 0, 0);

            // ✅ Fix underground: compute the model's bounding box minimum Y
            // and offset the model up so its bottom sits exactly on Y=0
            let minY = Infinity;
            let maxY = -Infinity;
            result.meshes.forEach((m) => {
                if (m.getTotalVertices() > 0) {
                    m.computeWorldMatrix(true);
                    const bi = m.getBoundingInfo();
                    const worldMin = bi.boundingBox.minimumWorld.y;
                    const worldMax = bi.boundingBox.maximumWorld.y;
                    if (worldMin < minY) minY = worldMin;
                    if (worldMax > maxY) maxY = worldMax;
                }
            });

            // Shift the visual mesh up so its bottom is at Y=0
            // (minY is how far below origin the model extends)
            const bottomOffset = -minY + 0.02; // small epsilon to sit just above ground
            loadedRoot.position = new Vector3(0, bottomOffset, 0);

            loadedRoot.setParent(this.root);

            result.meshes.forEach((m) => {
                if (m.getTotalVertices() > 0) {
                    this._shadowGenerator.addShadowCaster(m);
                    m.receiveShadows = true;
                }
            });
            this.visualMesh = loadedRoot;

        } catch (e) {
            console.warn("GLB load failed — using fallback car.", e);
            this._createFallbackCar();
        }

        this.scene.onBeforeRenderObservable.add(() => this._update());
        return this.root;
    }

    private _createFallbackCar() {
        // Raise root to sit on ground
        const body = MeshBuilder.CreateBox("carBody", { width: 2.2, height: 0.75, depth: 4.6 }, this.scene);
        body.position.y = 0.85; // half height + ground clearance
        const mat = new PBRMaterial("carMat", this.scene);
        mat.albedoColor = new Color3(0.92, 0.08, 0.08);
        mat.metallic = 0.75; mat.roughness = 0.18;
        body.material = mat;
        body.setParent(this.root);
        this._shadowGenerator.addShadowCaster(body);
        body.receiveShadows = true;

        // Cabin
        const cabin = MeshBuilder.CreateBox("cabin", { width: 1.65, height: 0.62, depth: 2.3 }, this.scene);
        cabin.position.set(0, 1.6, -0.15);
        const cabinMat = new PBRMaterial("cabinMat", this.scene);
        cabinMat.albedoColor = new Color3(0.08, 0.12, 0.18);
        cabinMat.metallic = 0.92; cabinMat.roughness = 0.04;
        cabin.material = cabinMat;
        cabin.setParent(this.root);
        this._shadowGenerator.addShadowCaster(cabin);

        // Wheels on ground: diameter=0.75 → radius=0.375 → center at Y=0.375
        [[-1.15, 0.38, 1.45], [1.15, 0.38, 1.45], [-1.15, 0.38, -1.45], [1.15, 0.38, -1.45]].forEach(([x, y, z], i) => {
            const w = MeshBuilder.CreateCylinder(`wheel_${i}`, { height: 0.38, diameter: 0.75, tessellation: 22 }, this.scene);
            w.rotation.z = Math.PI / 2;
            w.position.set(x, y, z);
            const wm = new PBRMaterial(`wheelMat_${i}`, this.scene);
            wm.albedoColor = new Color3(0.08, 0.08, 0.08);
            wm.metallic = 0.2; wm.roughness = 0.85;
            w.material = wm;
            w.setParent(this.root);
            this._shadowGenerator.addShadowCaster(w);
        });
    }

    private _checkCollision(nextPos: Vector3): boolean {
        for (const obs of this._obstacles) {
            const dx = nextPos.x - obs.x;
            const dz = nextPos.z - obs.z;
            if (Math.sqrt(dx * dx + dz * dz) < CAR_RADIUS + obs.radius) {
                return true;
            }
        }
        return false;
    }

    private _update() {
        const W = this._keys["w"] || this._keys["ArrowUp"];
        const S = this._keys["s"] || this._keys["ArrowDown"];
        const A = this._keys["a"] || this._keys["ArrowLeft"];
        const D = this._keys["d"] || this._keys["ArrowRight"];
        const SPACE = this._keys[" "];
        const { engineForce, brakeForce, maxSteerAngle, steerSpeed, drag } = this._config;

        // Speed
        if (W) { this._speed += engineForce; }
        else if (S) { this._speed -= brakeForce * 1.6; }
        else if (SPACE) { this._speed *= 0.86; }
        else {
            if (Math.abs(this._speed) < drag) this._speed = 0;
            else this._speed -= Math.sign(this._speed) * drag;
        }
        this._speed = Math.max(-2.0, Math.min(5.0, this._speed));

        // Steering
        if ((A || D) && Math.abs(this._speed) > 0.05) {
            const dir = A ? 1 : -1;
            const sign = this._speed < 0 ? -1 : 1;
            const sf = 1 - Math.abs(this._speed) / 7;
            this._steer += dir * sign * steerSpeed * sf;
        } else {
            this._steer *= 0.80;
        }
        this._steer = Math.max(-maxSteerAngle, Math.min(maxSteerAngle, this._steer));

        if (Math.abs(this._speed) > 0.01) {
            this.root.rotation.y += this._steer * this._speed * 3.2;
        }

        // Move & collide
        const forward = new Vector3(Math.sin(this.root.rotation.y), 0, Math.cos(this.root.rotation.y));
        const delta = forward.scale(this._speed * 0.1);
        const nextPos = this.root.position.add(delta);

        if (this._checkCollision(nextPos)) {
            this._speed *= -0.30; // Bounce
        } else {
            this.root.position.x = nextPos.x;
            this.root.position.z = nextPos.z;
        }

        // Lock to ground — always Y=0
        this.root.position.y = 0;

        // Speedometer
        const kmh = Math.floor(Math.abs(this._speed) * 65);
        const el = document.getElementById("speed-val");
        if (el) el.innerText = kmh.toString();
    }

    get speed() { return this._speed; }
}
