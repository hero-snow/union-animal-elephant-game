import Phaser, { Scene, GameObjects } from 'phaser';
import decomp from 'poly-decomp';
import { SoundEffects } from '../audio/SoundEffects';
import { EffectsManager, ElephantSnapshot } from '../effects/EffectsManager';

type MatterGameObject = GameObjects.Image & { body: MatterJS.BodyType };

interface Point {
    x: number;
    y: number;
}

interface PendingMerge {
    objA: MatterGameObject;
    objB: MatterGameObject;
}

const ANIMAL_SPECS = [
    { name: 'ねずみ', radius: 30, image: 'animal_0.png', score: 10 },
    { name: 'うさぎ', radius: 40, image: 'animal_1.png', score: 20 },
    { name: 'ねこ', radius: 60, image: 'animal_2.png', score: 30 },
    { name: 'いぬ', radius: 70, image: 'animal_3.png', score: 40 },
    { name: 'きつね', radius: 80, image: 'animal_4.png', score: 50 },
    { name: 'うま', radius: 100, image: 'animal_5.png', score: 60 },
    { name: 'きりん', radius: 120, image: 'animal_6.png', score: 70 },
    { name: 'ライオン', radius: 140, image: 'animal_7.png', score: 80 },
    { name: 'ぞう', radius: 160, image: 'animal_8.png', score: 90 }
];

const ELEPHANT_INDEX = ANIMAL_SPECS.length - 1;
const ELEPHANT_MERGE_BONUS = 500;

const BOARD_LEFT = 50;
const BOARD_RIGHT = 550;
const BOARD_WIDTH = BOARD_RIGHT - BOARD_LEFT;
const BOARD_TOP = 124;
const BOARD_BOTTOM = 788;
const BOARD_HEIGHT = BOARD_BOTTOM - BOARD_TOP;
const BOARD_CORNER_RADIUS = 8;
const WALL_THICKNESS = 300;

const GAME_OVER_LINE_Y = 180;
const GAME_OVER_DELAY = 2000;
const INDICATOR_Y = 102;
const DROP_Y = 116;
const DROP_COOLDOWN_MS = 260;
const COMBO_WINDOW_MS = 1800;

const COLORS = {
    background: 0xf2f9ea,
    primary: 0x29664c,
    primaryLight: 0xb9f9d6,
    secondary: 0x8f4816,
    tertiary: 0xffd709,
    surface: 0xe2ebda,
    text: 0x2a3127
};

const FONT_FAMILY = 'Plus Jakarta Sans, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif';

export class Game extends Scene {
    private score: number = 0;
    private highScore: number = 0;
    private elephantMerges: number = 0;
    private scoreText!: GameObjects.Text;
    private highScoreText!: GameObjects.Text;

    private currentAnimalIndex: number = 0;
    private nextAnimalIndex: number = 0;
    private currentAnimalIndicator: GameObjects.Image | null = null;
    private nextPreviewImage: GameObjects.Image | null = null;
    private dropGuideLine!: GameObjects.Graphics;
    private gameOverLineGraphics!: GameObjects.Graphics;

    private gameOver: boolean = false;
    private gameOverTimer: number = 0;
    private gameOverOverlay: GameObjects.Container | null = null;

    private bgGraphics!: GameObjects.Graphics;
    private cachedVertices: Point[][] = [];
    private wallBodies: MatterJS.BodyType[] = [];
    private pendingMerges: PendingMerge[] = [];

    private lastDropTime: number = 0;
    private lastMergeTime: number = 0;
    private comboCount: number = 0;

    private soundEffects!: SoundEffects;
    private effects!: EffectsManager;
    private muteBtnContainer!: GameObjects.Container;
    private muteBtnLabel!: GameObjects.Text;
    private isNewHighScore: boolean = false;

    constructor() {
        super('Game');
    }

    preload() {
        const savedHighScore = localStorage.getItem('suikaHighScore');
        if (savedHighScore) {
            this.highScore = parseInt(savedHighScore, 10) || 0;
        }

        ANIMAL_SPECS.forEach((spec, index) => {
            this.load.image(`animal_${index}`, `assets/images/${spec.image}`);
        });
    }

