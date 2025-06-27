document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded event fired. Starting game initialization.');

    try {
        // ゲーム開始
        await initGame();

    } catch (e) {
        console.error("An error occurred during game initialization:", e);
        alert("ゲームの読み込み中にエラーが発生しました。開発者ツール（F12）のコンソールをご確認ください。");
    }
    console.log('DOMContentLoaded event finished.');
});

// オーディオコンテキストのロック解除
let audioContext = null;
let audioUnlocked = false; // 音声がアンロックされたかどうかのフラグ
let audioBuffers = {}; // 読み込んだオーディオデータを格納

function unlockAudio() {
    return new Promise(resolve => {
        if (audioUnlocked) {
            resolve();
            return;
        }

        if (audioContext === null) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed successfully');
                audioUnlocked = true;
                resolve();
            }).catch(error => {
                console.warn('Failed to resume AudioContext:', error);
                resolve(); // Resolve even on error to not block the game
            });
        } else {
            audioUnlocked = true;
            resolve();
        }
    });
}

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
const undoButton = document.getElementById('undo-button');

// ゲームの状態変数
let healingPoints = 0;
let nemukeGauge = 0;
let mochiState = '起きている';
let afkTime = 0;
let board = [];
let purchasedFurniture = [];
let boardHistory = []; // 盤面の履歴を保存する配列
const MAX_HISTORY_SIZE = 5; // 履歴の最大サイズ

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

async function initGame() {
    console.log('initGame started.');
    loadGame();
    await preloadAssets(); // await を追加

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

    activateControls();

    getNemunemuRewardBtn.disabled = true;
    getNemunemuRewardBtn.addEventListener('click', claimNemunemuReward);

    undoButton.addEventListener('click', undoMove);

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
    console.log(`playSound called for: ${soundName}. Initial AudioContext state: ${audioContext ? audioContext.state : 'not initialized'}`);

    if (audioContext === null) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log(`AudioContext initialized in playSound. State: ${audioContext.state}`);
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            console.log('AudioContext resumed successfully from playSound. Attempting to play sound.');
            if (audioContext.state === 'running' && audioBuffers[soundName]) {
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffers[soundName];
                source.connect(audioContext.destination);
                source.start(0);
                console.log(`Sound played successfully after resume: ${soundName}`);
            } else {
                console.warn(`Could not play sound '${soundName}' after resume attempt. Final AudioContext state: ${audioContext ? audioContext.state : 'not initialized'}, Buffer loaded: ${!!audioBuffers[soundName]}`);
            }
        }).catch(error => {
            console.warn('Failed to resume AudioContext from playSound:', error);
        });
    } else if (audioContext.state === 'running' && audioBuffers[soundName]) {
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffers[soundName];
        source.connect(audioContext.destination);
        source.start(0);
        console.log(`Sound played successfully: ${soundName}`);
    } else {
        console.warn(`Could not play sound '${soundName}'. Final AudioContext state: ${audioContext ? audioContext.state : 'not initialized'}, Buffer loaded: ${!!audioBuffers[soundName]}`);
    }
}

async function preloadAssets() { // async を追加
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
            img.onload = () => {
                console.log(`Image loaded: ${path}`);
                resolve();
            };
            img.onerror = (e) => {
                console.error(`Error loading image: ${path}`, e);
                reject(e);
            };
        });
    });

    await Promise.all(imagePromises);
    console.log('All images preloaded.');

    // サウンドのプリロード
    if (audioContext === null) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const soundPromises = Object.keys(sounds).map(async soundName => { // async を追加
        const url = sounds[soundName];
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBuffers[soundName] = audioBuffer;
            console.log(`Sound preloaded: ${soundName}`);
        } catch (error) {
            console.error(`Error preloading sound ${soundName}:`, error);
        }
    });

    await Promise.all(soundPromises); // await を追加

    console.log('All sounds preloaded.');
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
    if (nemukeGauge >= 5000) {
        state = 'asleep'; // 5000で眠る
        mochiState = 'ねむっている';
    } else if (nemukeGauge >= 2500) {
        state = 'sleepy'; // 2500で眠そう
        mochiState = 'ねむそう';
    } else {
        mochiState = 'おきてる';
    }
    
    const imagePath = mochiImages[state];
    if (imagePath) {
        mochiAnimation.style.backgroundImage = `url(${imagePath})`;
    }
    mochiStateText.textContent = mochiState; // きもちのテキストも更新
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

