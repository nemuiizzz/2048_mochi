document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired. Starting game initialization.');

    try {
        // ゲーム開始
        initGame();

    } catch (e) {
        console.error("An error occurred during game initialization:", e);
        alert("ゲームの読み込み中にエラーが発生しました。開発者ツール（F12）のコンソールをご確認ください。");
    }
    console.log('DOMContentLoaded event finished.');
});

// --- ゲームのメインロジック（グローバルスコープに移動） ---

// DOM要素の取得
const gameBoard = document.getElementById('game-board');
const healingPointsSpan = document.getElementById('healing-points');
const nemukeGaugeSpan = document.getElementById('nemuke-gauge');
const mochiStateText = document.getElementById('mochi-state-text');
const mochiAnimation = document.getElementById('mochi-animation');
const afkRewardTimerSpan = document.getElementById('afk-reward-timer');
const getNemunemuRewardBtn = document.getElementById('get-nemunemu-reward');
const furnitureStore = document.getElementById('furniture-store');
const preloadImagesDiv = document.getElementById('preload-images');

// ゲームの状態変数
let healingPoints = 0;
let nemukeGauge = 0;
let mochiState = '起きている';
let afkTime = 0;
let board = [];
let purchasedFurniture = [];

const boardSize = 4;

// --- データ定義 ---
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

// --- 初期化 ---

function initGame() {
    console.log('initGame started.');
    loadGame();
    preloadAssets();

    board = Array(boardSize * boardSize).fill(0);
    nemukeGauge = 0;
    mochiState = '起きている';

    spawnItem();
    spawnItem();

    drawBoard();
    updateStats();
    updateMochiAnimation();
    populateFurnitureStore();
    renderPurchasedFurniture();

    document.addEventListener('keydown', handleKeyDown);
    getNemunemuRewardBtn.disabled = true;
    getNemunemuRewardBtn.addEventListener('click', claimNemunemuReward);

    setInterval(() => {
        if (mochiState !== 'ねむっている') {
            afkTime++;
            const minutes = Math.floor(afkTime / 60).toString().padStart(2, '0');
            const seconds = (afkTime % 60).toString().padStart(2, '0');
            const afkPoints = Math.floor(afkTime / 10); // 10秒ごとに1ポイント
            afkRewardTimerSpan.textContent = `${minutes}:${seconds} (+${afkPoints}P)`;
        }
    }, 1000);
    console.log('initGame finished.');
}

// --- ヘルパー関数 ---

function playSound(soundName) {
    if (sounds[soundName]) {
        const audio = new Audio(sounds[soundName]);
        audio.play().catch(error => {
            console.log(`Could not play sound '${soundName}' automatically. User interaction might be required.`);
        });
    }
}

function preloadAssets() {
    console.log('preloadAssets started.');
    const allImagePaths = [
        ...Object.values(itemImages),
        ...Object.values(mochiImages),
        ...furnitureData.map(item => item.image)
    ];

    allImagePaths.forEach(path => {
        const img = new Image();
        img.src = path;
        // preloadImagesDiv.appendChild(img); // デバッグ用。通常は不要
    });

    for (const key in sounds) {
        const audio = new Audio();
        audio.src = sounds[key];
    }
    console.log('preloadAssets finished.');
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
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function canMakeMove() {
    // 空きマスがあるか
    for (let i = 0; i < board.length; i++) {
        if (board[i] === 0) return true;
    }

    // 合成できるマスがあるか (水平方向)
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize - 1; col++) {
            const index = row * boardSize + col;
            if (board[index] !== 0 && board[index] === board[index + 1]) return true;
        }
    }

    // 合成できるマスがあるか (垂直方向)
    for (let col = 0; col < boardSize; col++) {
        for (let row = 0; row < boardSize - 1; row++) {
            const index = row * boardSize + col;
            if (board[index] !== 0 && board[index] === board[index + boardSize]) return true;
        }
    }
    return false;
}

