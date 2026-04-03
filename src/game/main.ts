import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale,Types } from 'phaser';

// The Living Canopy Design System
// Background: #f2f9ea
// Primary: #29664c
// Secondary: #8f4816

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 600,
    height: 800,
    parent: 'game-container',
    backgroundColor: '#f2f9ea',
    physics: {
        default: 'matter',
        matter: {
            gravity: { y: 1 },
            debug: false
        }
    },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        MainGame
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
