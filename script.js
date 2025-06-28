document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event fired. Starting game initialization.');
    try {
        await initGame();
    } catch (e) {
        console.error("An error occurred during game initialization:", e);
        alert("ゲームの読み込み中にエラーが発生しました。開発者ツール（F12）のコンソールをご確認ください。");
    }
    console.log('DOMContentLoaded event finished.');
});

// Audio variables
let audioContext = null;
let audioBuffers = {}; // Stores fetched audio data (as ArrayBuffer or decoded AudioBuffer)
let isAudioInitialized = false; // Flag to check if AudioContext is running

// DOM Elements
const gameBoard = document.getElementById('game-board');
const healingPointsSpan = document.getElementById('healing-points');
const nemukeGaugeSpan = document.getElementById('nemuke-gauge');
const mochiStateText = document.getElementById('mochi-state-text');
const mochiAnimation = document.getElementById('mochi-animation');
const afkRewardTimerSpan = document.getElementById('afk-reward-timer');
const getNemunemuRewardBtn = document.getElementById('get-nemunemu-reward');
const furnitureStore = document.getElementById('furniture-store');
const undoButton = document.getElementById('undo-button');

// Game state variables
let healingPoints = 0;
let nemukeGauge = 0;
let mochiState = 'おきている';
let afkTime = 0;
let board = [];
let purchasedFurniture = {};
let previousBoard = [];
let previousHealingPoints = 0;
let previousNemukeGauge = 0;

const boardSize = 4;

// Data definitions
const itemImages = {
    2: 'images/item1.png', 4: 'images/item2.png', 8: 'images/item3.png',
    16: 'images/item4.png', 32: 'images/item5.png', 64: 'images/item6.png', 128: 'images/item7.png',
    256: 'images/item8.png', 512: 'images/item9.png', 1024: 'images/item10.png', 2048: 'images/item11.png',
};
const mochiImages = {
    awake: 'images/mochi_awake.png',
    sleepy: 'images/mochi_sleepy.png',
    asleep: 'images/mochi_asleep.png',
};
const furnitureData = [
    { id: 'cushion', name: 'クッション', price: 250, image: 'images/cushion.png', top: '120px', left: '50px' },
    { id: 'table', name: 'テーブル', price: 500, image: 'images/table.png', top: '100px', left: '150px' },
    { id: 'plant', name: '観葉植物', price: 400, image: 'images/plant.png', top: '20px', left: '220px' },
    { id: 'futon', name: 'ふとん', price: 300, image: 'images/futon.png', top: '150px', left: '100px' },
    { id: 'lamp', name: 'ランプ', price: 350, image: 'images/lamp.png', top: '50px', left: '20px' },
    { id: 'bookshelf', name: '本棚', price: 800, image: 'images/bookshelf.png', top: '0px', left: '0px' },
    { id: 'rug', name: 'ふわふわラグ', price: 600, image: 'images/rug.png', top: '180px', left: '80px' },
    { id: 'curtain', name: '遮光カーテン', price: 750, image: 'images/curtain.png', top: '0px', left: '100px' },
    { id: 'bedside_table', name: 'サイドテーブル', price: 450, image: 'images/bedside_table.png', top: '130px', left: '200px' },
    { id: 'wall_art', name: '壁掛けアート', price: 550, image: 'images/wall_art.png', top: '30px', left: '180px' },
    { id: 'beanbag', name: 'ビーズクッション', price: 700, image: 'images/beanbag.png', top: '160px', left: '20px' },
    { id: 'hammock', name: 'ハンモック', price: 900, image: 'images/hammock.png', top: '80px', left: '120px' }
];
const sounds = {
    merge: 'sounds/merge.wav',
    sleep: 'sounds/sleep.wav',
    reward: 'sounds/reward.wav',
};

// --- Initialization ---

