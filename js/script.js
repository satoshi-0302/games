// Constants.js
const SYMBOL = {
    SEVEN: 0,
    BAR: 1,
    BELL: 2,
    CHERRY: 3
};

const SYMBOL_DATA = {
    [SYMBOL.SEVEN]: { id: 0, name: '7', payout: 100, img: 'seven' },
    [SYMBOL.BAR]: { id: 1, name: 'BAR', payout: 50, img: 'bar' },
    [SYMBOL.BELL]: { id: 2, name: 'BELL', payout: 20, img: 'bell' },
    [SYMBOL.CHERRY]: { id: 3, name: 'CHRY', payout: 10, img: 'cherry' }
};

const GAME_STATE = {
    INTRO: 0,
    IDLE: 1,
    SPINNING: 2,
    STOPPING: 3,
    RESULT: 4,
    FEVER: 5,
    GAMEOVER: 6,
    CLEAR: 7,
    LOADING: 99
};

const CONFIG = {
    REEL_COUNT: 3,
    VISIBLE_SYMBOLS: 3,
    SYMBOL_SIZE: 100,
    REEL_WIDTH: 120,
    REEL_HEIGHT: 300,
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    INITIAL_COINS: 100,
    BET_AMOUNT: 10,
    CLEAR_COINS: 1000,
    FEVER_TURNS: 5,
    FEVER_MULTIPLIER: 5
};

// Assets
const ASSETS = {
    cabinet: { src: 'assets/cabinet.png', img: new Image() },
    seven: { src: 'assets/seven.png', img: new Image() },
    bar: { src: 'assets/bar.png', img: new Image() },
    bell: { src: 'assets/bell.png', img: new Image() },
    cherry: { src: 'assets/cherry.png', img: new Image() },
};

// Audio.js
class AudioController {
    constructor() {
        this.ctx = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.initialized = true;
    }

    playTone(type, frequency, duration, volume = 0.1) {
        if (!this.initialized) this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);

        gain.gain.setValueAtTime(volume, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playSpinStart() {
        this.playTone('square', 150, 0.3, 0.1);
    }

    playReelStop() {
        this.playTone('triangle', 800, 0.1, 0.1);
    }

    playWin() {
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            setTimeout(() => this.playTone('sine', freq, 0.3, 0.1), i * 100);
        });
    }

    playJackpot() {
        const now = this.ctx.currentTime;
        [523.25, 523.25, 523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => this.playTone('square', freq, 0.5, 0.1), i * 150);
        });
    }
}

// Input.js
class Input {
    constructor() {
        this.keys = {};
        this.touchActive = false;
        this.onInput = null;

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.triggerInput();
            }
        });

        window.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.triggerInput();
        }, { passive: false });

        window.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'CANVAS') return; // Only trigger on canvas clicks if needed, or remove check
            this.triggerInput();
        });
    }

    triggerInput() {
        if (this.onInput) {
            this.onInput();
        }
    }

    setHandler(callback) {
        this.onInput = callback;
    }
}

// Particle.js
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 5 + 2;
        this.speedX = Math.random() * 6 - 3;
        this.speedY = Math.random() * -10 - 5;
        this.gravity = 0.5;
        this.life = 1.0;
        this.decay = Math.random() * 0.02 + 0.01;
    }

    update() {
        this.speedY += this.gravity;
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    spawn(x, y, count = 10, colors = ['#fff', '#ff0', '#f0f', '#0ff']) {
        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new Particle(x, y, color));
        }
    }

    update() {
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.life > 0);
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }
}

// Reel.js
class Reel {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = CONFIG.REEL_WIDTH;
        this.height = CONFIG.REEL_HEIGHT;

        this.symbols = [];
        this.generateStrip();

