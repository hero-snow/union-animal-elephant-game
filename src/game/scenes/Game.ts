import Phaser, { Scene, GameObjects } from 'phaser';

type MatterGameObject = (GameObjects.GameObject & { body: MatterJS.BodyType });

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
        this.bgGraphics = this.add.graphics();
        this.drawBackground();

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
            fontFamily: 'Plus Jakarta Sans, sans-serif',
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
                 if (index !== undefined) {
                    const radius = ANIMAL_SPECS[index].radius;
                    if (body.position.y - radius < GAME_OVER_LINE_Y) {
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

        const image = this.add.image(0, 0, texture);
        const displayWidth = spec.radius * 2;
        const displayHeight = (image.height / image.width) * displayWidth;
        image.setDisplaySize(displayWidth, displayHeight);

        const body = this.matter.add.circle(x, y, spec.radius, {
            restitution: 0.5,
            friction: 0.5,
            label: spec.name
        });

        const container = this.add.container(x, y, [ image ]);
        container.setData('index', index);

        return this.matter.add.gameObject(container, body) as MatterGameObject;
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
}