async function initGame() {
    console.log('initGame started.');
    loadGame();
    setupAudioUnlock(); // Set up the one-time audio unlock listeners
    await preloadAssets();

    board = Array(boardSize * boardSize).fill(0);
    nemukeGauge = 0;
    mochiState = 'おきている';

    spawnItem();
    spawnItem();

    drawBoard();
    updateStats();
    updateMochiStatus();
    populateFurnitureStore();
    renderPurchasedFurniture();

    activateControls();

    getNemunemuRewardBtn.disabled = true;
    getNemunemuRewardBtn.addEventListener('click', claimNemunemuReward);

    undoButton.addEventListener('click', undoMove);
    undoButton.disabled = true;

    setInterval(() => {
        if (mochiState !== 'ねむっている') {
            afkTime++;
            const minutes = Math.floor(afkTime / 60).toString().padStart(2, '0');
            const seconds = (afkTime % 60).toString().padStart(2, '0');
            const afkPoints = Math.floor(afkTime / 10);
            afkRewardTimerSpan.textContent = `${minutes}:${seconds} (+${afkPoints}P)`;
            if (afkPoints >= 10) {
                getNemunemuRewardBtn.disabled = false;
            } else {
                getNemunemuRewardBtn.disabled = true;
            }
        }
    }, 1000);
    console.log('initGame finished.');
}

// --- Helper Functions ---

function setupAudioUnlock() {
    const unlockAudio = async () => {
        if (isAudioInitialized) return;
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            if (audioContext.state === 'running') {
                isAudioInitialized = true;
                console.log('AudioContext is active. Decoding all sounds...');
                // Decode all sounds now that the context is unlocked
                await Promise.all(Object.keys(sounds).map(async (soundName) => {
                    if (audioBuffers[soundName] instanceof ArrayBuffer) {
                        try {
                            const decodedData = await audioContext.decodeAudioData(audioBuffers[soundName].slice(0));
                            audioBuffers[soundName] = decodedData;
                        } catch (e) {
                            console.error(`Error decoding sound ${soundName}:`, e);
                        }
                    }
                }));
                console.log('All sounds decoded and ready.');
            }
        } catch (e) {
            console.error('Audio Unlock Failed:', e);
        }
    };

    // These listeners will be removed automatically after being called once.
    document.addEventListener('touchstart', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('keydown', unlockAudio, { once: true });
}

function playSound(soundName) {
    if (!isAudioInitialized || !audioBuffers[soundName] || !(audioBuffers[soundName] instanceof AudioBuffer)) {
        console.warn(`Cannot play sound '${soundName}'. Audio not ready or buffer not decoded.`);
        return;
    }
    try {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[soundName];
        source.connect(audioContext.destination);
        source.start(0);
    } catch (e) {
        console.error(`Error playing sound ${soundName}:`, e);
    }
}

async function preloadAssets() {
    console.log('preloadAssets started.');
    const allImagePaths = [
        ...Object.values(itemImages),
        ...Object.values(mochiImages),
        ...furnitureData.map(item => item.image)
    ];

    const imagePromises = allImagePaths.map(path => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = path;
            img.onload = resolve;
            img.onerror = reject;
        });
    });

    // Fetch sounds and store them as ArrayBuffers. Decoding will happen after user interaction.
    const soundPromises = Object.keys(sounds).map(async soundName => {
        const url = sounds[soundName];
        try {
            const response = await fetch(url);
            audioBuffers[soundName] = await response.arrayBuffer();
            console.log(`Sound fetched: ${soundName}`);
        } catch (error) {
            console.error(`Error preloading sound ${soundName}:`, error);
        }
    });

    await Promise.all([...imagePromises, ...soundPromises]);
    console.log('All assets preloaded.');
}

function spawnItem() {
    const emptyTiles = [];
    board.forEach((value, index) => {
        if (value === 0) emptyTiles.push(index);
    });
    if (emptyTiles.length > 0) {
        const randomIndex = emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
        board[randomIndex] = Math.random() < 0.9 ? 2 : 4;
    }
}