async function purchaseFurniture(item) {
    if (!audioUnlocked) {
        await unlockAudio();
    }
    console.log(`Attempting to purchase furniture. AudioContext state before purchase: ${audioContext ? audioContext.state : 'not initialized'}`);
    if (healingPoints >= item.price && !purchasedFurniture.includes(item.id)) {
        healingPoints -= item.price;
        // 新しい家具のデータ構造: { id: string, top: string, left: string }
        purchasedFurniture.push({ id: item.id, top: item.top, left: item.left });
        updateStats();
        populateFurnitureStore();
        renderPurchasedFurniture();
        saveGame();
        console.log(`Furniture purchased. AudioContext state after purchase: ${audioContext ? audioContext.state : 'not initialized'}`);
    } else {
        alert('癒しポイントが足りません！');
        console.log(`Furniture purchase failed. AudioContext state: ${audioContext ? audioContext.state : 'not initialized'}`);
    }
}

let isDragging = false;
let currentDraggable = null;
let offsetX, offsetY;
let mochiRoomRect; // もちの部屋のサイズと位置を保存

function renderPurchasedFurniture() {
    console.log('renderPurchasedFurniture started.');
    const itemSpritesDiv = document.getElementById('item-sprites');
    itemSpritesDiv.innerHTML = ''; // Clear existing furniture

    mochiRoomRect = document.getElementById('mochi-room').getBoundingClientRect();

    purchasedFurniture.forEach(item => {
        const furniture = furnitureData.find(f => f.id === item.id);
        if (furniture) {
            const img = document.createElement('img');
            img.src = furniture.image;
            img.alt = furniture.name;
            img.classList.add('furniture-sprite');
            img.style.position = 'absolute';
            img.style.top = item.top; // 保存された位置を使用
            img.style.left = item.left; // 保存された位置を使用
            img.dataset.itemId = item.id; // ドラッグ中の家具を特定するためにIDを保存

            // ドラッグイベントリスナーを追加
            img.addEventListener('mousedown', startDrag);
            img.addEventListener('touchstart', startDrag, { passive: false });

            itemSpritesDiv.appendChild(img);
        }
    });
    console.log('renderPurchasedFurniture finished.');
}

function startDrag(e) {
    if (!audioUnlocked) {
        unlockAudio();
    }
    isDragging = true;
    currentDraggable = e.target;
    currentDraggable.style.zIndex = 100; // ドラッグ中の要素を最前面に

    const rect = currentDraggable.getBoundingClientRect();
    if (e.type === 'mousedown') {
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);
    } else if (e.type === 'touchstart') {
        e.preventDefault(); // スクロール防止
        offsetX = e.touches[0].clientX - rect.left;
        offsetY = e.touches[0].clientY - rect.top;
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('touchend', endDrag);
    }
}

function drag(e) {
    if (!isDragging) return;

    let clientX, clientY;
    if (e.type === 'mousemove') {
        clientX = e.clientX;
        clientY = e.clientY;
    } else if (e.type === 'touchmove') {
        e.preventDefault(); // スクロール防止
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    let newLeft = clientX - mochiRoomRect.left - offsetX;
    let newTop = clientY - mochiRoomRect.top - offsetY;

    // 部屋の境界内に制限
    newLeft = Math.max(0, Math.min(newLeft, mochiRoomRect.width - currentDraggable.offsetWidth));
    newTop = Math.max(0, Math.min(newTop, mochiRoomRect.height - currentDraggable.offsetHeight));

    currentDraggable.style.left = `${newLeft}px`;
    currentDraggable.style.top = `${newTop}px`;
}

function endDrag(e) {
    isDragging = false;
    currentDraggable.style.zIndex = ''; // z-indexを元に戻す

    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', endDrag);
    document.removeEventListener('touchmove', drag);
    document.removeEventListener('touchend', endDrag);

    // 家具の新しい位置を保存
    const itemId = currentDraggable.dataset.itemId;
    const itemIndex = purchasedFurniture.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
        purchasedFurniture[itemIndex].top = currentDraggable.style.top;
        purchasedFurniture[itemIndex].left = currentDraggable.style.left;
        saveGame();
    }
    currentDraggable = null;
}





// --- ゲームロジック ---

// タッチ操作用の変数
let touchStartX = 0;
let touchStartY = 0;

