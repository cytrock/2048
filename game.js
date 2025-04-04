// 游戏参数
const GRID_SIZE = 6;
let cells = [];
let grid = [];
let score = 0;
let bestScore = localStorage.getItem('bestScore') || 0;
let gameIsOver = false;
let notificationTimeout = null;
let musicPlaying = false;
let movesCount = 0;
let startTime = null;
let gameTimer = null;
let highestTile = 0;
let difficulty = 'easy';
let comboCount = 0;
let lastMergeTime = 0;
const COMBO_TIMEOUT = 1000; // 1秒内连续合并算连击
let activeAnimations = new Set(); // 跟踪活动动画

// 音频元素
const bgMusic = document.getElementById('background-music');
const moveSound = document.getElementById('move-sound');
const mergeSound = document.getElementById('merge-sound');
const gameOverSound = document.getElementById('game-over-sound');

// 设置音量
bgMusic.volume = 0.3; // 背景音乐音量较低
moveSound.volume = 0.5;
mergeSound.volume = 0.7;
gameOverSound.volume = 0.8;

// 音乐控制
document.getElementById('music-toggle').addEventListener('click', toggleMusic);

function toggleMusic() {
    if (musicPlaying) {
        bgMusic.pause();
        musicPlaying = false;
        document.getElementById('music-toggle').style.opacity = 0.5;
    } else {
        // 尝试播放背景音乐
        const playPromise = bgMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                musicPlaying = true;
                document.getElementById('music-toggle').style.opacity = 1;
            }).catch(error => {
                console.log('播放失败:', error);
                // 如果自动播放失败，提示用户点击
                alert('请点击游戏区域以启用音频');
            });
        }
    }
}

// 播放音效的辅助函数
function playSound(sound) {
    sound.currentTime = 0;
    const playPromise = sound.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log('播放音效失败:', error);
        });
    }
}

// 初始化网格UI
function initGrid() {
    const gridElement = document.getElementById('grid');
    gridElement.innerHTML = '';
    cells = [];
    
    for(let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        
        // 为每个单元格添加数字显示元素
        const span = document.createElement('span');
        cell.appendChild(span);
        
        gridElement.appendChild(cell);
        cells.push(cell);
    }
    
    // 初始化数据网格
    grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
}

// 1. 更新playScoreAnimation函数来改进特效显示
function playScoreAnimation(points, x, y) {
    // 清理过期的动画
    activeAnimations.forEach(anim => {
        if (!document.body.contains(anim)) {
            activeAnimations.delete(anim);
        }
    });
    
    // 创建得分动画元素
    const scoreAnim = document.createElement('div');
    scoreAnim.className = 'score-animation';
    scoreAnim.textContent = '+' + points;
    
    // 更精确的位置设置 - 直接在合并的方块上方
    scoreAnim.style.left = (x - 20) + 'px';
    scoreAnim.style.top = (y - 20) + 'px';
    
    document.body.appendChild(scoreAnim);
    activeAnimations.add(scoreAnim);
    
    // 播放合并音效
    playSound(mergeSound);
    
    // 检查是否连击
    const now = Date.now();
    if (now - lastMergeTime < COMBO_TIMEOUT) {
        comboCount++;
        if (comboCount > 1) {
            showComboAnimation(comboCount);
            
            // 2. 增加连击奖励分数
            const comboBonus = Math.floor(points * (comboCount * 0.1)); // 每次连击增加10%的奖励
            if (comboBonus > 0) {
                score += comboBonus;
                
                // 显示连击奖励分数
                const bonusAnim = document.createElement('div');
                bonusAnim.className = 'combo-bonus-animation';
                bonusAnim.textContent = '连击奖励: +' + comboBonus;
                bonusAnim.style.left = (window.innerWidth / 2 - 75) + 'px';
                bonusAnim.style.top = (window.innerHeight / 2 + 50) + 'px';
                document.body.appendChild(bonusAnim);
                activeAnimations.add(bonusAnim);
                
                // 使用requestAnimationFrame移除元素
                setTimeout(() => {
                    if (document.body.contains(bonusAnim)) {
                        document.body.removeChild(bonusAnim);
                        activeAnimations.delete(bonusAnim);
                    }
                }, 1200);
                
                // 更新分数显示
                updateScore();
            }
        }
    } else {
        comboCount = 1;
    }
    lastMergeTime = now;
    
    // 3. 使用requestAnimationFrame实现平滑动画
    let startTime = null;
    const duration = 1500; // 动画持续时间
    
    function animateScore(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        
        if (elapsed < duration) {
            // 计算动画进度 (0到1之间)
            const progress = elapsed / duration;
            
            // 设置位置 (向上浮动)
            scoreAnim.style.top = (y - 20 - (progress * 80)) + 'px';
            
            // 设置不透明度 (逐渐消失)
            scoreAnim.style.opacity = 1 - (progress * progress);
            
            // 继续下一帧
            requestAnimationFrame(animateScore);
        } else {
            // 动画结束，移除元素
            if (document.body.contains(scoreAnim)) {
                document.body.removeChild(scoreAnim);
                activeAnimations.delete(scoreAnim);
            }
        }
    }
    
    // 启动动画
    requestAnimationFrame(animateScore);
}