function arraysEqual(a, b) {
    return a.length === b.length && a.every((val, index) => val === b[index]);
}

function canMakeMove() {
    for (let i = 0; i < board.length; i++) {
        if (board[i] === 0) return true;
    }
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize - 1; col++) {
            const index = row * boardSize + col;
            if (board[index] !== 0 && board[index] === board[index + 1]) return true;
        }
    }
    for (let col = 0; col < boardSize; col++) {
        for (let row = 0; row < boardSize - 1; row++) {
            const index = row * boardSize + col;
            if (board[index] !== 0 && board[index] === board[index + boardSize]) return true;
        }
    }
    return false;
}

// --- Drawing Functions ---

function drawBoard() {
    board.forEach((value, index) => {
        let tile = gameBoard.children[index];
        if (!tile) {
            tile = document.createElement('div');
            tile.classList.add('tile');
            gameBoard.appendChild(tile);
        }
        const imagePath = itemImages[value];
        tile.style.backgroundImage = value !== 0 && imagePath ? `url(${imagePath})` : '';
        tile.textContent = value !== 0 && !imagePath ? value : '';
    });
}

function updateStats() {
    healingPointsSpan.textContent = healingPoints;
    nemukeGaugeSpan.textContent = `${Math.floor(nemukeGauge)} / 5000`;
    mochiStateText.textContent = mochiState;
}

function updateMochiStatus() {
    const oldMochiState = mochiState;

    if (nemukeGauge >= 5000) {
        mochiState = 'ねむっている';
    } else if (nemukeGauge >= 2501) {
        mochiState = 'ねむい';
    } else {
        mochiState = 'おきている';
    }

    let stateImage = 'awake';
    if (mochiState === 'ねむっている') {
        stateImage = 'asleep';
    } else if (mochiState === 'ねむい') {
        stateImage = 'sleepy';
    }
    mochiAnimation.style.backgroundImage = `url(${mochiImages[stateImage]})`;

    // もし、もちがちょうど眠りについたなら、サウンドを再生
    if (mochiState === 'ねむっている' && oldMochiState !== 'ねむっている') {
        playSound('sleep');
    }
}

// --- Furniture Functions ---

function populateFurnitureStore() {
    furnitureStore.innerHTML = '';
    furnitureData.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('furniture-item');
        if (purchasedFurniture[item.id]) {
            itemDiv.classList.add('purchased');
        }
        itemDiv.innerHTML = `<img src="${item.image}" alt="${item.name}"><p>${item.name}</p><p>価格: ${item.price}</p>`;
        if (!purchasedFurniture[item.id]) {
            itemDiv.addEventListener('click', () => purchaseFurniture(item));
        }
        furnitureStore.appendChild(itemDiv);
    });
}

function purchaseFurniture(item) {
    if (healingPoints >= item.price && !purchasedFurniture[item.id]) {
        healingPoints -= item.price;
        purchasedFurniture[item.id] = { top: item.top, left: item.left };
        updateStats();
        populateFurnitureStore();
        renderPurchasedFurniture();
        saveGame();
    } else {
        alert('癒しポイントが足りません！');
    }
}