        this.offset = 0;
        this.speed = 0;
        this.isSpinning = false;
        this.isStopping = false;
        this.targetOffset = 0;
    }

    generateStrip() {
        for (let i = 0; i < 20; i++) {
            const keys = Object.keys(SYMBOL);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            this.symbols.push(SYMBOL[randomKey]);
        }
    }

    start() {
        this.isSpinning = true;
        this.isStopping = false;
        this.speed = 20 + (this.id * 5);
    }

    stop() {
        if (!this.isSpinning) return;
        this.isStopping = true;

        const symbolHeight = CONFIG.SYMBOL_SIZE;
        const currentPos = this.offset;
        const extraDistance = symbolHeight * 2;
        const snap = Math.ceil((currentPos + extraDistance) / symbolHeight) * symbolHeight;
        this.targetOffset = snap;
    }

    update() {
        if (this.isSpinning) {
            if (this.isStopping) {
                if (this.offset < this.targetOffset) {
                    this.offset += this.speed;
                    if (this.offset >= this.targetOffset) {
                        this.offset = this.targetOffset;
                        this.isSpinning = false;
                        this.isStopping = false;
                        this.speed = 0;
                        return true;
                    }
                }
            } else {
                this.offset += this.speed;
            }
        }
        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.clip();

        // White background for the reel strip
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        const symbolHeight = CONFIG.SYMBOL_SIZE;
        const totalSymbols = this.symbols.length;

        const startIdx = Math.floor(this.offset / symbolHeight) % totalSymbols;
        const pixelShift = this.offset % symbolHeight;

        for (let i = -1; i < CONFIG.VISIBLE_SYMBOLS + 1; i++) {
            let symbolIdx = (startIdx + i);
            if (symbolIdx < 0) symbolIdx += totalSymbols;
            symbolIdx %= totalSymbols;

            const symbolCode = this.symbols[symbolIdx];
            const symbolData = SYMBOL_DATA[symbolCode];

            const drawY = this.y + (i * symbolHeight) - pixelShift;

            const img = ASSETS[symbolData.img].img;
            if (img && img.complete) {
                // Draw symbol image
                // Add padding to make it look nice
                const p = 10;
                ctx.drawImage(img, this.x + p, drawY + p, this.width - p * 2, symbolHeight - p * 2);
            } else {
                // Fallback text
                ctx.fillStyle = '#000';
                ctx.fillText(symbolData.name, this.x + this.width / 2, drawY + symbolHeight / 2);
            }
        }

        ctx.restore();

        // Inner shadow lines for reel curvature effect
        const grad = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y);
        grad.addColorStop(0, 'rgba(0,0,0,0.3)');
        grad.addColorStop(0.1, 'rgba(0,0,0,0)');
        grad.addColorStop(0.9, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = grad;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    getResult() {
        const symbolHeight = CONFIG.SYMBOL_SIZE;
        const totalSymbols = this.symbols.length;
        const startIdx = Math.floor(this.offset / symbolHeight) % totalSymbols;
        let middleIdx = (startIdx + 1) % totalSymbols;
        return this.symbols[middleIdx];
    }
}

