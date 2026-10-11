import {
    Engine,
    Scene,
    Vector3,
    Color3,
    Color4,
    HemisphericLight,
    DirectionalLight,
    ArcRotateCamera,
    MeshBuilder,
    PBRMaterial,
    CubeTexture,
    ShadowGenerator,
    Mesh,
    StandardMaterial,
} from "@babylonjs/core";

export interface ObstacleCircle {
    x: number;
    z: number;
    radius: number;
}

export class EngineManager {
    public canvas: HTMLCanvasElement;
    public engine: Engine;
    public scene: Scene;
    public shadowGenerator!: ShadowGenerator;
    public camera!: ArcRotateCamera;
    public obstacles: ObstacleCircle[] = [];

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        this.engine = new Engine(this.canvas, true, {
            preserveDrawingBuffer: true,
            stencil: true,
            adaptToDeviceRatio: true,
        });
        this.scene = new Scene(this.engine);
        // Nice day sky — no heavy fog
        this.scene.clearColor = new Color4(0.52, 0.73, 0.93, 1);
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogColor = new Color3(0.52, 0.73, 0.93);
        this.scene.fogDensity = 0.005; // Light, airy fog — not heavy grey

        this._setupCamera();
        this._setupLighting();
        this._setupEnvironment();

        this.engine.runRenderLoop(() => this.scene.render());
        window.addEventListener("resize", () => this.engine.resize());
    }

    private _setupCamera() {
        this.camera = new ArcRotateCamera(
            "mainCamera", -Math.PI / 2, Math.PI / 4, 18,
            Vector3.Zero(), this.scene
        );
        this.camera.lowerRadiusLimit = 5;
        this.camera.upperRadiusLimit = 40;
        this.camera.upperBetaLimit = Math.PI / 2.2;
        this.camera.attachControl(this.canvas, true);
    }

    private _setupLighting() {
        // Bright hemisphere (sky/ground)
        const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), this.scene);
        hemi.intensity = 1.0;
        hemi.groundColor = new Color3(0.4, 0.35, 0.25);
        hemi.diffuse = new Color3(0.9, 0.95, 1.0);

        // Main sun — bright and warm
        const sun = new DirectionalLight("sun", new Vector3(-0.5, -1.0, -0.5), this.scene);
        sun.position = new Vector3(80, 150, 80);
        sun.intensity = 4.0;
        sun.diffuse = new Color3(1.0, 0.95, 0.8);

        // Shadow map
        this.shadowGenerator = new ShadowGenerator(2048, sun);
        this.shadowGenerator.useBlurExponentialShadowMap = true;
        this.shadowGenerator.blurKernel = 32;

        // HDRI env for PBR reflections on car
        this.scene.environmentTexture = CubeTexture.CreateFromPrefilteredData(
            "https://assets.babylonjs.com/environments/environmentSpecular.env",
            this.scene
        );
        this.scene.environmentIntensity = 1.2;
    }

    private _setupEnvironment() {
        // --- Green Grass Ground ---
        const grass = MeshBuilder.CreateGround("grass", { width: 2000, height: 2000 }, this.scene);
        const grassMat = new PBRMaterial("grassMat", this.scene);
        grassMat.albedoColor = new Color3(0.18, 0.45, 0.12);
        grassMat.metallic = 0;
        grassMat.roughness = 1.0;
        grass.material = grassMat;
        grass.receiveShadows = true;

        // --- ROAD SYSTEM ---
        // Main road (straight long road Z axis)
        this._makeRoad(0, 0, 14, 500, 0);     // Long straight road
        this._makeRoad(0, 0, 14, 500, Math.PI / 2);  // Cross road

        // Sidewalks
        this._makeSidewalk(8, 0, 3, 500, 0);
        this._makeSidewalk(-8, 0, 3, 500, 0);
        this._makeSidewalk(8, 0, 3, 500, Math.PI / 2);
        this._makeSidewalk(-8, 0, 3, 500, Math.PI / 2);

        // Lane dashes on main road
        for (let i = -24; i <= 24; i++) {
            this._makeLaneDash(0, i * 10, 0);
            this._makeLaneDash(i * 10, 0, Math.PI / 2);
        }

        // Road edge yellow lines
        this._makeRoadEdge(6.5, 500, 0);
        this._makeRoadEdge(-6.5, 500, 0);
        this._makeRoadEdge(6.5, 500, Math.PI / 2);
        this._makeRoadEdge(-6.5, 500, Math.PI / 2);

        this._addTrees();
        this._addBuildings();
    }

    private _makeRoad(x: number, z: number, width: number, length: number, rotY: number) {
        const road = MeshBuilder.CreateGround(`road_${x}_${z}`, { width, height: length }, this.scene);
        road.position.set(x, 0.02, z);
        road.rotation.y = rotY;
        const roadMat = new PBRMaterial(`roadMat_${x}_${z}`, this.scene);
        roadMat.albedoColor = new Color3(0.18, 0.18, 0.18);
        roadMat.metallic = 0;
        roadMat.roughness = 0.92;
        road.material = roadMat;
        road.receiveShadows = true;
    }

    private _makeSidewalk(offset: number, z: number, width: number, length: number, rotY: number) {
        const sw = MeshBuilder.CreateBox(`sw_${offset}_${rotY}`, { width, height: 0.12, depth: length }, this.scene);
        if (rotY === 0) {
            sw.position.set(offset, 0.06, z);
        } else {
            sw.position.set(z, 0.06, offset);
        }
        sw.rotation.y = rotY;
        const swMat = new PBRMaterial(`swMat_${offset}_${rotY}`, this.scene);
        swMat.albedoColor = new Color3(0.72, 0.72, 0.72);
        swMat.metallic = 0; swMat.roughness = 0.88;
        sw.material = swMat;
        sw.receiveShadows = true;
    }

    private _makeLaneDash(x: number, z: number, rotY: number) {
        const dash = MeshBuilder.CreateBox(`dash_${x}_${z}`, { width: 0.25, height: 0.001, depth: 3.5 }, this.scene);
        dash.position.set(x, 0.03, z);
        dash.rotation.y = rotY;
        const mat = new PBRMaterial(`dashMat_${x}_${z}`, this.scene);
        mat.albedoColor = new Color3(1, 0.95, 0.6);
        mat.metallic = 0; mat.roughness = 0.7;
        mat.emissiveColor = new Color3(0.3, 0.28, 0.1);
        dash.material = mat;
    }

    private _makeRoadEdge(offset: number, length: number, rotY: number) {
        const edge = MeshBuilder.CreateBox(`edge_${offset}_${rotY}`, { width: 0.2, height: 0.001, depth: length }, this.scene);
        if (rotY === 0) edge.position.set(offset, 0.03, 0);
        else edge.position.set(0, 0.03, offset);
        edge.rotation.y = rotY;
        const mat = new PBRMaterial(`edgeMat_${offset}_${rotY}`, this.scene);
        mat.albedoColor = new Color3(1, 0.9, 0.1);
        mat.metallic = 0; mat.roughness = 0.7;
        edge.material = mat;
    }

    private _addTrees() {
        // Trees only on the sides of roads (not on the road)
        const positions: [number, number][] = [];
        for (let i = 0; i < 120; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 15 + Math.random() * 300;
            let x = Math.cos(angle) * radius;
            let z = Math.sin(angle) * radius;

            // Avoid placing on road
            if (Math.abs(x) < 9 || Math.abs(z) < 9) {
                x += x < 0 ? -12 : 12;
                z += z < 0 ? -12 : 12;
            }
            positions.push([x, z]);

            const trunkH = 3 + Math.random() * 4;
            const trunkD = 0.5 + Math.random() * 0.5;
            const canopyD = 3.5 + Math.random() * 4;

            const trunk = MeshBuilder.CreateCylinder(`trunk_${i}`, { height: trunkH, diameter: trunkD }, this.scene);
            trunk.position.set(x, trunkH / 2, z);
            const trunkMat = new PBRMaterial(`trunkMat_${i}`, this.scene);
            trunkMat.albedoColor = new Color3(0.38, 0.24, 0.10);
            trunkMat.roughness = 0.95; trunkMat.metallic = 0;
            trunk.material = trunkMat;

            const canopy = MeshBuilder.CreateSphere(`canopy_${i}`, { diameter: canopyD, segments: 7 }, this.scene);
            canopy.position.set(x, trunkH + canopyD * 0.42, z);
            const canopyMat = new PBRMaterial(`canopyMat_${i}`, this.scene);
            const g = 0.30 + Math.random() * 0.30;
            canopyMat.albedoColor = new Color3(0.08, g, 0.08);
            canopyMat.roughness = 0.9; canopyMat.metallic = 0;
            canopy.material = canopyMat;

            [trunk, canopy].forEach(m => { this.shadowGenerator.addShadowCaster(m); m.receiveShadows = true; });
            this.obstacles.push({ x, z, radius: trunkD / 2 + 0.6 });
        }
    }

    private _addBuildings() {
        const FACADE_COLORS = [
            new Color3(0.70, 0.72, 0.78), // concrete grey
            new Color3(0.85, 0.80, 0.68), // sandstone beige
            new Color3(0.50, 0.60, 0.72), // glass blue
            new Color3(0.62, 0.50, 0.42), // brick reddish
            new Color3(0.35, 0.40, 0.45), // dark steel
            new Color3(0.78, 0.76, 0.70), // off-white
        ];

        for (let i = 0; i < 45; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 60 + Math.random() * 420;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const h = 10 + Math.random() * 85;
            const w = 8 + Math.random() * 20;
            const d = w * (0.55 + Math.random() * 0.9);
            const rot = Math.round(Math.random() * 4) * (Math.PI / 2);

            const colorIndex = Math.floor(Math.random() * FACADE_COLORS.length);
            const fc = FACADE_COLORS[colorIndex];

            // --- Main body ---
            const body = MeshBuilder.CreateBox(`bld_body_${i}`, { width: w, height: h, depth: d }, this.scene);
            body.position.set(x, h / 2, z);
            body.rotation.y = rot;
            const bMat = new PBRMaterial(`bldMat_${i}`, this.scene);
            bMat.albedoColor = fc;
            bMat.metallic = 0.15 + Math.random() * 0.45;
            bMat.roughness = 0.3 + Math.random() * 0.5;
            body.material = bMat;
            body.receiveShadows = true;
            this.shadowGenerator.addShadowCaster(body);

            // --- Windows (grid on front/back faces) ---
            const windowColor = new Color3(0.55 + Math.random() * 0.3, 0.65 + Math.random() * 0.25, 0.85);
            const floors = Math.floor(h / 4);
            const cols = Math.max(1, Math.floor(w / 3));
            for (let fl = 0; fl < floors; fl++) {
                for (let col = 0; col < cols; col++) {
                    const wx = x + (col - (cols - 1) / 2) * (w / cols);
                    const wy = 2.5 + fl * 4;
                    // Front face window
                    const win = MeshBuilder.CreateBox(`win_${i}_${fl}_${col}`, { width: w / cols * 0.55, height: 1.4, depth: 0.15 }, this.scene);
                    const wz = z + (d / 2 + 0.08);
                    win.position.set(wx, wy, wz);
                    win.rotation.y = rot;
                    const wMat = new PBRMaterial(`winMat_${i}_${fl}_${col}`, this.scene);
                    wMat.albedoColor = windowColor;
                    wMat.metallic = 0.9;
                    wMat.roughness = 0.05;
                    if (Math.random() > 0.25) { // some lit windows at night
                        wMat.emissiveColor = new Color3(
                            windowColor.r * 0.25,
                            windowColor.g * 0.25,
                            windowColor.b * 0.2
                        );
                    }
                    win.material = wMat;
                    // mesh is already added to scene by MeshBuilder
                }
            }

            // --- Rooftop detail (parapet / ledge) ---
            const parapet = MeshBuilder.CreateBox(`parapet_${i}`, { width: w + 0.5, height: 0.8, depth: d + 0.5 }, this.scene);
            parapet.position.set(x, h + 0.4, z);
            parapet.rotation.y = rot;
            const pMat = new PBRMaterial(`parapetMat_${i}`, this.scene);
            pMat.albedoColor = new Color3(fc.r * 0.85, fc.g * 0.85, fc.b * 0.85);
            pMat.metallic = 0.1; pMat.roughness = 0.8;
            parapet.material = pMat;
            parapet.receiveShadows = true;
            this.shadowGenerator.addShadowCaster(parapet);

            // --- Rooftop water tank / AC unit on tall buildings ---
            if (h > 30 && Math.random() > 0.4) {
                const tank = MeshBuilder.CreateCylinder(`tank_${i}`, { height: 3, diameter: 3 }, this.scene);
                tank.position.set(x + rnd(-w / 4, w / 4), h + 2.5, z + rnd(-d / 4, d / 4));
                const tankMat = new PBRMaterial(`tankMat_${i}`, this.scene);
                tankMat.albedoColor = new Color3(0.55, 0.55, 0.55);
                tankMat.metallic = 0.6; tankMat.roughness = 0.4;
                tank.material = tankMat;
                this.shadowGenerator.addShadowCaster(tank);
            }

            this.obstacles.push({ x, z, radius: Math.max(w, d) / 2 + 1 });
        }
    }
}

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