    create() {
        (window as unknown as { decomp: typeof decomp }).decomp = decomp;
        const matterLib = (Phaser.Physics.Matter as unknown as { Matter?: { Common?: { setDecomp: (d: typeof decomp) => void } } }).Matter;
        if (matterLib && matterLib.Common) {
            matterLib.Common.setDecomp(decomp);
        }

        this.soundEffects = new SoundEffects();
        this.effects = new EffectsManager(this);

        this.bgGraphics = this.add.graphics().setDepth(0);
        this.drawBackground();

        this.dropGuideLine = this.add.graphics().setDepth(1);
        this.gameOverLineGraphics = this.add.graphics().setDepth(2);
        this.drawGameOverLine(0);

        this.generateAnimalVertices();
        this.createWalls();
        this.setupUI();
        this.resetGame();

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.soundEffects.unlock();
            if (this.gameOver) return;
            // Ignore clicks on the top HUD mute button area
            if (pointer.y <= 54 && pointer.x >= 510) return;
            this.dropAnimal(pointer.x);
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!this.gameOver) {
                this.updateAnimalIndicator(pointer.x);
            }
        });

        this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
            if (this.gameOver) return;

            for (const pair of event.pairs) {
                const { bodyA, bodyB } = pair;
                const objA = bodyA.gameObject as MatterGameObject | null;
                const objB = bodyB.gameObject as MatterGameObject | null;

                if (!objA || !objB || objA === objB) continue;

                const indexA = objA.getData('index') as number | undefined;
                const indexB = objB.getData('index') as number | undefined;
                if (indexA === undefined || indexB === undefined) continue;

                if (indexA === indexB) {
                    if (objA.getData('merging') || objB.getData('merging')) continue;
                    objA.setData('merging', true);
                    objB.setData('merging', true);
                    this.pendingMerges.push({ objA, objB });
                } else {
                    const relVx = (bodyA.velocity?.x ?? 0) - (bodyB.velocity?.x ?? 0);
                    const relVy = (bodyA.velocity?.y ?? 0) - (bodyB.velocity?.y ?? 0);
                    this.soundEffects.playImpact(Math.hypot(relVx, relVy));
                }
            }
        });

        this.matter.world.on('afterupdate', () => {
            if (!this.gameOver) {
                this.processPendingMerges();
            } else {
                this.pendingMerges.length = 0;
            }
            this.enforceWallBounds();
        });

        this.input.keyboard?.on('keydown-R', () => {
            if (this.gameOver) {
                this.resetGame();
            }
        });
    }

    private createWalls(): void {
        if (this.wallBodies.length > 0) return;

        const wallOpts: Phaser.Types.Physics.Matter.MatterBodyConfig = {
            isStatic: true,
            friction: 0.25,
            frictionStatic: 0.25,
            restitution: 0.2,
            label: 'wall'
        };

        // Thick side walls extending high above BOARD_TOP so animals can never tunnel or spill sideways
        const leftWall = this.matter.add.rectangle(
            BOARD_LEFT - WALL_THICKNESS / 2,
            250,
            WALL_THICKNESS,
            1800,
            wallOpts
        );
        const rightWall = this.matter.add.rectangle(
            BOARD_RIGHT + WALL_THICKNESS / 2,
            250,
            WALL_THICKNESS,
            1800,
            wallOpts
        );
        const bottomWall = this.matter.add.rectangle(
            300,
            BOARD_BOTTOM + WALL_THICKNESS / 2,
            1200,
            WALL_THICKNESS,
            wallOpts
        );

        this.wallBodies = [leftWall, rightWall, bottomWall];
    }

    private drawBackground(): void {
        this.bgGraphics.clear();

        // Subtle soft shadow behind the playfield box
        this.bgGraphics.fillStyle(COLORS.primary, 0.08);
        this.bgGraphics.fillRoundedRect(BOARD_LEFT - 4, BOARD_TOP + 2, BOARD_WIDTH + 8, BOARD_HEIGHT + 6, BOARD_CORNER_RADIUS + 4);

        // Main playfield surface
        this.bgGraphics.fillStyle(COLORS.surface, 1);
        this.bgGraphics.fillRoundedRect(BOARD_LEFT, BOARD_TOP, BOARD_WIDTH, BOARD_HEIGHT, BOARD_CORNER_RADIUS);

        // Subtle vertical canopy light stripes clipped inside board area
        this.bgGraphics.fillStyle(0xffffff, 0.2);
        this.bgGraphics.fillRect(BOARD_LEFT + 60, BOARD_TOP + 6, 44, BOARD_HEIGHT - 12);
        this.bgGraphics.fillRect(BOARD_LEFT + 340, BOARD_TOP + 6, 28, BOARD_HEIGHT - 12);

        // Outer border drawn outside the inner wall faces so inner playfield stays crisp
        this.bgGraphics.lineStyle(4, COLORS.primary, 0.65);
        this.bgGraphics.strokeRoundedRect(
            BOARD_LEFT - 2,
            BOARD_TOP - 2,
            BOARD_WIDTH + 4,
            BOARD_HEIGHT + 4,
            BOARD_CORNER_RADIUS + 2
        );
    }

    private setupUI(): void {
        const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
            fontSize: '23px',
            color: '#2a3127',
            fontFamily: FONT_FAMILY,
            fontStyle: 'bold'
        };

        this.scoreText = this.add.text(BOARD_LEFT, 16, `得点: ${this.score}`, textStyle).setDepth(10);

        // Next animal preview pill in center HUD
        const nextBg = this.add.graphics().setDepth(10);
        nextBg.fillStyle(COLORS.surface, 1);
        nextBg.fillRoundedRect(228, 8, 96, 42, 21);
        nextBg.lineStyle(2, COLORS.primary, 0.45);
        nextBg.strokeRoundedRect(228, 8, 96, 42, 21);

        this.add.text(244, 29, 'つぎ', {
            fontSize: '14px',
            color: '#29664c',
            fontFamily: FONT_FAMILY,
            fontStyle: 'bold'
        }).setOrigin(0, 0.5).setDepth(10);

        this.nextPreviewImage = this.add.image(298, 29, 'animal_0').setDepth(10);

        this.highScoreText = this.add.text(504, 17, `最高: ${this.highScore}`, {
            ...textStyle,
            fontSize: '20px'
        }).setOrigin(1, 0).setDepth(10);

        // Sound mute toggle button
        this.muteBtnContainer = this.add.container(534, 29).setDepth(12);
        const muteCircle = this.add.circle(0, 0, 17, COLORS.surface, 1);
        muteCircle.setStrokeStyle(2, COLORS.primary, 0.5);
        this.muteBtnLabel = this.add.text(0, 0, this.soundEffects.isMuted() ? '🔇' : '🔊', {
            fontSize: '16px'
        }).setOrigin(0.5);
        this.muteBtnContainer.add([muteCircle, this.muteBtnLabel]);
        this.muteBtnContainer.setSize(34, 34).setInteractive({ useHandCursor: true });
        this.muteBtnContainer.on('pointerdown', () => {
            const muted = this.soundEffects.toggleMute();
            this.muteBtnLabel.setText(muted ? '🔇' : '🔊');
        });
    }

    update(_time: number, delta: number) {
        if (this.gameOver) return;

        const now = this.time.now;
        let isAnimalOverLine = false;
        const bodies = this.matter.world.getAllBodies();

        for (const body of bodies) {
            if (!body.gameObject) continue;
            const animal = body.gameObject as MatterGameObject;
            const index = animal.getData('index') as number | undefined;
            if (index === undefined) continue;

            const graceUntil = (animal.getData('dropGraceUntil') as number | undefined) ?? 0;
            if (now < graceUntil) continue;

            if (body.bounds && body.bounds.min.y < GAME_OVER_LINE_Y) {
                isAnimalOverLine = true;
                break;
            }
        }

        if (isAnimalOverLine) {
            this.gameOverTimer += delta;
            const progress = Math.min(1, this.gameOverTimer / GAME_OVER_DELAY);
            this.drawGameOverLine(progress);
            if (this.gameOverTimer > GAME_OVER_DELAY) {
                this.triggerGameOver();
            }
        } else {
            if (this.gameOverTimer > 0) {
                this.gameOverTimer = 0;
                this.drawGameOverLine(0);
            }
        }
    }

    private drawGameOverLine(dangerProgress: number): void {
        this.gameOverLineGraphics.clear();
        const isDanger = dangerProgress > 0;
        const color = isDanger ? 0xd9381e : COLORS.secondary;
        const alpha = isDanger ? 0.55 + Math.abs(Math.sin(this.time.now * 0.012)) * 0.45 : 0.45;

        this.gameOverLineGraphics.lineStyle(isDanger ? 3 : 2, color, alpha);
        this.gameOverLineGraphics.beginPath();
        for (let x = BOARD_LEFT + 6; x < BOARD_RIGHT - 6; x += 20) {
            this.gameOverLineGraphics.moveTo(x, GAME_OVER_LINE_Y);
            this.gameOverLineGraphics.lineTo(Math.min(x + 10, BOARD_RIGHT - 6), GAME_OVER_LINE_Y);
        }
        this.gameOverLineGraphics.strokePath();

        if (isDanger) {
            const barWidth = (BOARD_WIDTH - 16) * dangerProgress;
            this.gameOverLineGraphics.fillStyle(0xd9381e, 0.3);
            this.gameOverLineGraphics.fillRect(BOARD_LEFT + 8, GAME_OVER_LINE_Y - 3, barWidth, 6);
        }
    }

    private resetGame(): void {
        this.gameOver = false;
        this.score = 0;
        this.elephantMerges = 0;
        this.gameOverTimer = 0;
        this.comboCount = 0;
        this.lastMergeTime = 0;
        this.lastDropTime = 0;
        this.isNewHighScore = false;
        this.pendingMerges.length = 0;

        this.scoreText.setText(`得点: ${this.score}`);
        this.drawGameOverLine(0);

        const bodies = this.matter.world.getAllBodies().slice();
        for (const body of bodies) {
            if (body.gameObject) {
                const go = body.gameObject as GameObjects.GameObject;
                if (go.getData('index') !== undefined) {
                    go.destroy();
                }
            }
        }

        if (this.gameOverOverlay) {
            this.gameOverOverlay.destroy();
            this.gameOverOverlay = null;
        }

        this.currentAnimalIndex = Math.floor(Math.random() * 3);
        this.nextAnimalIndex = Math.floor(Math.random() * 3);
        this.updateNextPreview();
        this.createAnimalIndicator();
    }

    private updateNextPreview(): void {
        if (!this.nextPreviewImage) return;
        const key = `animal_${this.nextAnimalIndex}`;
        this.nextPreviewImage.setTexture(key);
        const frame = this.textures.getFrame(key);
        const maxDim = 28;
        const scale = Math.min(maxDim / frame.width, maxDim / frame.height);
        this.nextPreviewImage.setDisplaySize(frame.width * scale, frame.height * scale);
    }

    private triggerGameOver(): void {
        this.gameOver = true;
        this.dropGuideLine.clear();
        this.soundEffects.playGameOver();

        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.isNewHighScore = true;
            localStorage.setItem('suikaHighScore', this.highScore.toString());
            this.highScoreText.setText(`最高: ${this.highScore}`);
            this.effects.pulseText(this.highScoreText);
        }

        this.createGameOverOverlay();
        if (this.currentAnimalIndicator) {
            this.currentAnimalIndicator.destroy();
            this.currentAnimalIndicator = null;
        }
    }

    private createGameOverOverlay(): void {
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.72);
        bg.fillRect(0, 0, 600, 800);

        const card = this.add.graphics();
        card.fillStyle(0xffffff, 1);
        card.fillRoundedRect(85, 220, 430, 360, 28);
        card.lineStyle(6, COLORS.primary, 1);
        card.strokeRoundedRect(85, 220, 430, 360, 28);

        const title = this.add.text(300, 280, 'ゲームオーバー！', {
            fontSize: '42px',
            color: '#8f4816',
            fontFamily: FONT_FAMILY,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const items: GameObjects.GameObject[] = [bg, card, title];

        if (this.isNewHighScore) {
            const recordBadge = this.add.text(300, 326, '★ 新記録達成！ ★', {
                fontSize: '20px',
                color: '#d97706',
                fontFamily: FONT_FAMILY,
                fontStyle: 'bold'
            }).setOrigin(0.5);
            items.push(recordBadge);
        }

        const scoreSummary = this.add.text(300, 370, `スコア: ${this.score}`, {
            fontSize: '28px',
            color: '#2a3127',
            fontFamily: FONT_FAMILY,
            fontStyle: 'bold'
        }).setOrigin(0.5);
        items.push(scoreSummary);

        if (this.elephantMerges > 0) {
            const elephantSummary = this.add.text(300, 408, `👑 ぞう合体回数: ${this.elephantMerges}回`, {
                fontSize: '18px',
                color: '#29664c',
                fontFamily: FONT_FAMILY,
                fontStyle: 'bold'
            }).setOrigin(0.5);
            items.push(elephantSummary);
        }

        const restartBtn = this.add.container(300, 495);
        const btnBg = this.add.graphics();
        btnBg.fillStyle(COLORS.primary, 1);
        btnBg.fillRoundedRect(-110, -30, 220, 60, 30);
        btnBg.fillStyle(0x1b5a40, 1);
        btnBg.fillRoundedRect(-110, 22, 220, 10, 5);

        const btnText = this.add.text(0, -2, 'もう一度 (R)', {
            fontSize: '22px',
            color: '#ffffff',
            fontFamily: FONT_FAMILY,
            fontStyle: 'bold'
        }).setOrigin(0.5);

        restartBtn.add([btnBg, btnText]);
        restartBtn.setSize(220, 60).setInteractive({ useHandCursor: true });

        restartBtn.on('pointerdown', () => restartBtn.setScale(0.95));
        restartBtn.on('pointerup', () => {
            restartBtn.setScale(1);
            this.resetGame();
        });

        items.push(restartBtn);
        this.gameOverOverlay = this.add.container(0, 0, items).setDepth(50);
    }

    private createAnimalIndicator(): void {
        if (this.currentAnimalIndicator) this.currentAnimalIndicator.destroy();
        this.currentAnimalIndicator = this.add.image(300, INDICATOR_Y, `animal_${this.currentAnimalIndex}`).setDepth(8);
        this.currentAnimalIndicator.setScale(0.4);
        this.tweens.add({
            targets: this.currentAnimalIndicator,
            scale: 1,
            duration: 160,
            ease: 'Back.easeOut',
            onUpdate: () => {
                if (this.currentAnimalIndicator) {
                    const spec = ANIMAL_SPECS[this.currentAnimalIndex];
                    const displayWidth = spec.radius * 2;
                    const frame = this.textures.getFrame(`animal_${this.currentAnimalIndex}`);
                    const displayHeight = (frame.height / frame.width) * displayWidth;
                    const curScale = this.currentAnimalIndicator.scaleX;
                    this.currentAnimalIndicator.setDisplaySize(displayWidth * curScale, displayHeight * curScale);
                }
            }
        });
        this.updateAnimalIndicator(this.input.x || 300);
    }

    private updateAnimalIndicator(x: number): void {
        if (!this.currentAnimalIndicator) return;
        const spec = ANIMAL_SPECS[this.currentAnimalIndex];
        const textureKey = `animal_${this.currentAnimalIndex}`;
        const frame = this.textures.getFrame(textureKey);
        const displayWidth = spec.radius * 2;
        const displayHeight = (frame.height / frame.width) * displayWidth;

        const clampedX = Phaser.Math.Clamp(x, BOARD_LEFT + spec.radius + 2, BOARD_RIGHT - spec.radius - 2);
        this.currentAnimalIndicator.setTexture(textureKey);
        this.currentAnimalIndicator.setDisplaySize(displayWidth, displayHeight);
        this.currentAnimalIndicator.x = clampedX;
        this.currentAnimalIndicator.y = INDICATOR_Y;

        this.drawDropGuide(clampedX, INDICATOR_Y + displayHeight * 0.45);
    }

    private drawDropGuide(x: number, startY: number): void {
        this.dropGuideLine.clear();
        this.dropGuideLine.lineStyle(2, COLORS.primary, 0.22);
        this.dropGuideLine.beginPath();
        const yFrom = Math.max(BOARD_TOP, startY);
        for (let y = yFrom; y < BOARD_BOTTOM - 8; y += 14) {
            this.dropGuideLine.moveTo(x, y);
            this.dropGuideLine.lineTo(x, Math.min(y + 7, BOARD_BOTTOM - 8));
        }
        this.dropGuideLine.strokePath();
    }

    private dropAnimal(x: number): void {
        if (this.gameOver) return;
        const now = this.time.now;
        if (now - this.lastDropTime < DROP_COOLDOWN_MS) return;
        this.lastDropTime = now;

        const spec = ANIMAL_SPECS[this.currentAnimalIndex];
        const clampedX = Phaser.Math.Clamp(x, BOARD_LEFT + spec.radius + 2, BOARD_RIGHT - spec.radius - 2);

        const animal = this.createAnimal(clampedX, DROP_Y, this.currentAnimalIndex);
        animal.setData('dropGraceUntil', now + 800);
        this.clampBodyInsideBounds(animal.body);

        this.soundEffects.playDrop();
        this.effects.playDropEffect(animal.x, animal.y, spec.radius);

        this.currentAnimalIndex = this.nextAnimalIndex;
        this.nextAnimalIndex = Math.floor(Math.random() * 3);
        this.updateNextPreview();
        this.createAnimalIndicator();
    }

    private createAnimal(x: number, y: number, index: number): MatterGameObject {
        const spec = ANIMAL_SPECS[index];
        const texture = `animal_${index}`;

        const frame = this.textures.getFrame(texture);
        const textureWidth = frame.width;
        const textureHeight = frame.height;

        const displayWidth = spec.radius * 2;
        const displayHeight = (textureHeight / textureWidth) * displayWidth;

        const cached = this.cachedVertices[index];
        const scaleX = displayWidth / textureWidth;
        const scaleY = displayHeight / textureHeight;

        const scaledVertices = cached.map(v => ({
            x: v.x * scaleX,
            y: v.y * scaleY
        }));

        const image = this.add.image(x, y, texture).setDepth(5);
        image.setDisplaySize(displayWidth, displayHeight);

        // Use a small minimumArea so thin ears/whiskers/chins on smaller animals are never discarded
        const body = this.matter.add.fromVertices(
            x,
            y,
            scaledVertices,
            {
                restitution: 0.42,
                friction: 0.5,
                label: spec.name
            },
            false,
            0.01,
            0.2
        );

        image.setData('index', index);
        const matterObj = this.matter.add.gameObject(image, body) as MatterGameObject;

        // Re-align sprite origin explicitly so SetBody's FuzzyEquals(0.5) fallback never desyncs visual and physics bounds
        let originPxX: number;
        let originPxY: number;
        if (body.parts.length > 1) {
            originPxX = body.centerOffset.x;
            originPxY = body.centerOffset.y;
        } else {
            const minVertX = Math.min(...scaledVertices.map(v => v.x));
            const minVertY = Math.min(...scaledVertices.map(v => v.y));
            originPxX = minVertX - (body.bounds.min.x - body.position.x);
            originPxY = minVertY - (body.bounds.min.y - body.position.y);
        }
        matterObj.setOrigin(originPxX / displayWidth, originPxY / displayHeight);

        return matterObj;
    }

    private processPendingMerges(): void {
        if (this.pendingMerges.length === 0) return;
        const queue = this.pendingMerges.splice(0, this.pendingMerges.length);

        for (const { objA, objB } of queue) {
            if (!objA.active || !objB.active || !objA.body || !objB.body) continue;

            const indexA = objA.getData('index') as number | undefined;
            const indexB = objB.getData('index') as number | undefined;
            if (indexA === undefined || indexA !== indexB) continue;

            if (indexA === ELEPHANT_INDEX) {
                this.handleElephantMerge(objA, objB);
            } else if (indexA + 1 < ANIMAL_SPECS.length) {
                this.handleNormalMerge(objA, objB, indexA + 1);
            }
        }
    }

    private registerCombo(): number {
        const now = this.time.now;
        if (now - this.lastMergeTime <= COMBO_WINDOW_MS) {
            this.comboCount += 1;
        } else {
            this.comboCount = 1;
        }
        this.lastMergeTime = now;
        return this.comboCount;
    }

    private addScore(points: number): void {
        this.score += points;
        this.scoreText.setText(`得点: ${this.score}`);
        this.effects.pulseText(this.scoreText);

        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.isNewHighScore = true;
            localStorage.setItem('suikaHighScore', this.highScore.toString());
            this.highScoreText.setText(`最高: ${this.highScore}`);
            this.effects.pulseText(this.highScoreText);
        }
    }

    private handleNormalMerge(objA: MatterGameObject, objB: MatterGameObject, nextIndex: number): void {
        const newX = (objA.body.position.x + objB.body.position.x) / 2;
        const newY = (objA.body.position.y + objB.body.position.y) / 2;

        objA.destroy();
        objB.destroy();

        const evolved = this.createAnimal(newX, newY, nextIndex);
        evolved.setData('dropGraceUntil', this.time.now + 500);
        this.clampBodyInsideBounds(evolved.body);

        const combo = this.registerCombo();
        const baseScore = ANIMAL_SPECS[nextIndex].score;
        const comboBonus = combo >= 2 ? Math.floor(baseScore * 0.25 * (combo - 1)) : 0;
        const totalGain = baseScore + comboBonus;

        this.addScore(totalGain);
        this.soundEffects.playMerge(nextIndex, combo);
        this.effects.playMergeEffect(
            evolved.x,
            evolved.y,
            nextIndex,
            ANIMAL_SPECS[nextIndex].radius,
            totalGain,
            combo
        );
    }

    private handleElephantMerge(objA: MatterGameObject, objB: MatterGameObject): void {
        const snapA: ElephantSnapshot = {
            x: objA.x,
            y: objA.y,
            angle: objA.angle,
            originX: objA.originX,
            originY: objA.originY,
            displayWidth: objA.displayWidth,
            displayHeight: objA.displayHeight,
            textureKey: `animal_${ELEPHANT_INDEX}`
        };
        const snapB: ElephantSnapshot = {
            x: objB.x,
            y: objB.y,
            angle: objB.angle,
            originX: objB.originX,
            originY: objB.originY,
            displayWidth: objB.displayWidth,
            displayHeight: objB.displayHeight,
            textureKey: `animal_${ELEPHANT_INDEX}`
        };

        const midX = Phaser.Math.Clamp((snapA.x + snapB.x) / 2, BOARD_LEFT + 90, BOARD_RIGHT - 90);
        const midY = Phaser.Math.Clamp((snapA.y + snapB.y) / 2, BOARD_TOP + 120, BOARD_BOTTOM - 120);

        objA.destroy();
        objB.destroy();

        this.elephantMerges += 1;
        const combo = this.registerCombo();
        const comboBonus = combo >= 2 ? 100 * (combo - 1) : 0;
        const totalBonus = ELEPHANT_MERGE_BONUS + comboBonus;

        this.soundEffects.playElephantMerge();
        this.effects.playElephantMergeEffect(
            snapA,
            snapB,
            midX,
            midY,
            totalBonus,
            combo,
            () => {
                if (this.gameOver) return;
                this.addScore(totalBonus);
                this.applyShockwaveImpulse(midX, midY, 320, 0.04);
            }
        );
    }

    private applyShockwaveImpulse(cx: number, cy: number, maxDist: number, strength: number): void {
        const matterBody = (Phaser.Physics.Matter as unknown as { Matter: typeof MatterJS }).Matter.Body;
        const bodies = this.matter.world.getAllBodies();

        for (const body of bodies) {
            if (body.isStatic || !body.gameObject) continue;
            const dx = body.position.x - cx;
            const dy = body.position.y - cy;
            const dist = Math.hypot(dx, dy);
            if (dist < 1 || dist > maxDist) continue;

            const falloff = 1 - dist / maxDist;
            const forceMag = strength * falloff * body.mass;
            matterBody.applyForce(body, body.position, {
                x: (dx / dist) * forceMag,
                y: (dy / dist) * forceMag - forceMag * 0.35
            });
        }
    }

    private clampBodyInsideBounds(body: MatterJS.BodyType): void {
        if (!body || body.isStatic || !body.bounds) return;

        const matterBody = (Phaser.Physics.Matter as unknown as { Matter: typeof MatterJS }).Matter.Body;
        let dx = 0;
        let dy = 0;

        if (body.bounds.min.x < BOARD_LEFT) {
            dx = BOARD_LEFT - body.bounds.min.x;
        } else if (body.bounds.max.x > BOARD_RIGHT) {
            dx = BOARD_RIGHT - body.bounds.max.x;
        }

        if (body.bounds.max.y > BOARD_BOTTOM) {
            dy = BOARD_BOTTOM - body.bounds.max.y;
        }

        if (dx !== 0 || dy !== 0) {
            matterBody.translate(body, { x: dx, y: dy });
            const vx = (dx > 0 && body.velocity.x < 0) || (dx < 0 && body.velocity.x > 0) ? 0 : body.velocity.x;
            const vy = dy < 0 && body.velocity.y > 0 ? 0 : body.velocity.y;
            matterBody.setVelocity(body, { x: vx, y: vy });
        }
    }

    private enforceWallBounds(): void {
        const bodies = this.matter.world.getAllBodies();
        for (const body of bodies) {
            if (body.isStatic || !body.gameObject) continue;
            const go = body.gameObject as GameObjects.GameObject;
            if (go.getData('index') === undefined) continue;
            this.clampBodyInsideBounds(body);
        }
    }

    private extractOutlinePoints(textureKey: string): Point[] {
        const frame = this.textures.getFrame(textureKey);
        const sourceImage = frame.source.image as HTMLImageElement;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return [];

        const width = frame.width;
        const height = frame.height;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(sourceImage, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const alphaThreshold = 50;
        const isSolid = (x: number, y: number): boolean => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            return data[(y * width + x) * 4 + 3] > alphaThreshold;
        };

        let startX = -1;
        let startY = -1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (isSolid(x, y)) {
                    startX = x;
                    startY = y;
                    break;
                }
            }
            if (startX !== -1) break;
        }

        if (startX === -1) return [];

        const DIRS = [
            { x: -1, y: 0 },  // 0: W
            { x: -1, y: -1 }, // 1: NW
            { x: 0, y: -1 },  // 2: N
            { x: 1, y: -1 },  // 3: NE
            { x: 1, y: 0 },   // 4: E
            { x: 1, y: 1 },   // 5: SE
            { x: 0, y: 1 },   // 6: S
            { x: -1, y: 1 }   // 7: SW
        ];

        const contour: Point[] = [];
        let currX = startX;
        let currY = startY;
        let backDir = 0;

        const maxSteps = width * height * 4;
        let steps = 0;

        while (steps < maxSteps) {
            contour.push({ x: currX, y: currY });
            steps++;

            let foundNext = false;
            const startSearch = (backDir + 1) % 8;

            for (let i = 0; i < 8; i++) {
                const dirIdx = (startSearch + i) % 8;
                const nextX = currX + DIRS[dirIdx].x;
                const nextY = currY + DIRS[dirIdx].y;

                if (isSolid(nextX, nextY)) {
                    backDir = (dirIdx + 4) % 8;
                    currX = nextX;
                    currY = nextY;
                    foundNext = true;
                    break;
                }
            }

            if (!foundNext) break;
            if (currX === startX && currY === startY) break;
        }

        return contour;
    }

    private distanceToSegment(p: Point, a: Point, b: Point): number {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (dx === 0 && dy === 0) {
            return Math.hypot(p.x - a.x, p.y - a.y);
        }
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
        const clampedT = Math.max(0, Math.min(1, t));
        const projX = a.x + clampedT * dx;
        const projY = a.y + clampedT * dy;
        return Math.hypot(p.x - projX, p.y - projY);
    }

    private rdpRecursive(points: Point[], epsilon: number): Point[] {
        if (points.length <= 2) return points;

        let maxDist = 0;
        let maxIndex = 0;
        const first = points[0];
        const last = points[points.length - 1];

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.distanceToSegment(points[i], first, last);
            if (dist > maxDist) {
                maxDist = dist;
                maxIndex = i;
            }
        }

        if (maxDist > epsilon) {
            const left = this.rdpRecursive(points.slice(0, maxIndex + 1), epsilon);
            const right = this.rdpRecursive(points.slice(maxIndex), epsilon);
            return left.slice(0, left.length - 1).concat(right);
        } else {
            return [first, last];
        }
    }

    private simplifyPolygonRDP(contour: Point[], epsilon: number): Point[] {
        if (contour.length <= 4) return contour;

        let maxD = 0;
        let splitIdx = 0;
        const p0 = contour[0];
        for (let i = 1; i < contour.length; i++) {
            const d = Math.hypot(contour[i].x - p0.x, contour[i].y - p0.y);
            if (d > maxD) {
                maxD = d;
                splitIdx = i;
            }
        }

        const chain1 = contour.slice(0, splitIdx + 1);
        const chain2 = contour.slice(splitIdx).concat([contour[0]]);

        const rdp1 = this.rdpRecursive(chain1, epsilon);
        const rdp2 = this.rdpRecursive(chain2, epsilon);

        return rdp1.slice(0, rdp1.length - 1).concat(rdp2.slice(0, rdp2.length - 1));
    }

    private generateAnimalVertices(): void {
        ANIMAL_SPECS.forEach((_spec, index) => {
            const textureKey = `animal_${index}`;
            const frame = this.textures.getFrame(textureKey);
            const width = frame.width;
            const height = frame.height;

            const contour = this.extractOutlinePoints(textureKey);
            const simplified = this.simplifyPolygonRDP(contour, 3.0);

            if (simplified.length < 3) {
                const fallback: Point[] = [];
                const rx = width / 2;
                const ry = height / 2;
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    fallback.push({
                        x: rx + rx * Math.cos(angle),
                        y: ry + ry * Math.sin(angle)
                    });
                }
                this.cachedVertices[index] = fallback;
            } else {
                this.cachedVertices[index] = simplified;
            }
        });
    }
}