// Game.js
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.state = GAME_STATE.LOADING;
        this.coins = CONFIG.INITIAL_COINS;
        this.highScore = parseInt(localStorage.getItem('slot_highscore')) || 0;

        this.reels = [];
        this.createReels();

        this.audio = new AudioController();
        this.input = new Input();
        this.input.setHandler(() => this.handleInput());

        this.particles = new ParticleSystem();

        this.feverMode = false;
        this.feverTurns = 0;
        this.message = "LOADING...";

        this.lastTime = 0;
        this.stopIndex = 0;
        this.reachMode = false;
        this.flashTimer = 0;

        // Load Assets
        this.loadAssets();
    }

    loadAssets() {
        const keys = Object.keys(ASSETS);
        let loaded = 0;
        keys.forEach(key => {
            ASSETS[key].img.src = ASSETS[key].src;
            ASSETS[key].img.onload = () => {
                loaded++;
                if (loaded >= keys.length) {
                    this.state = GAME_STATE.INTRO;
                    this.message = "PRESS SPACE TO START";
                    console.log("Assets loaded");
                }
            };
            ASSETS[key].img.onerror = (e) => {
                console.error("Failed to load asset:", ASSETS[key].src);
                // Proceed anyway just in case? Or stuck?
                // Let's count it to avoid lock
                loaded++;
                if (loaded >= keys.length) {
                    this.state = GAME_STATE.INTRO;
                    this.message = "PRESS SPACE TO START";
                }
            };
        });
    }

    createReels() {
        const startX = (CONFIG.CANVAS_WIDTH - (CONFIG.REEL_WIDTH * 3 + 40)) / 2;
        const startY = (CONFIG.CANVAS_HEIGHT - CONFIG.REEL_HEIGHT) / 2;

        for (let i = 0; i < CONFIG.REEL_COUNT; i++) {
            this.reels.push(new Reel(i, startX + i * (CONFIG.REEL_WIDTH + 20), startY));
        }
    }

    resize() {
        const aspect = CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT;
        let w = window.innerWidth;
        let h = window.innerHeight;

        if (w / h > aspect) {
            w = h * aspect;
        } else {
            h = w / aspect;
        }

        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
    }

    start() {
        requestAnimationFrame((t) => this.loop(t));
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.state === GAME_STATE.LOADING) return;

        this.particles.update();

        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
        }

        let allStopped = true;
        this.reels.forEach(reel => {
            const stopped = reel.update();
            if (!stopped && reel.isSpinning) allStopped = false;
        });

        if (this.state === GAME_STATE.STOPPING && allStopped) {
            this.evaluateResult();
        }
    }

    handleInput() {
        if (this.state === GAME_STATE.LOADING) return;
        this.audio.init();

        switch (this.state) {
            case GAME_STATE.INTRO:
            case GAME_STATE.GAMEOVER:
            case GAME_STATE.CLEAR:
                this.resetGame();
                break;
            case GAME_STATE.IDLE:
            case GAME_STATE.RESULT:
                this.spin();
                break;
            case GAME_STATE.SPINNING:
            case GAME_STATE.STOPPING:
                this.stopReel();
                break;
        }
    }

    resetGame() {
        this.coins = CONFIG.INITIAL_COINS;
        this.feverMode = false;
        this.feverTurns = 0;
        this.state = GAME_STATE.IDLE;
        this.message = "PRESS SPACE TO SPIN";
        this.reachMode = false;
    }

    spin() {
        if (this.coins < CONFIG.BET_AMOUNT && !this.feverMode) {
            this.state = GAME_STATE.GAMEOVER;
            this.message = "GAME OVER";
            return;
        }

        if (!this.feverMode) {
            this.coins -= CONFIG.BET_AMOUNT;
        } else {
            this.feverTurns--;
            if (this.feverTurns < 0) {
                this.feverMode = false;
                this.coins -= CONFIG.BET_AMOUNT;
            }
        }

        this.state = GAME_STATE.SPINNING;
        this.stopIndex = 0;
        this.message = "SPINNING...";
        this.reachMode = false;
        this.audio.playSpinStart();

        this.reels.forEach(reel => reel.start());
    }

    stopReel() {
        if (this.stopIndex < this.reels.length) {
            this.reels[this.stopIndex].stop();
            this.audio.playReelStop();

            if (this.stopIndex === 1) {
                const r1 = this.reels[0].getResult();
                const r2 = this.reels[1].getResult();
                if (r1 === r2) {
                    this.reachMode = true;
                    this.message = "REACH!!";
                }
            }

            this.stopIndex++;

            if (this.stopIndex >= this.reels.length) {
                this.state = GAME_STATE.STOPPING;
            }
        }
    }

    evaluateResult() {
        const results = this.reels.map(r => r.getResult());

        const r1 = results[0];
        const r2 = results[1];
        const r3 = results[2];

        let payout = 0;
        let isWin = false;
        let isJackpot = false;

        if (r1 === r2 && r2 === r3) {
            payout = SYMBOL_DATA[r1].payout;
            isWin = true;
            if (r1 === SYMBOL.SEVEN) {
                isJackpot = true;
                this.triggerFever();
            }
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
            payout = 5;
            isWin = true;
        }

        if (this.feverMode && isWin) {
            payout *= CONFIG.FEVER_MULTIPLIER;
        }

        if (isWin) {
            this.coins += payout;
            this.message = `WIN! +${payout}`;
            this.flashTimer = 500;

            if (isJackpot) {
                this.audio.playJackpot();
                this.message = "JACKPOT! FEVER START!";
                this.particles.spawn(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2, 100);
            } else {
                this.audio.playWin();
                if (payout >= 50) {
                    this.particles.spawn(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2, 50);
                }
            }

            if (this.coins > this.highScore) {
                this.highScore = this.coins;
                localStorage.setItem('slot_highscore', this.highScore);
            }

            if (this.coins >= CONFIG.CLEAR_COINS) {
                this.state = GAME_STATE.CLEAR;
                this.message = "CONGRATULATIONS!";
                this.audio.playJackpot();
                this.particles.spawn(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT / 2, 200);
            } else {
                this.state = GAME_STATE.RESULT;
            }
        } else {
            this.state = GAME_STATE.IDLE;
            this.message = "TRY AGAIN";

            if (this.coins < CONFIG.BET_AMOUNT) {
                this.state = GAME_STATE.GAMEOVER;
                this.message = "GAME OVER";
            }
        }
    }

    triggerFever() {
        this.feverMode = true;
        this.feverTurns = CONFIG.FEVER_TURNS;
    }

    draw() {
        this.ctx.fillStyle = '#1e1e1e';
        if (this.flashTimer > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
            this.ctx.fillStyle = '#555';
        }
        if (this.feverMode) {
            const hue = (Date.now() / 10) % 360;
            this.ctx.fillStyle = `hsl(${hue}, 20%, 20%)`;
        }
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

        this.drawCabinet();

        this.reels.forEach((reel, index) => {
            if (this.reachMode && index === 2 && Math.floor(Date.now() / 100) % 2 === 0) {
                this.ctx.save();
                // Blink slightly stronger or usage an asset for highlight?
                // For now, simple rect is fine if behind reels
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                this.ctx.fillRect(reel.x, reel.y, reel.width, reel.height);
                this.ctx.restore();
            }
            reel.draw(this.ctx);
        });

        this.drawPayline();

        this.particles.draw(this.ctx);

        this.drawUI();
    }

    drawCabinet() {
        const ctx = this.ctx;
        const totalReelWidth = (CONFIG.REEL_WIDTH * CONFIG.REEL_COUNT) + (20 * (CONFIG.REEL_COUNT - 1));
        const startX = (CONFIG.CANVAS_WIDTH - totalReelWidth) / 2;
        const startY = (CONFIG.CANVAS_HEIGHT - CONFIG.REEL_HEIGHT) / 2;

        ctx.save();

        if (ASSETS.cabinet.img.complete) {
            // Draw the cabinet image centered
            // The image is 800x600, same as canvas
            ctx.drawImage(ASSETS.cabinet.img, 0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

            // Black out the reel area so particles/background don't show through nicely if image is transparent
            // The generated image might be transparent in the middle.
            ctx.fillStyle = '#000';
            // Draw a rect behind the reels
            // (already drawn by clearScreen, but maybe cabinet image has alpha?)
            // Let's assume cabinet image overlays everything except reel area.
        } else {
            // Fallback
            const padding = 30;
            const cx = startX - padding;
            const cy = startY - padding;
            const cw = totalReelWidth + (padding * 2);
            const ch = CONFIG.REEL_HEIGHT + (padding * 2);
            this.fillRoundRect(cx - 20, cy - 20, cw + 40, ch + 40, 20, '#222');
            ctx.fillStyle = '#000';
            this.fillRoundRect(startX - 10, startY - 10, totalReelWidth + 20, CONFIG.REEL_HEIGHT + 20, 5, '#000');
        }

        ctx.restore();
    }

    fillRoundRect(x, y, w, h, r, fillStyle) {
        const ctx = this.ctx;
        if (w < 2 * r) r = w / 2;
        if (h < 2 * r) r = h / 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();

        if (fillStyle) {
            ctx.fillStyle = fillStyle;
            ctx.fill();
        }
    }

    drawPayline() {
        const ctx = this.ctx;
        const totalReelWidth = (CONFIG.REEL_WIDTH * CONFIG.REEL_COUNT) + (20 * (CONFIG.REEL_COUNT - 1));
        const startX = (CONFIG.CANVAS_WIDTH - totalReelWidth) / 2;
        const startY = (CONFIG.CANVAS_HEIGHT - CONFIG.REEL_HEIGHT) / 2;

        const paylineY = startY + CONFIG.SYMBOL_SIZE * 1.5;

        ctx.save();

        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 10;

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        // Since we have a cabinet image now, we might need to adjust line length
        // to not look weird on top of it.
        ctx.moveTo(startX - 30, paylineY);
        ctx.lineTo(startX + totalReelWidth + 30, paylineY);
        ctx.stroke();

        ctx.fillStyle = '#ff0000';

        // Arrows
        ctx.beginPath();
        ctx.moveTo(startX - 50, paylineY - 15);
        ctx.moveTo(startX - 50, paylineY + 15);
        ctx.moveTo(startX - 20, paylineY);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(startX + totalReelWidth + 50, paylineY - 15);
        ctx.moveTo(startX + totalReelWidth + 50, paylineY + 15);
        ctx.moveTo(startX + totalReelWidth + 20, paylineY);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px Arial';
        ctx.shadowBlur = 0;
        ctx.textAlign = 'right';
        ctx.fillText("PAYLINE", startX - 60, paylineY + 5);

        ctx.restore();
    }

    drawUI() {
        // Adjust UI positions to likely fit the cabinet image
        // Usually top/bottom bars
        this.ctx.fillStyle = '#fff';
        this.ctx.font = 'bold 30px Courier New';
        this.ctx.shadowColor = '#000';
        this.ctx.shadowBlur = 5;

        // Position coins top left
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`COINS: ${this.coins}`, 40, 50);

        // Position High Score top right
        this.ctx.textAlign = 'right';
        this.ctx.fillText(`HIGH: ${this.highScore}`, CONFIG.CANVAS_WIDTH - 40, 50);

        // Message Center Bottom
        this.ctx.textAlign = 'center';
        this.ctx.font = 'bold 40px Courier New';

        // Add a background for message legibility
        const msg = this.message;
        const metrics = this.ctx.measureText(msg);

        // Check if message is empty or null
        if (msg) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
            this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT - 80, CONFIG.CANVAS_WIDTH, 60);
            this.ctx.restore();

            this.ctx.fillStyle = '#fff'; // Redraw fill style for text
            this.ctx.fillText(msg, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT - 40);
        }

        if (this.feverMode) {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`FEVER: ${this.feverTurns}`, CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT - 100);
        }
    }
}

// Start Game
window.addEventListener('load', () => {
    const game = new Game();
    game.start();
});