function renderPurchasedFurniture() {
    const itemSpritesDiv = document.getElementById('item-sprites');
    itemSpritesDiv.innerHTML = '';
    for (const itemId in purchasedFurniture) {
        const furniture = furnitureData.find(f => f.id === itemId);
        if (furniture) {
            const img = document.createElement('img');
            img.src = furniture.image;
            img.alt = furniture.name;
            img.classList.add('furniture-sprite');
            img.dataset.id = itemId;
            const position = purchasedFurniture[itemId];
            img.style.top = position.top;
            img.style.left = position.left;
            itemSpritesDiv.appendChild(img);

            let isDragging = false;
            let offsetX, offsetY;
            const startDrag = (e) => {
                isDragging = true;
                img.classList.add('dragging');
                const event = e.type.startsWith('touch') ? e.touches[0] : e;
                const rect = img.getBoundingClientRect();
                offsetX = event.clientX - rect.left;
                offsetY = event.clientY - rect.top;
                document.addEventListener('mousemove', drag);
                document.addEventListener('touchmove', drag, { passive: false });
                document.addEventListener('mouseup', endDrag);
                document.addEventListener('touchend', endDrag);
            };
            const drag = (e) => {
                if (!isDragging) return;
                e.preventDefault();
                const event = e.type.startsWith('touch') ? e.touches[0] : e;
                const containerRect = itemSpritesDiv.getBoundingClientRect();
                let newLeft = event.clientX - containerRect.left - offsetX;
                let newTop = event.clientY - containerRect.top - offsetY;
                newLeft = Math.max(0, Math.min(newLeft, containerRect.width - img.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, containerRect.height - img.offsetHeight));
                img.style.left = `${newLeft}px`;
                img.style.top = `${newTop}px`;
            };
            const endDrag = () => {
                if (!isDragging) return;
                isDragging = false;
                img.classList.remove('dragging');
                purchasedFurniture[itemId] = { top: img.style.top, left: img.style.left };
                saveGame();
                document.removeEventListener('mousemove', drag);
                document.removeEventListener('touchmove', drag);
                document.removeEventListener('mouseup', endDrag);
                document.removeEventListener('touchend', endDrag);
            };
            img.addEventListener('mousedown', startDrag);
            img.addEventListener('touchstart', startDrag, { passive: false });
        }
    }
}

// --- Undo Function ---
function saveBoardState() {
    previousBoard = [...board];
    previousHealingPoints = healingPoints;
    previousNemukeGauge = nemukeGauge;
    undoButton.disabled = false;
}

function undoMove() {
    if (previousBoard.length > 0) {
        board = [...previousBoard];
        healingPoints = previousHealingPoints;
        nemukeGauge = previousNemukeGauge;
        drawBoard();
        updateStats();
        updateMochiStatus();
        undoButton.disabled = true;
        previousBoard = [];
    }
}

// --- Game Logic ---

let touchStartX = 0;
let touchStartY = 0;

function processMove(direction) {
    saveBoardState();
    const moved = move(direction);
    if (moved) {
        nemukeGauge += 1;
        spawnItem();
        drawBoard();
        updateStats();
        updateMochiStatus();
        checkGameOver();
        playSound('merge');
    } else {
        undoButton.disabled = true;
    }
}

function handleKeyDown(e) {
    switch (e.key) {
        case 'ArrowUp': processMove('up'); break;
        case 'ArrowDown': processMove('down'); break;
        case 'ArrowLeft': processMove('left'); break;
        case 'ArrowRight': processMove('right'); break;
    }
}

function handleTouchStart(e) {
    if (e.target.classList.contains('furniture-sprite')) return;
    e.preventDefault();
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}

function handleTouchMove(e) {
    e.preventDefault();
}

function handleTouchEnd(e) {
    if (touchStartX === 0 && touchStartY === 0) return;
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    touchStartX = 0;
    touchStartY = 0;
    handleSwipe(diffX, diffY);
}

function handleSwipe(diffX, diffY) {
    const threshold = 30;
    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > threshold) {
            processMove(diffX > 0 ? 'right' : 'left');
        }
    } else {
        if (Math.abs(diffY) > threshold) {
            processMove(diffY > 0 ? 'down' : 'up');
        }
    }
}

// --- Control Functions ---
function activateControls() {
    document.addEventListener('keydown', handleKeyDown);
    gameBoard.addEventListener('touchstart', handleTouchStart, { passive: false });
    gameBoard.addEventListener('touchmove', handleTouchMove, { passive: false });
    gameBoard.addEventListener('touchend', handleTouchEnd, { passive: false });
}