// 4. 优化连击动画
function showComboAnimation(count) {
    const comboAnim = document.createElement('div');
    comboAnim.className = 'combo-animation';
    comboAnim.textContent = count + '连击!';
    document.querySelector('.game-container').appendChild(comboAnim);
    activeAnimations.add(comboAnim);
    
    let startTime = null;
    const duration = 1000; // 动画持续时间
    
    function animateCombo(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        
        if (elapsed < duration) {
            // 计算动画进度 (0到1之间)
            const progress = elapsed / duration;
            
            // 淡入淡出效果
            if (progress < 0.5) {
                // 淡入并放大
                comboAnim.style.opacity = progress * 2;
                comboAnim.style.transform = `translate(-50%, -50%) scale(${0.5 + progress})`;
            } else {
                // 淡出
                comboAnim.style.opacity = 1 - ((progress - 0.5) * 2);
                comboAnim.style.transform = `translate(-50%, -50%) scale(${1 + (1 - progress) * 0.2})`;
            }
            
            // 继续下一帧
            requestAnimationFrame(animateCombo);
        } else {
            // 动画结束，移除元素
            if (document.body.contains(comboAnim)) {
                document.querySelector('.game-container').removeChild(comboAnim);
                activeAnimations.delete(comboAnim);
            }
        }
    }
    
    // 启动动画
    requestAnimationFrame(animateCombo);
}

function clearAllAnimations() {
    activeAnimations.forEach(anim => {
        if (document.body.contains(anim)) {
            anim.parentNode.removeChild(anim);
        }
    });
    activeAnimations.clear();
}