// --- 描画関連 ---

function drawBoard() {
    console.log('drawBoard started.');
    gameBoard.innerHTML = '';
    board.forEach(value => {
        const tile = document.createElement('div');
        tile.classList.add('tile');
        if (value !== 0) {
            const imagePath = itemImages[value];
            if (imagePath) {
                tile.style.backgroundImage = `url(${imagePath})`;
            } else {
                tile.textContent = value; // 画像がない場合は数字を表示
            }
        }
        gameBoard.appendChild(tile);
    });
    console.log('drawBoard finished.');
}

function updateStats() {
    healingPointsSpan.textContent = healingPoints;
    nemukeGaugeSpan.textContent = `${Math.floor(nemukeGauge)} / 1000`;
    mochiStateText.textContent = mochiState;
}

function updateMochiAnimation() {
    console.log('updateMochiAnimation started.');
    let state = 'awake';
    if (nemukeGauge >= 5000) state = 'asleep'; // 5000で眠る
    else if (nemukeGauge >= 2500) state = 'sleepy'; // 2500で眠そう
    
    const imagePath = mochiImages[state];
    if (imagePath) {
        mochiAnimation.style.backgroundImage = `url(${imagePath})`;
    }
    console.log('updateMochiAnimation finished.');
}

// --- 家具関連 ---

function populateFurnitureStore() {
    console.log('populateFurnitureStore started.');
    furnitureStore.innerHTML = '';
    furnitureData.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('furniture-item');
        if (purchasedFurniture.includes(item.id)) {
            itemDiv.classList.add('purchased');
        }

        itemDiv.innerHTML = `<img src="${item.image}" alt="${item.name}"><p>${item.name}</p><p>価格: ${item.price}</p>`;
        if (!purchasedFurniture.includes(item.id)) {
            itemDiv.addEventListener('click', () => purchaseFurniture(item));
        }
        furnitureStore.appendChild(itemDiv);
    });
    console.log('populateFurnitureStore finished.');
}

function purchaseFurniture(item) {
    if (healingPoints >= item.price && !purchasedFurniture.includes(item.id)) {
        healingPoints -= item.price;
        purchasedFurniture.push(item.id);
        updateStats();
        populateFurnitureStore();
        renderPurchasedFurniture();
        saveGame();
    } else {
        alert('癒しポイントが足りません！');
    }
}

function renderPurchasedFurniture() {
    console.log('renderPurchasedFurniture started.');
    const itemSpritesDiv = document.getElementById('item-sprites');
    itemSpritesDiv.innerHTML = '';
    purchasedFurniture.forEach(itemId => {
        const furniture = furnitureData.find(f => f.id === itemId);
        if (furniture) {
            const sprite = document.createElement('div');
            sprite.classList.add('item-sprite');
            sprite.style.backgroundImage = `url(${furniture.image})`;
            sprite.style.top = furniture.top;
            sprite.style.left = furniture.left;
            itemSpritesDiv.appendChild(sprite);
        }
    });
    console.log('renderPurchasedFurniture finished.');
}

// --- ゲームロジック ---

function handleKeyDown(e) {
    let moved = false;
    switch (e.key) {
        case 'ArrowUp': moved = move('up'); break;
        case 'ArrowDown': moved = move('down'); break;
        case 'ArrowLeft': moved = move('left'); break;
        case 'ArrowRight': moved = move('right'); break;
    }
    if (moved) {
        nemukeGauge += 1;
        spawnItem();
        drawBoard();
        updateStats();
        updateMochiAnimation();
        checkGameOver();
    }
}

