import Phaser, { Scene, GameObjects } from 'phaser';
import decomp from 'poly-decomp';

type MatterGameObject = (GameObjects.GameObject & { body: MatterJS.BodyType });

interface Point {
    x: number;
    y: number;
}

const ANIMAL_SPECS = [
    { name: "ねずみ", radius: 30, image: "animal_0.png", score: 10 },
    { name: "うさぎ", radius: 40, image: "animal_1.png", score: 20 },
    { name: "ねこ",   radius: 60, image: "animal_2.png", score: 30 },
    { name: "いぬ",   radius: 70, image: "animal_3.png", score: 40 },
    { name: "きつね", radius: 80, image: "animal_4.png", score: 50 },
    { name: "うま",   radius: 100, image: "animal_5.png", score: 60 },
    { name: "きりん", radius: 120, image: "animal_6.png", score: 70 },
    { name: "ライオン", radius: 140, image: "animal_7.png", score: 80 },
    { name: "ぞう",   radius: 160, image: "animal_8.png", score: 90 }
];

const GAME_OVER_LINE_Y = 100;
const GAME_OVER_DELAY = 2000;

const COLORS = {
    background: 0xf2f9ea,
    primary: 0x29664c,
    primaryLight: 0xb9f9d6,
    secondary: 0x8f4816,
    tertiary: 0xffd709,
    surface: 0xe2ebda,
    text: 0x2a3127
};

export class Game extends Scene {
    private score: number = 0;
    private highScore: number = 0;
    private scoreText!: GameObjects.Text;
    private highScoreText!: GameObjects.Text;
    private currentAnimalIndex!: number;
    private currentAnimalIndicator: GameObjects.Image | null = null;
    private gameOver: boolean = false;
    private gameOverTimer: number = 0;
    private gameOverOverlay: GameObjects.Container | null = null;
    private bgGraphics!: GameObjects.Graphics;
    private cachedVertices: Point[][] = [];

    constructor() {
        super('Game');
    }

    preload() {
        const savedHighScore = localStorage.getItem('suikaHighScore');
        if (savedHighScore) {
            this.highScore = parseInt(savedHighScore, 10);
        }

        ANIMAL_SPECS.forEach((spec, index) => {
            this.load.image(`animal_${index}`, `assets/images/${spec.image}`);
        });
    }