// 难度设置
function setDifficulty(level) {
    difficulty = level;
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.difficulty-btn[onclick="setDifficulty('${level}')"]`).classList.add('active');
    newGame();
}

// 更新游戏统计
function updateStats() {
    document.getElementById('moves-count').textContent = movesCount;
    document.getElementById('highest-tile').textContent = highestTile;
}

// 更新游戏时间
function updateGameTime() {
    if (!startTime) return;
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById('time-played').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 开始新游戏
function newGame() {
    // 清理所有活动动画
    clearAllAnimations();
    
    // 清除之前的游戏状态
    if (gameTimer) {
        clearInterval(gameTimer);
    }
    
    // 移除游戏结束显示
    const gameOverElement = document.querySelector('.game-over');
    if (gameOverElement) {
        gameOverElement.remove();
    }
    
    initGrid();
    score = 0;
    movesCount = 0;
    gameIsOver = false;
    startTime = Date.now();
    highestTile = 0;
    comboCount = 0; // 重置连击计数
    
    // 根据难度设置初始方块
    let initialTiles = 2;
    switch (difficulty) {
        case 'easy':
            initialTiles = 2;
            break;
        case 'medium':
            initialTiles = 3;
            break;
        case 'hard':
            initialTiles = 4;
            break;
    }
    
    for (let i = 0; i < initialTiles; i++) {
        addNewTile();
    }
    
    updateScore();
    updateStats();
    
    // 启动游戏计时器
    gameTimer = setInterval(updateGameTime, 1000);
    
    // 尝试播放背景音乐
    if (musicPlaying) {
        const playPromise = bgMusic.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log('自动播放失败:', error);
            });
        }
    }
}

// 添加新块
function addNewTile() {
    // 找出所有空白位置
    const emptyPositions = [];
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            if (grid[row][col] === 0) {
                emptyPositions.push({ row, col });
            }
        }
    }
    
    if(emptyPositions.length === 0) return false;
    
    // 随机选择一个空位置
    const position = emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
    
    // 90%几率是2，10%几率是4
    const value = Math.random() < 0.9 ? 2 : 4;
    grid[position.row][position.col] = value;
    
    // 更新UI
    const cellIndex = position.row * GRID_SIZE + position.col;
    // 设置值到span元素
    const span = cells[cellIndex].querySelector('span');
    span.textContent = value || '';
    cells[cellIndex].className = value ? `cell cell-${value} tile-new` : 'cell';
    
    return true;
}


// 更新分数
function updateScore() {
    document.getElementById('score').textContent = score;
    if (score > bestScore) {
        bestScore = score;
        document.getElementById('best-score').textContent = bestScore;
        localStorage.setItem('bestScore', bestScore);
    } else {
        document.getElementById('best-score').textContent = bestScore;
    }
}

// 更新网格UI
function updateGridUI() {
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const value = grid[row][col];
            const cellIndex = row * GRID_SIZE + col;
            
            // 设置值到span元素
            const span = cells[cellIndex].querySelector('span');
            span.textContent = value || '';
            cells[cellIndex].className = value ? `cell cell-${value}` : 'cell';
        }
    }
}

// 显示操作无效通知
function showInvalidMoveNotification(message) {
    const notification = document.getElementById('move-notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    // 清除之前的超时
    if (notificationTimeout) {
        clearTimeout(notificationTimeout);
    }
    
    // 2秒后隐藏
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);
}

// 8. 优化move函数中的得分反馈
function move(direction) {
    if (gameIsOver) return false;
    
    if (direction === 'up') {
        showInvalidMoveNotification('Invalid Move');
        return false;
    }
    
    // 保存之前的状态
    const previousGrid = grid.map(row => [...row]);
    let moved = false;
    let totalScore = 0; // 此次移动的总得分
    
    // 根据方向处理移动
    switch (direction) {
        case 'right':
            const rightResult = moveRight(totalScore);
            moved = rightResult.moved;
            totalScore = rightResult.score;
            break;
        case 'down':
            const downResult = moveDown(totalScore);
            moved = downResult.moved;
            totalScore = downResult.score;
            break;
        case 'left':
            const leftResult = moveLeft(totalScore);
            moved = leftResult.moved;
            totalScore = leftResult.score;
            break;
    }
    
    if (moved) {
        movesCount++;
        updateStats();
        
        // 播放移动音效
        playSound(moveSound);
        
        // 更新最高方块
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                const value = grid[row][col];
                if (value > highestTile) {
                    highestTile = value;
                    
                    // 9. 添加新高分数方块成就提示
                    if (value >= 8) {
                        showAchievementToast(`获得了 ${value} 方块！`);
                    }
                    
                    updateStats();
                }
            }
        }
        
        // 更新得分
        if (totalScore > 0) {
            // 10. 平滑得分增加动画
            animateScoreChange(score, score + totalScore);
            score += totalScore;
            
            // 更新分数显示
            updateScore();
        }
        
        updateGridUI();
        addNewTile();
        
        // 检查游戏是否结束
        if (isGameOver()) {
            gameIsOver = true;
            showGameOver();
        }
    } else {
        showInvalidMoveNotification('Invalid Move');
    }
    
    return moved;
}

// 向上移动函数保留，但不会被调用
function moveUp() {
    return false; // 永远返回false，表示没有移动
}

// 2. 更新moveRight函数，在合并位置显示动画
function moveRight(totalScore = 0) {
    let moved = false;
    let score = 0;
    
    for (let row = 0; row < GRID_SIZE; row++) {
        // 收集这一行中的所有非零数字
        let nonZeros = [];
        for (let col = GRID_SIZE - 1; col >= 0; col--) {
            if (grid[row][col] !== 0) {
                nonZeros.push({
                    value: grid[row][col],
                    originalCol: col // 记录原始位置用于动画
                });
            }
        }
        
        if (nonZeros.length === 0) continue;
        
        // 合并相同的相邻数字
        let merged = [];
        let i = 0;
        while (i < nonZeros.length) {
            if (i + 1 < nonZeros.length && nonZeros[i].value === nonZeros[i + 1].value) {
                const mergeValue = nonZeros[i].value * 2;
                merged.push({
                    value: mergeValue,
                    merged: true,
                    originalCol1: nonZeros[i].originalCol,
                    originalCol2: nonZeros[i + 1].originalCol
                });
                
                // 关键修改：合并时直接计算得分，等于合并后的数值
                score += mergeValue;
                
                i += 2;
            } else {
                merged.push({
                    value: nonZeros[i].value,
                    merged: false,
                    originalCol: nonZeros[i].originalCol
                });
                i++;
            }
        }
        
        // 检查这一行是否有变化
        let originalRow = [...grid[row]];
        
        // 清除这一行并用合并后的数据填充
        for (let col = 0; col < GRID_SIZE; col++) {
            if (col < merged.length) {
                const newValue = merged[col].value;
                const newPosition = GRID_SIZE - 1 - col;
                const oldValue = grid[row][newPosition];
                
                grid[row][newPosition] = newValue;
                
                // 如果是合并生成的新值，添加合并动画
                if (merged[col].merged) {
                    const cellIndex = row * GRID_SIZE + newPosition;
                    setTimeout(() => {
                        cells[cellIndex].classList.add('merge-animation');
                        
                        // 计算合并方块的位置并显示动画
                        const rect = cells[cellIndex].getBoundingClientRect();
                        playScoreAnimation(newValue, rect.left + rect.width/2, rect.top + rect.height/2);
                        
                        // 移除动画类
                        setTimeout(() => {
                            cells[cellIndex].classList.remove('merge-animation');
                        }, 300);
                    }, 50); // 稍微延迟以确保DOM更新
                }
            } else {
                grid[row][GRID_SIZE - 1 - col] = 0;
            }
        }
        
        // 检查是否有变化
        for (let col = 0; col < GRID_SIZE; col++) {
            if (originalRow[col] !== grid[row][col]) {
                moved = true;
                break;
            }
        }
    }
    
    return { moved, score };
}

// 3. 更新moveDown函数，在合并位置显示动画
function moveDown(totalScore = 0) {
    let moved = false;
    let score = 0;
    
    for (let col = 0; col < GRID_SIZE; col++) {
        // 收集这一列中的所有非零数字
        let nonZeros = [];
        for (let row = GRID_SIZE - 1; row >= 0; row--) {
            if (grid[row][col] !== 0) {
                nonZeros.push({
                    value: grid[row][col],
                    originalRow: row
                });
            }
        }
        
        // 如果这一列没有非零数字，继续下一列
        if (nonZeros.length === 0) continue;
        
        // 合并相同的相邻数字
        let merged = [];
        let i = 0;
        while (i < nonZeros.length) {
            if (i + 1 < nonZeros.length && nonZeros[i].value === nonZeros[i + 1].value) {
                const mergeValue = nonZeros[i].value * 2;
                merged.push({
                    value: mergeValue,
                    merged: true,
                    originalRow1: nonZeros[i].originalRow,
                    originalRow2: nonZeros[i + 1].originalRow
                });
                
                // 计算合并得分
                score += mergeValue;
                
                i += 2;
            } else {
                merged.push({
                    value: nonZeros[i].value,
                    merged: false,
                    originalRow: nonZeros[i].originalRow
                });
                i++;
            }
        }
        
        // 检查这一列是否有变化
        let originalColumn = [];
        for (let row = 0; row < GRID_SIZE; row++) {
            originalColumn.push(grid[row][col]);
        }
        
        // 清除这一列并用合并后的数据填充
        for (let row = 0; row < GRID_SIZE; row++) {
            if (row < merged.length) {
                const newValue = merged[row].value;
                const newPosition = GRID_SIZE - 1 - row;
                
                grid[newPosition][col] = newValue;
                
                // 如果是合并生成的新值，添加合并动画
                if (merged[row].merged) {
                    const cellIndex = newPosition * GRID_SIZE + col;
                    setTimeout(() => {
                        cells[cellIndex].classList.add('merge-animation');
                        
                        // 计算合并方块的位置并显示动画
                        const rect = cells[cellIndex].getBoundingClientRect();
                        playScoreAnimation(newValue, rect.left + rect.width/2, rect.top + rect.height/2);
                        
                        // 移除动画类
                        setTimeout(() => {
                            cells[cellIndex].classList.remove('merge-animation');
                        }, 300);
                    }, 50);
                }
            } else {
                grid[GRID_SIZE - 1 - row][col] = 0;
            }
        }
        
        // 检查是否有变化
        for (let row = 0; row < GRID_SIZE; row++) {
            if (originalColumn[row] !== grid[row][col]) {
                moved = true;
                break;
            }
        }
    }
    
    return { moved, score };
}

// 4. 更新moveLeft函数，在合并位置显示动画
function moveLeft(totalScore = 0) {
    let moved = false;
    let score = 0;
    
    for (let row = 0; row < GRID_SIZE; row++) {
        // 收集这一行中的所有非零数字
        let nonZeros = [];
        for (let col = 0; col < GRID_SIZE; col++) {
            if (grid[row][col] !== 0) {
                nonZeros.push({
                    value: grid[row][col],
                    originalCol: col
                });
            }
        }
        
        // 如果这一行没有非零数字，继续下一行
        if (nonZeros.length === 0) continue;
        
        // 合并相同的相邻数字
        let merged = [];
        let i = 0;
        while (i < nonZeros.length) {
            if (i + 1 < nonZeros.length && nonZeros[i].value === nonZeros[i + 1].value) {
                const mergeValue = nonZeros[i].value * 2;
                merged.push({
                    value: mergeValue,
                    merged: true,
                    originalCol1: nonZeros[i].originalCol,
                    originalCol2: nonZeros[i + 1].originalCol
                });
                
                // 计算合并得分
                score += mergeValue;
                
                i += 2;
            } else {
                merged.push({
                    value: nonZeros[i].value,
                    merged: false,
                    originalCol: nonZeros[i].originalCol
                });
                i++;
            }
        }
        
        // 检查这一行是否有变化
        let originalRow = [...grid[row]];
        
        // 清除这一行并用合并后的数据填充
        for (let col = 0; col < GRID_SIZE; col++) {
            if (col < merged.length) {
                const newValue = merged[col].value;
                
                grid[row][col] = newValue;
                
                // 如果是合并生成的新值，添加合并动画
                if (merged[col].merged) {
                    const cellIndex = row * GRID_SIZE + col;
                    setTimeout(() => {
                        cells[cellIndex].classList.add('merge-animation');
                        
                        // 计算合并方块的位置并显示动画
                        const rect = cells[cellIndex].getBoundingClientRect();
                        playScoreAnimation(newValue, rect.left + rect.width/2, rect.top + rect.height/2);
                        
                        // 移除动画类
                        setTimeout(() => {
                            cells[cellIndex].classList.remove('merge-animation');
                        }, 300);
                    }, 50);
                }
            } else {
                grid[row][col] = 0;
            }
        }
        
        // 检查是否有变化
        for (let col = 0; col < GRID_SIZE; col++) {
            if (originalRow[col] !== grid[row][col]) {
                moved = true;
                break;
            }
        }
    }
    
    return { moved, score };
}

// 优化的游戏结束检查
function isGameOver() {
    // 首先快速检查是否有空格
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            if (grid[row][col] === 0) return false;
        }
    }
    
    // 检查相邻单元格是否有相同值
    for (let row = 0; row < GRID_SIZE; row++) {
        for (let col = 0; col < GRID_SIZE; col++) {
            const value = grid[row][col];
            // 只需检查右侧和下方
            if ((col < GRID_SIZE - 1 && value === grid[row][col + 1]) || 
                (row < GRID_SIZE - 1 && value === grid[row + 1][col])) {
                return false;
            }
        }
    }
    return true;
}

// 显示游戏结束界面
function showGameOver() {
    // 清理所有活动动画
    activeAnimations.forEach(anim => {
        if (document.body.contains(anim)) {
            document.body.removeChild(anim);
        }
    });
    activeAnimations.clear();
    
    // 播放游戏结束音效
    playSound(gameOverSound);
    
    const gameOver = document.createElement('div');
    gameOver.className = 'game-over';
    
    const heading = document.createElement('h2');
    heading.textContent = 'Game Over!';
    
    const scoreText = document.createElement('p');
    scoreText.textContent = `Final Score: ${score}`;
    
    const restartButton = document.createElement('button');
    restartButton.textContent = 'Play Again';
    restartButton.onclick = newGame;
    
    gameOver.appendChild(heading);
    gameOver.appendChild(scoreText);
    gameOver.appendChild(restartButton);
    
    // 添加闪烁特效
    const confetti = document.createElement('div');
    confetti.style.position = 'absolute';
    confetti.style.width = '100%';
    confetti.style.height = '100%';
    confetti.style.zIndex = '-1';
    confetti.style.overflow = 'hidden';
    
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        const size = Math.random() * 10 + 5;
        particle.style.position = 'absolute';
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.background = `hsl(${Math.random() * 360}, 100%, 70%)`;
        particle.style.borderRadius = '50%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animation = `floatUp ${1 + Math.random() * 2}s linear infinite`;
        particle.style.animationDelay = Math.random() + 's';
        confetti.appendChild(particle);
    }
    
    gameOver.appendChild(confetti);
    
    const gridContainer = document.querySelector('.grid-container');
    gridContainer.parentNode.appendChild(gameOver);
}

// 触摸滑动支持
let touchStartX, touchStartY;
const gridElement = document.getElementById('grid');

gridElement.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    e.preventDefault();
}, { passive: false });

gridElement.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

gridElement.addEventListener('touchend', (e) => {
    if (!touchStartX || !touchStartY) return;
    
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;
    
    // 判断滑动方向
    if (Math.abs(diffX) > Math.abs(diffY)) {
        // 水平滑动
        if (diffX > 30) {
            move('right');
        } else if (diffX < -30) {
            move('left');
        }
    } else {
        // 垂直滑动
        if (diffY > 30) {
            move('down');
        } else if (diffY < -30) {
            move('up'); // 向上滑动也会触发"此操作无效"
        }
    }
    
    touchStartX = null;
    touchStartY = null;
    e.preventDefault();
}, { passive: false });

// 键盘控制
document.addEventListener('keydown', e => {
    if (gameIsOver) return;
    
    const map = {
        'ArrowLeft': 'left',
        'ArrowRight': 'right',
        'ArrowUp': 'up', // 保留映射，但会在move函数中被拦截
        'ArrowDown': 'down'
    };
    
    if (map[e.key]) {
        e.preventDefault(); // 防止滚动页面
        move(map[e.key]);
    }
});

// 初始化最高分
document.getElementById('best-score').textContent = bestScore;

// 初始化游戏
newGame();

// 允许用户点击任意位置启动音频
document.addEventListener('click', function() {
    if (!musicPlaying) {
        // 预加载所有音频
        const audioElements = [bgMusic, moveSound, mergeSound, gameOverSound];
        audioElements.forEach(audio => {
            audio.volume = 0;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    audio.pause();
                    audio.volume = audio === bgMusic ? 0.3 : 0.5;
                }).catch(error => {
                    console.log('音频预加载失败:', error);
                });
            }
        });
    }
}, { once: true }); 