function move(direction) {
    let moved = false;
    const isVertical = direction === 'up' || direction === 'down';
    const isReversed = direction === 'right' || direction === 'down';

    // 盤面をコピーして、移動後の状態をシミュレート
    const originalBoard = [...board];

    for (let i = 0; i < boardSize; i++) {
        const line = [];
        for (let j = 0; j < boardSize; j++) {
            line.push(isVertical ? board[j * boardSize + i] : board[i * boardSize + j]);
        }

        if (isReversed) line.reverse();
        const newLine = transformLine(line);
        if (isReversed) newLine.reverse();

        for (let j = 0; j < boardSize; j++) {
            const currentIndex = isVertical ? j * boardSize + i : i * boardSize + j;
            board[currentIndex] = newLine[j]; // 盤面を更新
        }
    }
    // 移動があったかチェック
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
            playSound('merge');
            newLine.splice(i + 1, 1);
        }
    }
    while (newLine.length < boardSize) {
        newLine.push(0);
    }
    return newLine;
}

function checkGameOver() {
    console.log('checkGameOver started.');
    if (nemukeGauge >= 5000) {
        nemukeGauge = 1000;
        mochiState = 'ねむっている';
        updateStats();
        updateMochiAnimation();
        document.removeEventListener('keydown', handleKeyDown);
        getNemunemuRewardBtn.disabled = false;
        playSound('sleep');
        setTimeout(() => alert('もちが眠ってしまいました！「ねむねむ報酬」を受け取って、新しいゲームを始めましょう。'), 500);
        console.log('Game Over: Mochi is asleep.');
        return; // ゲームオーバーなのでここで終了
    }

    // 動かせるマスがないかチェック
    if (!canMakeMove()) {
        mochiState = '動けない'; // 新しい状態
        updateStats();
        document.removeEventListener('keydown', handleKeyDown);
        getNemunemuRewardBtn.disabled = false; // 報酬ボタンを有効にするか検討
        alert('もう動かせるマスがありません！ゲームオーバー');
        console.log('Game Over: No more moves.');
    }
    console.log('checkGameOver finished.');
}

function claimNemunemuReward() {
    const nemunemuReward = 100; // ねむねむ報酬の基本ポイント
    const afkPoints = Math.floor(afkTime / 10); // 放置時間に応じたポイント
    const totalReward = nemunemuReward + afkPoints;

    healingPoints += totalReward;
    playSound('reward');
    alert(`「ねむねむ報酬」として ${nemunemuReward}P と放置報酬 ${afkPoints}P、合計 ${totalReward} 癒しポイントをゲットしました！`);
    saveGame();
    afkTime = 0; // 放置時間をリセット
    resetGame();
}

function claimNemunemuReward() {
    const nemunemuReward = 100; // ねむねむ報酬の基本ポイント
    const afkPoints = Math.floor(afkTime / 10); // 放置時間に応じたポイント
    const totalReward = nemunemuReward + afkPoints;

    healingPoints += totalReward;
    playSound('reward');
    alert(`「ねむねむ報酬」として ${nemunemuReward}P と放置報酬 ${afkPoints}P、合計 ${totalReward} 癒しポイントをゲットしました！`);
    saveGame();
    afkTime = 0; // 放置時間をリセット
    resetGame();
}

function resetGame() {
    // イベントリスナーを削除してから再登録することで、重複登録を防ぐ
    getNemunemuRewardBtn.removeEventListener('click', claimNemunemuReward);
    nemukeGauge = 0;
    mochiState = '起きている';
    board = Array(boardSize * boardSize).fill(0);
    spawnItem();
    spawnItem();
    drawBoard();
    updateStats();
    updateMochiAnimation();
    document.addEventListener('keydown', handleKeyDown);
    getNemunemuRewardBtn.disabled = true;
    // ここでイベントリスナーを再登録し、ボタンを有効にする
    getNemunemuRewardBtn.addEventListener('click', claimNemunemuReward);
    getNemunemuRewardBtn.disabled = false; // ボタンを有効にする
}

// --- セーブ & ロード ---

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
        purchasedFurniture = gameState.purchasedFurniture || [];
    }
}

// --- ゲーム開始 ---
initGame();

