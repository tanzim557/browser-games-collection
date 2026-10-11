import {
    Scene,
    Vector3,
    MeshBuilder,
    PBRMaterial,
    Color3,
    TransformNode,
    Mesh,
} from "@babylonjs/core";
import type { ShadowGenerator } from "@babylonjs/core";

// Skin/clothing tone palettes for variety
const SKIN_COLORS = [
    new Color3(0.95, 0.78, 0.62),
    new Color3(0.72, 0.52, 0.35),
    new Color3(0.4,  0.25, 0.15),
    new Color3(0.85, 0.68, 0.52),
];
const SHIRT_COLORS = [
    new Color3(0.2, 0.3, 0.8),
    new Color3(0.8, 0.2, 0.2),
    new Color3(0.2, 0.7, 0.3),
    new Color3(0.9, 0.6, 0.1),
    new Color3(0.5, 0.1, 0.7),
    new Color3(0.3, 0.3, 0.3),
];
const PANT_COLORS = [
    new Color3(0.1, 0.1, 0.3),
    new Color3(0.25, 0.22, 0.18),
    new Color3(0.08, 0.08, 0.08),
    new Color3(0.4, 0.35, 0.25),
];

function rnd(a: number, b: number) { return a + Math.random() * (b - a); }

interface PedState {
    root: TransformNode;
    leftArm: Mesh;
    rightArm: Mesh;
    leftLeg: Mesh;
    rightLeg: Mesh;
    phase: number; // animation phase offset
    speed: number; // walk speed
    dirAngle: number; // current heading
    turnTimer: number; // frames until next direction change
}

export class PedestrianSystem {
    private scene: Scene;
    private shadowGen: ShadowGenerator;
    private peds: PedState[] = [];
    private frame = 0;

    constructor(scene: Scene, shadowGen: ShadowGenerator) {
        this.scene = scene;
        this.shadowGen = shadowGen;
    }

    public spawnPedestrians(count: number = 30) {
        for (let i = 0; i < count; i++) {
            const ped = this._buildHuman(i);
            this.peds.push(ped);
        }
        // Animate every frame
        this.scene.onBeforeRenderObservable.add(() => this._update());
    }