async function processMove(direction) {
    saveBoardState(); // 移動前に現在のボードの状態を保存

    const moved = move(direction);
    if (moved) {
        nemukeGauge += 1;
        spawnItem();
        drawBoard();
        updateStats();
        updateMochiAnimation();
        checkGameOver();
    }
}

function saveBoardState() {
    // 履歴の最大サイズを超えないように古いものを削除
    if (boardHistory.length >= MAX_HISTORY_SIZE) {
        boardHistory.shift();
    }
    boardHistory.push({ board: [...board], nemukeGauge: nemukeGauge, mochiState: mochiState });
}

function undoMove() {
    if (boardHistory.length > 0) {
        const prevState = boardHistory.pop();
        board = [...prevState.board];
        nemukeGauge = prevState.nemukeGauge;
        mochiState = prevState.mochiState;
        drawBoard();
        updateStats();
        updateMochiAnimation();
    } else {
        alert('これ以上戻れません！');
    }
}

async function handleKeyDown(e) {
    if (!audioUnlocked) {
        await unlockAudio();
    }
    switch (e.key) {
        case 'ArrowUp': await processMove('up'); break;
        case 'ArrowDown': await processMove('down'); break;
        case 'ArrowLeft': await processMove('left'); break;
        case 'ArrowRight': await processMove('right'); break;
    }
}

async function handleTouchStart(e) {
    if (!audioUnlocked) {
        await unlockAudio();
    }
    console.log('touchstart', e);

    // passive: false を指定しているため、スクロールをキャンセルできる
    e.preventDefault();
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}

function handleTouchMove(e) {
    console.log('touchmove', e);
    // スワイプ中の画面スクロールを防止
    e.preventDefault();
}

async function handleTouchEnd(e) {
    console.log('touchend', e);
    e.preventDefault();
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    console.log(`diffX: ${diffX}, diffY: ${diffY}`);
    await handleSwipe(diffX, diffY);
}

async function handleSwipe(diffX, diffY) {
    const threshold = 30; // スワイプと判定する最小距離（ピクセル）
    console.log(`handleSwipe called with diffX: ${diffX}, diffY: ${diffY}, threshold: ${threshold}`);

    // 横方向のスワイプか、縦方向のスワイプかを判定
    if (Math.abs(diffX) > Math.abs(diffY)) {
        // 横方向
        if (Math.abs(diffX) > threshold) {
            await processMove(diffX > 0 ? 'right' : 'left');
            console.log(`Swipe detected: ${diffX > 0 ? 'right' : 'left'}`);
        }
    } else {
        // 縦方向
        if (Math.abs(diffY) > threshold) {
            await processMove(diffY > 0 ? 'down' : 'up');
            console.log(`Swipe detected: ${diffY > 0 ? 'down' : 'up'}`);
        }
    }
}

// --- 操作関連のヘルパー関数 ---
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
        deactivateControls();
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
        deactivateControls();
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
    activateControls();
    getNemunemuRewardBtn.disabled = true;
    // ここでイベントリスナーを再登録し、ボタンを有効にする
    getNemunemuRewardBtn.addEventListener('click', claimNemunemuReward);
    getNemunemuRewardBtn.disabled = false; // ボタンを有効にする
}

// --- セーブ & ロード ---

function saveGame() {
    const gameState = {
        healingPoints: healingPoints,
        purchasedFurniture: purchasedFurniture // top, left を含むオブジェクトの配列を保存
    };
    localStorage.setItem('nemuiMochiGameState', JSON.stringify(gameState));
}

function loadGame() {
    const savedState = localStorage.getItem('nemuiMochiGameState');
    if (savedState) {
        const gameState = JSON.parse(savedState);
        healingPoints = gameState.healingPoints || 0;
        // 互換性のため、古い形式のデータ（文字列の配列）を新しい形式に変換
        if (gameState.purchasedFurniture && gameState.purchasedFurniture.length > 0 && typeof gameState.purchasedFurniture[0] === 'string') {
            purchasedFurniture = gameState.purchasedFurniture.map(itemId => {
                const furniture = furnitureData.find(f => f.id === itemId);
                return furniture ? { id: itemId, top: furniture.top, left: furniture.left } : null;
            }).filter(item => item !== null);
        } else {
            purchasedFurniture = gameState.purchasedFurniture || [];
        }
    }
}

// --- ゲーム開始 ---

