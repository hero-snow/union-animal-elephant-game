import { Scene, GameObjects, Matter, Types } from 'phaser';

const ANIMAL_SPECS = [
    { name: "ねずみ", radius: 20, color: 0x808080, score: 10 },
    { name: "うさぎ", radius: 25, color: 0xffffff, score: 20 },
    { name: "ねこ",   radius: 30, color: 0xffa500, score: 30 },
    { name: "いぬ",   radius: 35, color: 0x8b4513, score: 40 },
    { name: "きつね", radius: 40, color: 0xff8c00, score: 50 },
    { name: "うま",   radius: 50, color: 0xa0522d, score: 60 },
    { name: "きりん", radius: 60, color: 0xffd700, score: 70 },
    { name: "ライオン", radius: 70, color: 0xdaa520, score: 80 },
    { name: "ぞう",   radius: 80, color: 0xc0c0c0, score: 90 }
];

const GAME_OVER_LINE_Y = 100;
const GAME_OVER_DELAY = 2000; // 2 seconds in milliseconds

export class Game extends Scene {
    private score: number = 0;
    private highScore: number = 0;
    private scoreText!: GameObjects.Text;
    private highScoreText!: GameObjects.Text;
    private currentAnimalIndex!: number;
    private currentAnimalIndicator!: GameObjects.Graphics;
    private gameOver: boolean = false;
    private gameOverTimer: number = 0;
    private gameOverText!: GameObjects.Text;
    private restartText!: GameObjects.Text;
    private restartButton!: GameObjects.Text;

    constructor() {
        super('Game');
    }

    preload() {
        // Load high score from local storage
        const savedHighScore = localStorage.getItem('suikaHighScore');
        if (savedHighScore) {
            this.highScore = parseInt(savedHighScore, 10);
        }
    }

    create() {
        this.matter.world.setBounds(50, 50, 500, 750, 32, true, true, false, true);

        this.drawGameOverLine();
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
                const gameObjectA = bodyA.gameObject as Matter.MatterGameObject;
                const gameObjectB = bodyB.gameObject as Matter.MatterGameObject;

                if (gameObjectA && gameObjectB && bodyA.label === bodyB.label && bodyA.label !== "ぞう") {
                    this.evolve(gameObjectA, gameObjectB);
                }
            });
        });

        // Restart listener
        this.input.keyboard?.on('keydown-R', () => {
            if (this.gameOver) this.resetGame();
        });
    }

    update(time: number, delta: number) {
        if (this.gameOver) return;

        let isAnimalOverLine = false;
        const bodies = this.matter.world.getAllBodies();

        for (const body of bodies) {
            if (body.gameObject) {
                 const animal = body.gameObject as Matter.MatterGameObject;
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
        line.lineStyle(2, 0xff0000, 0.5);
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

        // Clear existing animals
        const bodies = this.matter.world.getAllBodies();
        const gameObjects = bodies.map(body => body.gameObject).filter(obj => obj) as Matter.MatterGameObject[];
        gameObjects.forEach(obj => {
            if (obj && typeof obj.destroy === 'function') {
                obj.destroy();
            }
        });

        // After destroying game objects, we may need to remove their bodies from the world too
        this.matter.world.setBounds(50, 50, 500, 750, 32, true, true, false, true);


        if (this.scoreText) this.scoreText.destroy();
        this.scoreText = this.add.text(50, 10, `Score: ${this.score}`, { fontSize: '24px', color: '#000' });

        if (this.highScoreText) this.highScoreText.destroy();
        this.highScoreText = this.add.text(550, 10, `High Score: ${this.highScore}`, { fontSize: '24px', color: '#000' }).setOrigin(1, 0);

        if (this.gameOverText) this.gameOverText.destroy();
        if (this.restartText) this.restartText.destroy();
        if (this.restartButton) this.restartButton.destroy();

        this.currentAnimalIndex = Math.floor(Math.random() * 3);
        if (this.currentAnimalIndicator) this.currentAnimalIndicator.destroy();
        this.createAnimalIndicator();
    }

    triggerGameOver() {
        this.gameOver = true;

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('suikaHighScore', this.highScore.toString());
            this.highScoreText.setText(`High Score: ${this.highScore}`);
        }

        this.gameOverText = this.add.text(300, 350, 'Game Over', { fontSize: '64px', color: '#ff0000' }).setOrigin(0.5);
        this.restartText = this.add.text(300, 420, 'Press R to Restart', { fontSize: '32px', color: '#000' }).setOrigin(0.5);
        this.createRestartButton();

        if (this.currentAnimalIndicator) this.currentAnimalIndicator.destroy();
    }

    createAnimalIndicator() {
        const spec = ANIMAL_SPECS[this.currentAnimalIndex];
        this.currentAnimalIndicator = this.add.graphics();
        this.updateAnimalIndicator(this.input.x);
    }

    updateAnimalIndicator(x: number) {
        const spec = ANIMAL_SPECS[this.currentAnimalIndex];
        const clampedX = Phaser.Math.Clamp(x, 50 + spec.radius, 550 - spec.radius);
        this.currentAnimalIndicator.clear();
        this.currentAnimalIndicator.lineStyle(2, 0x000000, 0.5);
        this.currentAnimalIndicator.strokeCircle(0, 0, spec.radius);
        this.currentAnimalIndicator.x = clampedX;
        this.currentAnimalIndicator.y = 50;
    }

    private createRestartButton() {
        this.restartButton = this.add.text(300, 470, 'Restart Game', {
            fontSize: '32px',
            color: '#FFF',
            backgroundColor: '#007BFF',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();

        this.restartButton.on('pointerdown', () => {
            this.resetGame();
        });
    }

    dropAnimal(x: number) {
        const spec = ANIMAL_SPECS[this.currentAnimalIndex];
        const clampedX = Phaser.Math.Clamp(x, 50 + spec.radius, 550 - spec.radius);

        this.createAnimal(clampedX, 100, this.currentAnimalIndex);

        this.currentAnimalIndex = Math.floor(Math.random() * 3);
        this.updateAnimalIndicator(this.input.x);
    }

    createAnimal(x: number, y: number, index: number): Matter.MatterGameObject {
        const spec = ANIMAL_SPECS[index];
        const circle = this.add.circle(x, y, spec.radius, spec.color);

        const body = this.matter.add.gameObject(circle, {
            shape: { type: 'circle', radius: spec.radius },
            restitution: 0.5,
            friction: 0.5,
            label: spec.name
        }) as Matter.MatterGameObject;

        body.setData('index', index);
        return body;
    }

    evolve(objA: Matter.MatterGameObject, objB: Matter.MatterGameObject) {
        const index = objA.getData('index');
        if (index === null || index + 1 >= ANIMAL_SPECS.length) {
            return;
        }
        const nextIndex = index + 1;
        const newX = (objA.x + objB.x) / 2;
        const newY = (objA.y + objB.y) / 2;
        
        this.time.delayedCall(1, () => {
            if (objA.active && objB.active) {
                objA.destroy();
                objB.destroy();
        
                this.createAnimal(newX, newY, nextIndex);
                this.score += ANIMAL_SPECS[nextIndex].score;
                this.scoreText.setText('Score: ' + this.score);
            }
        });
    }
}