    private _buildHuman(index: number): PedState {
        const skin = SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)];
        const shirt = SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)];
        const pant = PANT_COLORS[Math.floor(Math.random() * PANT_COLORS.length)];
        const scale = rnd(0.85, 1.1);

        const root = new TransformNode(`ped_root_${index}`, this.scene);

        // Random spawn on sidewalk
        const side = Math.random() > 0.5 ? 1 : -1;
        const axis = Math.random() > 0.5 ? 'x' : 'z';
        const along = rnd(-80, 80);
        const across = side * rnd(8, 11);
        root.position = axis === 'x'
            ? new Vector3(along, 0, across)
            : new Vector3(across, 0, along);
        root.rotation.y = rnd(0, Math.PI * 2);

        const torsoH = 0.55 * scale;
        const hipH = 0.35 * scale;
        const headR = 0.145 * scale;
        const armH = 0.45 * scale;
        const armD = 0.10 * scale;
        const legH = 0.55 * scale;
        const legD = 0.115 * scale;
        const groundY = legH + hipH + torsoH + headR;

        // Torso
        const torso = MeshBuilder.CreateCylinder(`ped_torso_${index}`, { height: torsoH, diameterTop: 0.28 * scale, diameterBottom: 0.32 * scale, tessellation: 10 }, this.scene);
        torso.position.y = legH + hipH + torsoH / 2;
        this._applyMat(torso, `shirt_${index}`, shirt);
        torso.setParent(root);
        this.shadowGen.addShadowCaster(torso);

        // Hips
        const hip = MeshBuilder.CreateCylinder(`ped_hip_${index}`, { height: hipH, diameterTop: 0.30 * scale, diameterBottom: 0.30 * scale, tessellation: 10 }, this.scene);
        hip.position.y = legH + hipH / 2;
        this._applyMat(hip, `pant_hip_${index}`, pant);
        hip.setParent(root);
        this.shadowGen.addShadowCaster(hip);

        // Head
        const head = MeshBuilder.CreateSphere(`ped_head_${index}`, { diameter: headR * 2, segments: 8 }, this.scene);
        head.position.y = legH + hipH + torsoH + headR;
        this._applyMat(head, `skin_${index}`, skin);
        head.setParent(root);
        this.shadowGen.addShadowCaster(head);

        // Left Arm (pivot at shoulder)
        const leftArm = MeshBuilder.CreateCylinder(`ped_larm_${index}`, { height: armH, diameter: armD, tessellation: 8 }, this.scene) as Mesh;
        leftArm.position.set(-0.2 * scale, legH + hipH + torsoH - armH * 0.1, 0);
        leftArm.rotation.x = 0;
        this._applyMat(leftArm, `shirt_l_${index}`, shirt);
        leftArm.setParent(root);
        this.shadowGen.addShadowCaster(leftArm);

        // Right Arm
        const rightArm = MeshBuilder.CreateCylinder(`ped_rarm_${index}`, { height: armH, diameter: armD, tessellation: 8 }, this.scene) as Mesh;
        rightArm.position.set(0.2 * scale, legH + hipH + torsoH - armH * 0.1, 0);
        rightArm.rotation.x = 0;
        this._applyMat(rightArm, `shirt_r_${index}`, shirt);
        rightArm.setParent(root);
        this.shadowGen.addShadowCaster(rightArm);

        // Left Leg
        const leftLeg = MeshBuilder.CreateCylinder(`ped_lleg_${index}`, { height: legH, diameter: legD, tessellation: 8 }, this.scene) as Mesh;
        leftLeg.position.set(-0.1 * scale, legH / 2, 0);
        leftLeg.rotation.x = 0;
        this._applyMat(leftLeg, `pant_l_${index}`, pant);
        leftLeg.setParent(root);
        this.shadowGen.addShadowCaster(leftLeg);

        // Right Leg
        const rightLeg = MeshBuilder.CreateCylinder(`ped_rleg_${index}`, { height: legH, diameter: legD, tessellation: 8 }, this.scene) as Mesh;
        rightLeg.position.set(0.1 * scale, legH / 2, 0);
        rightLeg.rotation.x = 0;
        this._applyMat(rightLeg, `pant_r_${index}`, pant);
        rightLeg.setParent(root);
        this.shadowGen.addShadowCaster(rightLeg);

        return {
            root,
            leftArm, rightArm, leftLeg, rightLeg,
            phase: Math.random() * Math.PI * 2,
            speed: rnd(0.03, 0.07),
            dirAngle: root.rotation.y,
            turnTimer: Math.floor(rnd(80, 200)),
        };
    }

    private _applyMat(mesh: Mesh, id: string, color: Color3) {
        const mat = new PBRMaterial(`mat_${id}`, this.scene);
        mat.albedoColor = color;
        mat.metallic = 0;
        mat.roughness = 0.9;
        mesh.material = mat;
        mesh.receiveShadows = true;
    }

    private _update() {
        this.frame++;
        for (const ped of this.peds) {
            // Walking animation via sine wave
            const t = this.frame * 0.12 + ped.phase;
            const swing = Math.sin(t) * 0.5;

            ped.leftArm.rotation.x  =  swing;
            ped.rightArm.rotation.x = -swing;
            ped.leftLeg.rotation.x  = -swing * 0.8;
            ped.rightLeg.rotation.x =  swing * 0.8;

            // Walk forward
            ped.turnTimer--;
            if (ped.turnTimer <= 0) {
                // Random direction change
                ped.dirAngle += rnd(-Math.PI / 3, Math.PI / 3);
                ped.root.rotation.y = ped.dirAngle;
                ped.turnTimer = Math.floor(rnd(60, 200));
            }

            // Move in direction
            const dx = Math.sin(ped.dirAngle) * ped.speed;
            const dz = Math.cos(ped.dirAngle) * ped.speed;
            ped.root.position.x += dx;
            ped.root.position.z += dz;
            ped.root.position.y = 0;

            // Boundary — keep them near sidewalks, wrap if too far
            const dist = Math.sqrt(ped.root.position.x ** 2 + ped.root.position.z ** 2);
            if (dist > 200) {
                ped.root.position.x *= 0.1;
                ped.root.position.z *= 0.1;
                ped.dirAngle += Math.PI; // turn around
            }
        }
    }
}