function deactivateControls() {
    document.removeEventListener('keydown', handleKeyDown);
    gameBoard.removeEventListener('touchstart', handleTouchStart);
    gameBoard.removeEventListener('touchmove', handleTouchMove);
    gameBoard.removeEventListener('touchend', handleTouchEnd);
}

function move(direction) {
    let moved = false;
    const isVertical = direction === 'up' || direction === 'down';
    const isReversed = direction === 'right' || direction === 'down';
    const originalBoard = [...board];

    for (let i = 0; i < boardSize; i++) {
        let line = [];
        for (let j = 0; j < boardSize; j++) {
            line.push(isVertical ? board[j * boardSize + i] : board[i * boardSize + j]);
        }
        if (isReversed) line.reverse();
        const newLine = transformLine(line);
        if (isReversed) newLine.reverse();
        for (let j = 0; j < boardSize; j++) {
            const currentIndex = isVertical ? j * boardSize + i : i * boardSize + j;
            board[currentIndex] = newLine[j];
        }
    }
    moved = !arraysEqual(originalBoard, board);
    return moved;
}

function transformLine(line) {
    let newLine = line.filter(tile => tile !== 0);
    for (let i = 0; i < newLine.length - 1; i++) {
        if (newLine[i] === newLine[i + 1]) {
            newLine[i] *= 2;
            healingPoints += newLine[i];
            nemukeGauge += 5;
            newLine.splice(i + 1, 1);
        }
    }
    while (newLine.length < boardSize) {
        newLine.push(0);
    }
    return newLine;
}

function checkGameOver() {
    if (!canMakeMove()) {
        mochiState = '動けない';
        updateStats();
        deactivateControls();
        getNemunemuRewardBtn.disabled = false;
        alert('もう動かせるマスがありません！ゲームオーバー');
    }
}

function claimNemunemuReward() {
    let nemunemuReward = 0;
    let rewardMessage = "";

    const afkPoints = Math.floor(afkTime / 10);

    // Check if the game is in a "game over" state (mochi sleeping or no moves)
    // The mochiState will be 'ねむっている' if nemukeGauge >= 5000
    // The mochiState will be '動けない' if !canMakeMove()
    if (mochiState === 'ねむっている' || mochiState === '動けない') {
        nemunemuReward = 100; // Fixed reward for game over
        rewardMessage = `「ねむねむ報酬」として ${nemunemuReward}P と放置報酬 ${afkPoints}P、合計 ${nemunemuReward + afkPoints} 癒しポイントをゲットしました！`;
        healingPoints += nemunemuReward + afkPoints;
    } else {
        // Only afk points if not in a game over state
        rewardMessage = `放置報酬として ${afkPoints}P 癒しポイントをゲットしました！`;
        healingPoints += afkPoints;
    }

    playSound('reward');
    alert(rewardMessage);
    saveGame();
    afkTime = 0;
    resetGame();
}

function resetGame() {
    deactivateControls();
    getNemunemuRewardBtn.removeEventListener('click', claimNemunemuReward);

    nemukeGauge = 0;
    mochiState = 'おきている';
    board = Array(boardSize * boardSize).fill(0);

    spawnItem();
    spawnItem();
    drawBoard();
    updateStats();
    updateMochiStatus();

    activateControls();

    getNemunemuRewardBtn.disabled = true;
    undoButton.disabled = true;

    getNemunemuRewardBtn.addEventListener('click', claimNemunemuReward);
}

// --- Save & Load ---

function saveGame() {
    const gameState = {
        healingPoints: healingPoints,
        purchasedFurniture: purchasedFurniture
    };
    localStorage.setItem('nemuiMochiGameState', JSON.stringify(gameState));
}

function loadGame() {
    const savedState = localStorage.getItem('nemuiMochiGameState');
    if (savedState) {
        const gameState = JSON.parse(savedState);
        healingPoints = gameState.healingPoints || 0;
        purchasedFurniture = gameState.purchasedFurniture || {};
    }
}