import Phaser, { GameObjects, Scene } from 'phaser';

export interface ElephantSnapshot {
    x: number;
    y: number;
    angle: number;
    originX: number;
    originY: number;
    displayWidth: number;
    displayHeight: number;
    textureKey: string;
}

const TIER_COLORS = [
    0x9ea7ad, // ねずみ
    0xfff3d1, // うさぎ
    0xa6b1b8, // ねこ
    0xd7a86e, // いぬ
    0xf28b30, // きつね
    0xc47b47, // うま
    0xf5b731, // きりん
    0xe89b2d, // ライオン
    0xffd709  // ぞう
];

const CONFETTI_COLORS = [
    0xffd709, // gold
    0xff6b8b, // coral pink
    0x4be0a5, // mint green
    0x56ccf2, // sky blue
    0xff9f43, // tangerine
    0xc58af9, // lavender
    0xffffff  // white
];

/**
 * Handles particle bursts, shockwaves, floating score popups,
 * and the grand celebration sequence for elephant merges.
 */
export class EffectsManager {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
        this.ensureTextures();
    }

    private ensureTextures(): void {
        if (!this.scene.textures.exists('fx_circle')) {
            const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(12, 12, 12);
            g.generateTexture('fx_circle', 24, 24);
            g.destroy();
        }

        if (!this.scene.textures.exists('fx_star')) {
            const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
            g.fillStyle(0xffffff, 1);
            const cx = 16;
            const cy = 16;
            const outer = 15;
            const inner = 6;
            const pts: Phaser.Math.Vector2[] = [];
            for (let i = 0; i < 8; i++) {
                const r = i % 2 === 0 ? outer : inner;
                const angle = (i * Math.PI) / 4 - Math.PI / 2;
                pts.push(new Phaser.Math.Vector2(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r));
            }
            g.fillPoints(pts, true);
            g.generateTexture('fx_star', 32, 32);
            g.destroy();
        }

        if (!this.scene.textures.exists('fx_confetti')) {
            const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
            g.fillStyle(0xffffff, 1);
            g.fillRoundedRect(0, 0, 14, 8, 2);
            g.generateTexture('fx_confetti', 14, 8);
            g.destroy();
        }
    }

    public playDropEffect(x: number, y: number, radius: number): void {
        const ring = this.scene.add.circle(x, y, Math.max(12, radius * 0.4), 0xb9f9d6, 0.25);
        ring.setStrokeStyle(2, 0x29664c, 0.45);
        ring.setDepth(15);

        this.scene.tweens.add({
            targets: ring,
            scale: 1.5,
            alpha: 0,
            duration: 240,
            ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
    }

    public playMergeEffect(
        x: number,
        y: number,
        newTier: number,
        radius: number,
        scoreGain: number,
        combo: number
    ): void {
        const color = TIER_COLORS[newTier] ?? 0xffd709;

        // Inner flash orb
        const flash = this.scene.add.circle(x, y, radius * 0.65, 0xffffff, 0.8);
        flash.setDepth(20);
        this.scene.tweens.add({
            targets: flash,
            scale: 1.45,
            alpha: 0,
            duration: 220,
            ease: 'Quad.easeOut',
            onComplete: () => flash.destroy()
        });

        // Expanding shockwave ring
        const ring = this.scene.add.circle(x, y, radius * 0.55);
        ring.setStrokeStyle(4, color, 0.9);
        ring.setDepth(20);
        this.scene.tweens.add({
            targets: ring,
            scale: 1.85,
            alpha: 0,
            duration: 340,
            ease: 'Cubic.easeOut',
            onComplete: () => ring.destroy()
        });

        // Star & sparkle burst
        const count = Math.min(22, 10 + newTier * 2);
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35;
            const dist = radius * (0.85 + Math.random() * 0.75);
            const useStar = i % 2 === 0;
            const p = this.scene.add.image(x, y, useStar ? 'fx_star' : 'fx_circle');
            p.setTint(i % 3 === 0 ? 0xffd709 : color);
            p.setScale((0.28 + Math.random() * 0.35) * (0.8 + newTier * 0.08));
            p.setDepth(21);

            this.scene.tweens.add({
                targets: p,
                x: x + Math.cos(angle) * dist,
                y: y + Math.sin(angle) * dist,
                scale: 0.05,
                alpha: 0,
                angle: (Math.random() - 0.5) * 240,
                duration: 320 + Math.random() * 160,
                ease: 'Quad.easeOut',
                onComplete: () => p.destroy()
            });
        }

        // Subtle camera shake for mid/high tiers
        if (newTier >= 4) {
            const intensity = 0.002 + (newTier - 3) * 0.0012;
            this.scene.cameras.main.shake(140, intensity);
        }

        // Floating score text
        this.spawnFloatingScore(x, y - radius * 0.35, scoreGain, combo);
    }

    public spawnFloatingScore(x: number, y: number, scoreGain: number, combo: number): void {
        const clampedX = Math.max(105, Math.min(495, x));
        const clampedY = Math.max(145, y);

        const label = combo >= 2 ? `+${scoreGain} (${combo}れんさ!)` : `+${scoreGain}`;
        const color = combo >= 3 ? '#ff6b35' : combo === 2 ? '#e67e22' : '#29664c';
        const fontSize = combo >= 2 ? '24px' : '20px';

        const text = this.scene.add.text(clampedX, clampedY, label, {
            fontSize,
            color,
            fontFamily: 'Plus Jakarta Sans, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
            fontStyle: 'bold',
            stroke: '#ffffff',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(30).setScale(0.6);

        this.scene.tweens.add({
            targets: text,
            scale: 1.08,
            duration: 130,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: text,
                    y: clampedY - 48,
                    scale: 0.95,
                    alpha: 0,
                    duration: 560,
                    ease: 'Cubic.easeOut',
                    onComplete: () => text.destroy()
                });
            }
        });
    }

    public pulseText(target: GameObjects.Text): void {
        this.scene.tweens.killTweensOf(target);
        target.setScale(1.16);
        this.scene.tweens.add({
            targets: target,
            scale: 1,
            duration: 180,
            ease: 'Back.easeOut'
        });
    }

    /**
     * Plays a multi-stage flashy celebration when two elephants collide and merge:
     * 1) Visual elephant clones converge into the midpoint with a glowing aura.
     * 2) Screen flash, camera shake, rotating sunburst rays, 3 shockwaves,
     *    confetti/star fountain, and a celebratory bonus banner.
     */
    public playElephantMergeEffect(
        snapA: ElephantSnapshot,
        snapB: ElephantSnapshot,
        midX: number,
        midY: number,
        bonusScore: number,
        combo: number,
        onBurst: () => void
    ): void {
        const cloneA = this.createVisualClone(snapA);
        const cloneB = this.createVisualClone(snapB);

        // Charging golden halo shrinking inward during convergence
        const chargeRing = this.scene.add.circle(midX, midY, 170);
        chargeRing.setStrokeStyle(6, 0xffd709, 0.85);
        chargeRing.setDepth(28);
        this.scene.tweens.add({
            targets: chargeRing,
            scale: 0.15,
            alpha: 1,
            duration: 180,
            ease: 'Cubic.easeIn',
            onComplete: () => chargeRing.destroy()
        });

        this.scene.cameras.main.shake(170, 0.006);

        // Converge both elephants toward the midpoint
        [cloneA, cloneB].forEach((clone, idx) => {
            clone.setTint(0xfff3b0);
            this.scene.tweens.add({
                targets: clone,
                x: midX,
                y: midY,
                scaleX: clone.scaleX * 0.55,
                scaleY: clone.scaleY * 0.55,
                angle: clone.angle + (idx === 0 ? -25 : 25),
                duration: 180,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    clone.destroy();
                }
            });
        });

        // Trigger the grand explosion once they meet
        this.scene.time.delayedCall(180, () => {
            onBurst();
            this.triggerElephantExplosion(midX, midY, bonusScore, combo);
        });
    }

    private createVisualClone(snap: ElephantSnapshot): GameObjects.Image {
        const img = this.scene.add.image(snap.x, snap.y, snap.textureKey);
        img.setDisplaySize(snap.displayWidth, snap.displayHeight);
        img.setOrigin(snap.originX, snap.originY);
        img.setAngle(snap.angle);
        img.setDepth(29);
        return img;
    }

    private triggerElephantExplosion(midX: number, midY: number, bonusScore: number, combo: number): void {
        const cam = this.scene.cameras.main;
        cam.flash(420, 255, 244, 175);
        cam.shake(520, 0.022);

        // 1. Central blinding golden-white core flash
        const core = this.scene.add.circle(midX, midY, 90, 0xffffff, 0.95);
        core.setDepth(35);
        this.scene.tweens.add({
            targets: core,
            scale: 3.4,
            alpha: 0,
            duration: 460,
            ease: 'Cubic.easeOut',
            onComplete: () => core.destroy()
        });

        // 2. Rotating sunburst light rays
        const raysContainer = this.scene.add.container(midX, midY).setDepth(32);
        const rayCount = 14;
        for (let i = 0; i < rayCount; i++) {
            const angle = (Math.PI * 2 * i) / rayCount;
            const ray = this.scene.add.triangle(
                0, 0,
                0, 0,
                340, -24,
                340, 24,
                i % 2 === 0 ? 0xffd709 : 0xfff8cc,
                0.65
            );
            ray.setOrigin(0, 0.5);
            ray.setRotation(angle);
            raysContainer.add(ray);
        }
        raysContainer.setScale(0.2);
        this.scene.tweens.add({
            targets: raysContainer,
            scale: 1.45,
            angle: 42,
            alpha: 0,
            duration: 780,
            ease: 'Cubic.easeOut',
            onComplete: () => raysContainer.destroy()
        });

        // 3. Three concentric multi-colored shockwave rings
        const ringConfigs = [
            { delay: 0, color: 0xffd709, width: 10, targetScale: 5.5, dur: 520 },
            { delay: 75, color: 0xb9f9d6, width: 8, targetScale: 4.8, dur: 560 },
            { delay: 150, color: 0xff6b8b, width: 6, targetScale: 4.2, dur: 600 }
        ];
        ringConfigs.forEach(cfg => {
            this.scene.time.delayedCall(cfg.delay, () => {
                const ring = this.scene.add.circle(midX, midY, 55);
                ring.setStrokeStyle(cfg.width, cfg.color, 0.95);
                ring.setDepth(33);
                this.scene.tweens.add({
                    targets: ring,
                    scale: cfg.targetScale,
                    alpha: 0,
                    duration: cfg.dur,
                    ease: 'Cubic.easeOut',
                    onComplete: () => ring.destroy()
                });
            });
        });

        // 4. Massive radial golden star burst
        for (let i = 0; i < 36; i++) {
            const angle = (Math.PI * 2 * i) / 36 + (Math.random() - 0.5) * 0.25;
            const dist = 120 + Math.random() * 260;
            const star = this.scene.add.image(midX, midY, 'fx_star').setDepth(36);
            star.setTint(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
            star.setScale(0.45 + Math.random() * 0.75);

            this.scene.tweens.add({
                targets: star,
                x: midX + Math.cos(angle) * dist,
                y: midY + Math.sin(angle) * dist,
                angle: (Math.random() - 0.5) * 540,
                scale: 0.05,
                alpha: 0,
                duration: 620 + Math.random() * 380,
                ease: 'Cubic.easeOut',
                onComplete: () => star.destroy()
            });
        }

        // 5. Fluttering confetti fountain across the whole board
        const emitter = this.scene.add.particles(midX, midY, 'fx_confetti', {
            speed: { min: 140, max: 520 },
            angle: { min: 0, max: 360 },
            scale: { start: 1.15, end: 0.45 },
            rotate: { min: 0, max: 360 },
            lifespan: { min: 1100, max: 1900 },
            gravityY: 420,
            alpha: { start: 1, end: 0 },
            tint: CONFETTI_COLORS,
            emitting: false
        });
        emitter.setDepth(37);
        emitter.explode(70);
        this.scene.time.delayedCall(2100, () => emitter.destroy());

        // 6. Grand floating celebratory banner
        const bannerX = 300;
        const bannerY = Math.max(240, Math.min(540, midY - 20));
        const banner = this.scene.add.container(bannerX, bannerY).setDepth(45);

        const pill = this.scene.add.graphics();
        pill.fillStyle(0x29664c, 0.94);
        pill.fillRoundedRect(-185, -52, 370, 104, 26);
        pill.lineStyle(5, 0xffd709, 1);
        pill.strokeRoundedRect(-185, -52, 370, 104, 26);

        const title = this.scene.add.text(0, -18, '👑 ぞう合体！！大爆発！！ 👑', {
            fontSize: '24px',
            color: '#ffd709',
            fontFamily: 'Plus Jakarta Sans, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
            fontStyle: 'bold',
            stroke: '#4a2c0f',
            strokeThickness: 5
        }).setOrigin(0.5);

        const subLabel = combo >= 2
            ? `+${bonusScore} BONUS! (${combo}れんさ!)`
            : `+${bonusScore} BONUS!`;
        const sub = this.scene.add.text(0, 20, subLabel, {
            fontSize: '26px',
            color: '#ffffff',
            fontFamily: 'Plus Jakarta Sans, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
            fontStyle: 'bold',
            stroke: '#8f4816',
            strokeThickness: 5
        }).setOrigin(0.5);

        banner.add([pill, title, sub]);
        banner.setScale(0.2);

        this.scene.tweens.add({
            targets: banner,
            scale: 1.08,
            duration: 240,
            ease: 'Back.easeOut',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: banner,
                    scale: 1,
                    duration: 140,
                    ease: 'Sine.easeInOut',
                    onComplete: () => {
                        this.scene.tweens.add({
                            targets: banner,
                            y: bannerY - 55,
                            alpha: 0,
                            delay: 950,
                            duration: 500,
                            ease: 'Cubic.easeIn',
                            onComplete: () => banner.destroy()
                        });
                    }
                });
            }
        });
    }
}
