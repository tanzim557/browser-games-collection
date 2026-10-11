import { Vector3, ArcRotateCamera } from "@babylonjs/core";
import { EngineManager } from "./core/EngineManager";
import { PhysicsManager } from "./physics/PhysicsManager";
import { PlayerCar } from "./entities/PlayerCar";
import { PedestrianSystem } from "./entities/Pedestrian";

function setStatus(msg: string) {
    const el = document.getElementById("status");
    if (el) el.innerText = msg;
}

async function startGame() {
    setStatus("Initializing Engine...");
    const engineManager = new EngineManager("renderCanvas");

    setStatus("Loading Physics...");
    const physicsManager = new PhysicsManager(engineManager.scene);
    await physicsManager.initialize();

    setStatus("Loading 3D Car Model...");
    const player = new PlayerCar(engineManager.scene, engineManager.shadowGenerator, engineManager.obstacles);

    // Use the high-quality Ferrari model from Three.js examples
    await player.loadModel("https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/ferrari.glb");

    setStatus("Spawning Pedestrians...");
    const pedSystem = new PedestrianSystem(engineManager.scene, engineManager.shadowGenerator);
    pedSystem.spawnPedestrians(35);

    setStatus("Setting Up Camera...");

    // Switch camera to follow mode
    const cam = engineManager.camera;
    cam.detachControl();

    // Follow camera logic: runs every frame
    engineManager.scene.onBeforeRenderObservable.add(() => {
        if (!player.root) return;

        const carPos = player.root.position;
        const carRot = player.root.rotation.y;

        // Calculate desired camera position (behind and above the car)
        const camOffset = new Vector3(
            -Math.sin(carRot) * 12,
            4.5,
            -Math.cos(carRot) * 12
        );
        const desiredPos = carPos.add(camOffset);

        // Smooth lerp
        cam.position = Vector3.Lerp(cam.position, desiredPos, 0.1);
        cam.target = Vector3.Lerp(cam.target, carPos.add(new Vector3(0, 1.5, 0)), 0.15);
    });

    // Hide loading UI
    setStatus("Ready!");
    setTimeout(() => {
        const loadingEl = document.getElementById("loading-overlay");
        if (loadingEl) {
            loadingEl.style.opacity = "0";
            setTimeout(() => loadingEl.remove(), 600);
        }
    }, 1200);
}

startGame().catch((e) => {
    console.error(e);
    const el = document.getElementById("status");
    if (el) el.innerText = "Error: " + (e as Error).message;
});