    create() {
        (window as any).decomp = decomp;
        const matterLib = (Phaser.Physics.Matter as any).Matter;
        if (matterLib && matterLib.Common) {
            matterLib.Common.setDecomp(decomp);
        }

        this.bgGraphics = this.add.graphics();
        this.drawBackground();

        this.generateAnimalVertices();

        this.matter.world.setBounds(50, 50, 500, 750, 32, true, true, false, true);

        this.drawGameOverLine();
        this.setupUI();
        this.resetGame();

        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!this.gameOver) this.dropAnimal(pointer.x);
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!this.gameOver) this.updateAnimalIndicator(pointer.x);
        });

        this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
            if (this.gameOver) return;
            event.pairs.forEach(pair => {
                const { bodyA, bodyB } = pair;
                const gameObjectA = bodyA.gameObject as MatterGameObject;
                const gameObjectB = bodyB.gameObject as MatterGameObject;

                if (gameObjectA && gameObjectB && bodyA.label === bodyB.label && bodyA.label !== "ぞう") {
                    this.evolve(gameObjectA, gameObjectB);
                }
            });
        });

        this.input.keyboard?.on('keydown-R', () => {
            if (this.gameOver) this.resetGame();
        });
    }

    drawBackground() {
        this.bgGraphics.clear();
        this.bgGraphics.fillStyle(COLORS.surface, 1);
        this.bgGraphics.fillRoundedRect(50, 50, 500, 750, 20);
        this.bgGraphics.lineStyle(4, COLORS.primary, 0.5);
        this.bgGraphics.strokeRoundedRect(50, 50, 500, 750, 20);

        this.bgGraphics.lineStyle(2, COLORS.tertiary, 0.2);
        for(let i=0; i<5; i++) {
            this.bgGraphics.lineBetween(0, 0, 200 + i*100, 400);
        }
        // Game board background (rounded)  
        this.bgGraphics.fillStyle(COLORS.surface, 1);  
        this.bgGraphics.fillRoundedRect(50, 50, 500, 750, 20);  

        // Border  
        this.bgGraphics.lineStyle(4, COLORS.primary, 0.5);  
        this.bgGraphics.strokeRoundedRect(50, 50, 500, 750, 20); 
    }

    setupUI() {
        const textStyle = {
            fontSize: '28px',
            color: '#2a3127',
            fontFamily: 'Plus Jakarta Sans, "Hiragino Kaku Gothic ProN", "Hiragino Sans", Meiryo, sans-serif',
            fontStyle: 'bold'
        };

        this.scoreText = this.add.text(50, 10, `得点: ${this.score}`, textStyle);
        this.highScoreText = this.add.text(550, 10, `最高得点: ${this.highScore}`, textStyle).setOrigin(1, 0);
    }

    update(_time: number, delta: number) {
        if (this.gameOver) return;

        let isAnimalOverLine = false;
        const bodies = this.matter.world.getAllBodies();

        for (const body of bodies) {
            if (body.gameObject) {
                 const animal = body.gameObject as MatterGameObject;
                 const index = animal.getData('index');
                 if (index !== undefined && body.vertices && body.vertices.length > 0) {
                    const minY = Math.min(...body.vertices.map(v => v.y));
                    if (minY < GAME_OVER_LINE_Y) {
                        isAnimalOverLine = true;
                        break;
                    }
                 }
            }
        }

        if (isAnimalOverLine) {
            this.gameOverTimer += delta;
            if (this.gameOverTimer > GAME_OVER_DELAY) {
                this.triggerGameOver();
            }
        } else {
            this.gameOverTimer = 0;
        }
    }

    drawGameOverLine() {
        const line = this.add.graphics();
        line.lineStyle(2, 0x8f4816, 0.5);
        line.beginPath();
        for (let x = 50; x < 550; x += 20) {
            line.moveTo(x, GAME_OVER_LINE_Y);
            line.lineTo(x + 10, GAME_OVER_LINE_Y);
        }
        line.strokePath();
    }

    resetGame() {
        this.gameOver = false;
        this.score = 0;
        this.gameOverTimer = 0;
        this.scoreText.setText(`得点: ${this.score}`);

        const bodies = this.matter.world.getAllBodies();
        bodies.forEach(body => {
            if (body.gameObject) {
                (body.gameObject as GameObjects.GameObject).destroy();
            }
        });

        this.matter.world.setBounds(50, 50, 500, 750, 32, true, true, false, true);

        if (this.gameOverOverlay) {
            this.gameOverOverlay.destroy();
            this.gameOverOverlay = null;
        }

        this.currentAnimalIndex = Math.floor(Math.random() * 3);
        this.createAnimalIndicator();
    }

    triggerGameOver() {
        this.gameOver = true;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('suikaHighScore', this.highScore.toString());
            this.highScoreText.setText(`最高得点: ${this.highScore}`);
        }

        this.createGameOverOverlay();
        if (this.currentAnimalIndicator) {
            this.currentAnimalIndicator.destroy();
            this.currentAnimalIndicator = null;
        }
    }

    createGameOverOverlay() {
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRect(0, 0, 600, 800);

        const card = this.add.graphics();
        card.fillStyle(0xffffff, 1);
        card.fillRoundedRect(100, 250, 400, 300, 30);
        card.lineStyle(6, COLORS.primary, 1);
        card.strokeRoundedRect(100, 250, 400, 300, 30);

        const title = this.add.text(300, 320, 'ゲームオーバー！', {
            fontSize: '48px',
            color: '#8f4816',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const restartBtn = this.add.container(300, 450);
        const btnBg = this.add.graphics();
        btnBg.fillStyle(COLORS.primary, 1);
        btnBg.fillRoundedRect(-100, -30, 200, 60, 30);
        btnBg.fillStyle(0x1b5a40, 1);
        btnBg.fillRoundedRect(-100, 25, 200, 10, 5);

        const btnText = this.add.text(0, 0, 'もう一度', {
            fontSize: '24px',
            color: '#ffffff',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        restartBtn.add([btnBg, btnText]);
        restartBtn.setSize(200, 60).setInteractive({ useHandCursor: true });

        restartBtn.on('pointerdown', () => {
            restartBtn.setScale(0.95);
        });

        restartBtn.on('pointerup', () => {
            restartBtn.setScale(1);
            this.resetGame();
        });

        this.gameOverOverlay = this.add.container(0, 0, [bg, card, title, restartBtn]);
    }

    createAnimalIndicator() {
        if (this.currentAnimalIndicator) this.currentAnimalIndicator.destroy();
        this.currentAnimalIndicator = this.add.image(0, 50, `animal_${this.currentAnimalIndex}`);
        this.updateAnimalIndicator(this.input.x);
    }

    updateAnimalIndicator(x: number) {
        if (!this.currentAnimalIndicator) return;
        const spec = ANIMAL_SPECS[this.currentAnimalIndex];
        const clampedX = Phaser.Math.Clamp(x, 50 + spec.radius, 550 - spec.radius);
        this.currentAnimalIndicator.setTexture(`animal_${this.currentAnimalIndex}`);
        const displayWidth = spec.radius * 2;
        const displayHeight = (this.currentAnimalIndicator.height / this.currentAnimalIndicator.width) * displayWidth;
        this.currentAnimalIndicator.setDisplaySize(displayWidth, displayHeight);
        this.currentAnimalIndicator.x = clampedX;
    }

    dropAnimal(x: number) {
        if (this.gameOver) return;

        const spec = ANIMAL_SPECS[this.currentAnimalIndex];
        const clampedX = Phaser.Math.Clamp(x, 50 + spec.radius, 550 - spec.radius);

        this.createAnimal(clampedX, 100, this.currentAnimalIndex);

        this.currentAnimalIndex = Math.floor(Math.random() * 3);
        this.createAnimalIndicator();
    }

    createAnimal(x: number, y: number, index: number): MatterGameObject {
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

        const matterVertices = (Phaser.Physics.Matter as any).Matter?.Vertices || (Phaser.Physics.Matter as any).Vertices;
        const centre = matterVertices ? matterVertices.centre(scaledVertices) : {
            x: scaledVertices.reduce((sum, v) => sum + v.x, 0) / scaledVertices.length,
            y: scaledVertices.reduce((sum, v) => sum + v.y, 0) / scaledVertices.length
        };

        const image = this.add.image(x, y, texture);
        image.setDisplaySize(displayWidth, displayHeight);
        image.setOrigin(centre.x / displayWidth, centre.y / displayHeight);

        const body = this.matter.add.fromVertices(x, y, scaledVertices, {
            restitution: 0.5,
            friction: 0.5,
            label: spec.name
        });

        image.setData('index', index);

        return this.matter.add.gameObject(image, body) as MatterGameObject;
    }

    evolve(objA: MatterGameObject, objB: MatterGameObject) {
        const index = objA.getData('index');
        if (index === undefined || index === null || index + 1 >= ANIMAL_SPECS.length) {
            return;
        }

        const nextIndex = index + 1;
        const newX = (objA.body.position.x + objB.body.position.x) / 2;
        const newY = (objA.body.position.y + objB.body.position.y) / 2;
        
        this.time.delayedCall(1, () => {
            if (objA.active && objB.active) {
                objA.destroy();
                objB.destroy();

                this.createAnimal(newX, newY, nextIndex);
                this.score += ANIMAL_SPECS[nextIndex].score;
                this.scoreText.setText(`得点: ${this.score}`);
            }
        });
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
            return data[((y * width) + x) * 4 + 3] > alphaThreshold;
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
            { x: -1, y:  0 }, // 0: W
            { x: -1, y: -1 }, // 1: NW
            { x:  0, y: -1 }, // 2: N
            { x:  1, y: -1 }, // 3: NE
            { x:  1, y:  0 }, // 4: E
            { x:  1, y:  1 }, // 5: SE
            { x:  0, y:  1 }, // 6: S
            { x: -1, y:  1 }  // 7: SW
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

        const result = rdp1.slice(0, rdp1.length - 1).concat(rdp2.slice(0, rdp2.length - 1));
        return result;
    }

    private generateAnimalVertices() {
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
