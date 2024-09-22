// Version: 1.4.0

var canvas = document.getElementById('game-canvas');
var ctx = canvas.getContext('2d');

// Display the dialog window when the page loads
document.getElementById('game-dialog').style.display = 'block';

// Pause the game loop until the player chooses to start the game
var gamePaused = true;

// Get the button elements
var yesButton = document.getElementById('start');

// When the "Start" button is clicked, start the game
yesButton.addEventListener('click', function() {
    document.getElementById('game-dialog').style.display = 'none'; // Hide the dialog window
    gamePaused = false; // Unpause the game
    gameLoop(); // Start the game loop
});

// 获取按钮元素
var btnLeft = document.getElementById('btn-left');
var btnRight = document.getElementById('btn-right');
var btnFire = document.getElementById('btn-fire');

// 用于跟踪触摸输入的变量
var touchLeft = false;
var touchRight = false;

// 左按钮的触摸事件监听器
btnLeft.addEventListener('touchstart', function(e) {
    e.preventDefault();
    touchLeft = true;
});

btnLeft.addEventListener('touchend', function(e) {
    e.preventDefault();
    touchLeft = false;
});

// 右按钮的触摸事件监听器
btnRight.addEventListener('touchstart', function(e) {
    e.preventDefault();
    touchRight = true;
});

btnRight.addEventListener('touchend', function(e) {
    e.preventDefault();
    touchRight = false;
});

// 发射按钮的触摸事件监听器
btnFire.addEventListener('touchstart', function(e) {
    e.preventDefault();
    if (player.hasPowerUp) {
        fireBullet();
    }
});

// Game variables
var player = {
    x: canvas.width / 2 - 15,
    y: canvas.height - 60,
    width: 30,
    height: 60,
    speed: 5,
    color: 'blue',
    hasPowerUp: false,
    powerUpType: null,
    powerUpTimer: 0
};

var obstacles = [];
var powerUps = [];
var bullets = [];
var enemyBullets = [];
var particles = [];
var orbitParticles = [];
var keys = {};
var score = 0;
var highScore = 0;
var speedMultiplier = 1;
var obstacleFrequency = 100;
var obstacleTimer = 0;
var powerUpTimer = 0;
var gameOver = false;
var lastTime = Date.now();

// Load high score from localStorage
if (localStorage.getItem('highScore')) {
    highScore = parseInt(localStorage.getItem('highScore'));
    document.getElementById('high-score').innerText = '最高得分： ' + highScore;
}

document.addEventListener('keydown', function(e) {
    keys[e.keyCode] = true;
});

document.addEventListener('keyup', function(e) {
    keys[e.keyCode] = false;
    if (e.keyCode === 32 && player.hasPowerUp) {
        fireBullet();
    }
});

function gameLoop() {
    if (gameOver || gamePaused) return; // If the game is over or paused, stop the loop
    var now = Date.now();
    var deltaTime = now - lastTime;
    lastTime = now;
    
    update(deltaTime);
    updateParticles(deltaTime); // Update particles
    draw();
    drawParticles(); // Draw particles
    
    requestAnimationFrame(gameLoop);
}




function update(deltaTime) {
    // Update player position
    if ((keys[37] || touchLeft) && player.x > 0) {
        player.x -= player.speed;
    }
    if ((keys[39] || touchRight) && player.x + player.width < canvas.width) {
        player.x += player.speed;
    }
    
    // Update the particles orbiting around the car
    if (player.hasPowerUp) {
        for (var i = 0; i < orbitParticles.length; i++) {
            var p = orbitParticles[i];
            p.angle += p.speed;
        }
    } else {
        orbitParticles = []; // Clear particles when there is no power-up
    }
    
    // Update obstacles
    for (var i = obstacles.length - 1; i >= 0; i--) {
        var obs = obstacles[i];
    
        // Acceleration logic for purple obstacles
        if (obs.type === 'purple') {
            if (!obs.accelerated && obs.y > canvas.height / 3) {
                obs.speed *= 4; // Sudden acceleration, speed increases 4 times
                obs.accelerated = true; // Mark as accelerated
            }
        }      
        
        obs.y += obs.speed * speedMultiplier;
        
        if (obs.y > canvas.height) {
            obstacles.splice(i, 1);
            score += 10;
            updateScore();
        } else if (collision(player, obs)) {
            endGame();
        }

        // Red obstacle fires bullets
        if (obs.type === 'red') {
            obs.fireTimer++;
            if (obs.fireTimer > obs.fireInterval) {
                fireEnemyBullets(obs);
                obs.fireTimer = 0;
            }
        }
    }
    
    // Generate obstacles
    obstacleTimer++;
    var freq = Math.max(20, obstacleFrequency - Math.floor(score / 500) * 10);
    if (obstacleTimer > freq) {
        generateObstacle();
        obstacleTimer = 0;
    }
    
    // Update power-ups
    for (var i = powerUps.length - 1; i >= 0; i--) {
        var pu = powerUps[i];
        pu.y += pu.speed * speedMultiplier;
        
        if (pu.y > canvas.height) {
            powerUps.splice(i, 1);
        } else if (collision(player, pu)) {
            player.hasPowerUp = true;
            player.powerUpType = pu.type;
            player.powerUpTimer = pu.duration;
            powerUps.splice(i, 1);
            
            // Initialize particles orbiting the car
            initOrbitParticles();
        }
    }

    // Generate power-ups
    powerUpTimer++;
    if (powerUpTimer > 500) {
        generatePowerUp();
        powerUpTimer = 0;
    }
    
    // Update player power-up timer
    if (player.hasPowerUp) {
        player.powerUpTimer -= deltaTime;
        if (player.powerUpTimer <= 3000) {
            if (Math.floor(player.powerUpTimer / 200) % 2 === 0) {
                player.color = 'white';
            } else {
                player.color = 'blue';
            }
        } else {
            player.color = 'blue';
        }
        if (player.powerUpTimer <= 0) {
            player.hasPowerUp = false;
            player.powerUpType = null;
            player.color = 'blue';
        }
    }
    
    // Update bullets
    for (var i = bullets.length - 1; i >= 0; i--) {
        var bullet = bullets[i];
        bullet.x += bullet.vx || 0;
        bullet.y += bullet.vy || -bullet.speed;
        if (bullet.y < 0 || bullet.x < 0 || bullet.x > canvas.width) {
            bullets.splice(i, 1);
        } else {
            // Check collision with obstacles
            for (var j = obstacles.length - 1; j >= 0; j--) {
                var obs = obstacles[j];
                if (collision(bullet, obs)) {
                    obstacles.splice(j, 1); // Remove the destroyed obstacle
                    bullets.splice(i, 1);   // Remove the bullet that hit
                    
                    // Increase score based on obstacle type
                    if (obs.type === 'green') {
                        score += 20; // Green case
                    } else if (obs.type === 'red') {
                        score += 50; // Red case
                    } else if (obs.type === 'purple') {
                        score += 100; // Purple case
                    } else {
                        score += 20; // Default case, increase by 20 points (in case of other obstacle types)
                    }
                    
                    updateScore(); // Update score display
                    break;
                }
            }
        }
    }
    
    // Update enemy bullets
    for (var i = enemyBullets.length - 1; i >= 0; i--) {
        var bullet = enemyBullets[i];
        bullet.x += bullet.vx;
        bullet.y += bullet.vy;
        if (bullet.y > canvas.height || bullet.x < 0 || bullet.x > canvas.width) {
            enemyBullets.splice(i, 1);
        } else if (collision(player, bullet)) {
            endGame();
        }
    }
    
    // Increase speed based on score
    speedMultiplier = 1 + Math.floor(score / 100) * 0.1;
}

function updateParticles(deltaTime) {
    // Generate new particles
    if (particles.length < 100) { // Adjust the number to control particle count
        particles.push({
            x: Math.random() * canvas.width,
            y: -10,
            speed: 1 + Math.random() * 2,
            size: 1 + Math.random() * 2,
            opacity: Math.random()
        });
    }
    // Update particle positions
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.y += p.speed * speedMultiplier;
        if (p.y > canvas.height) {
            particles.splice(i, 1);
        }
    }
}

function initOrbitParticles() {
    orbitParticles = [];
    var numParticles;
    var particleColor;
    var particleSize;
    var particleSpeed;

    if (player.powerUpType === 'type1') {
        // Particle properties for Type1 power-up
        numParticles = 8; // Number of particles, adjustable
        particleColor = 'white';
        particleSize = 3; // Particle size, adjustable
        particleSpeed = 0.005; // Particle rotation speed, adjustable
    } else if (player.powerUpType === 'type2') {
        // Particle properties for Type2 power-up
        numParticles = 8;
        particleColor = 'gold';
        particleSize = 3;
        particleSpeed = 0.05;
    }

    for (var i = 0; i < numParticles; i++) {
        orbitParticles.push({
            angle: (Math.PI * 2 / numParticles) * i, // Initial angle of the particle
            radius: 40, // Orbit radius, adjustable
            speed: particleSpeed,
            size: particleSize,
            color: particleColor
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    
    // Draw obstacles
    for (var i = 0; i < obstacles.length; i++) {
        var obs = obstacles[i];
        ctx.fillStyle = obs.color;
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }    
    
    // Draw power-ups
    for (var i = 0; i < powerUps.length; i++) {
        var pu = powerUps[i];
        if (pu.type === 'type1') {
            ctx.fillStyle = pu.color;
            ctx.fillRect(pu.x, pu.y, pu.size, pu.size);
        } else if (pu.type === 'type2') {
            if (Math.floor(Date.now() / 200) % 2 === 0) {
                ctx.fillStyle = pu.color;
            } else {
                ctx.fillStyle = 'white';
            }
            ctx.beginPath();
            ctx.arc(pu.x + pu.size / 2, pu.y + pu.size / 2, pu.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Draw bullets
    for (var i = 0; i < bullets.length; i++) {
        var bullet = bullets[i];
        ctx.fillStyle = 'white';
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }

    // Draw enemy bullets
    for (var i = 0; i < enemyBullets.length; i++) {
        var bullet = enemyBullets[i];
        ctx.fillStyle = 'white';
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    }
    
    // Draw particles orbiting the car
    if (player.hasPowerUp) {
        for (var i = 0; i < orbitParticles.length; i++) {
            var p = orbitParticles[i];
            var x = player.x + player.width / 2 + p.radius * Math.cos(p.angle);
            var y = player.y + player.height / 2 + p.radius * Math.sin(p.angle);
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(x, y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawParticles() {
    ctx.fillStyle = 'white';
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        ctx.globalAlpha = p.opacity; // Set particle opacity
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1.0; // Reset opacity
}

function generateObstacle() {
    var obstacle = {
        x: Math.random() * (canvas.width - 30),
        y: -50,
        width: 30,
        height: 50,
        speed: 2,
        color: 'green',
        type: 'green',
        fireTimer: 0
    };
    if (score > 1000 && Math.random() < 0.15) {
        obstacle.color = 'purple';
        obstacle.type = 'purple';
        obstacle.accelerated = false; // Mark whether it has accelerated
    } else if (score > 500 && Math.random() < 0.2) {
        obstacle.color = 'red';
        obstacle.type = 'red';
        obstacle.fireInterval = 100;
    }

    // Ensure no overlap with power-ups
    for (var i = 0; i < powerUps.length; i++) {
        if (collision(obstacle, powerUps[i])) {
            return;
        }
    }
    obstacles.push(obstacle);
}

function generatePowerUp() {
    var puType = (Math.random() < 0.2) ? 'type2' : 'type1';
    var powerUp = {
        x: Math.random() * (canvas.width - 20),
        y: -20,
        size: 20,
        speed: 2,
        type: puType,
        duration: (puType === 'type1') ? 10000 : 8000,
        color: (puType === 'type1') ? 'yellow' : 'gold'
    };

    // Ensure no overlap with obstacles
    for (var i = 0; i < obstacles.length; i++) {
        if (collision(powerUp, obstacles[i])) {
            return;
        }
    }
    powerUps.push(powerUp);
}

function fireBullet() {
    if (player.powerUpType === 'type1') {
        // Fire a straight bullet
        var bullet = {
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            width: 5,
            height: 10,
            speed: 7,
            vy: -7
        };
        bullets.push(bullet);
    } else if (player.powerUpType === 'type2') {
        // Fire three bullets: straight, 45 degrees left and right
        var bulletStraight = {
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            width: 5,
            height: 10,
            vx: 0,
            vy: -7
        };
        var bulletLeft = {
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            width: 5,
            height: 10,
            vx: -5,
            vy: -5
        };
        var bulletRight = {
            x: player.x + player.width / 2 - 2.5,
            y: player.y,
            width: 5,
            height: 10,
            vx: 5,
            vy: -5
        };
        bullets.push(bulletStraight, bulletLeft, bulletRight);
    }
}

function fireEnemyBullets(obstacle) {
    // Fire bullets straight down and at 45 degrees left and right
    var bulletStraight = {
        x: obstacle.x + obstacle.width / 2 - 2.5,
        y: obstacle.y + obstacle.height,
        width: 5,
        height: 10,
        vx: 0,
        vy: 5
    };
    var bulletLeft = {
        x: obstacle.x + obstacle.width / 2 - 2.5,
        y: obstacle.y + obstacle.height,
        width: 5,
        height: 10,
        vx: -3.5,
        vy: 3.5
    };
    var bulletRight = {
        x: obstacle.x + obstacle.width / 2 - 2.5,
        y: obstacle.y + obstacle.height,
        width: 5,
        height: 10,
        vx: 3.5,
        vy: 3.5
    };
    enemyBullets.push(bulletStraight, bulletLeft, bulletRight);
}

function collision(a, b) {
    return a.x < b.x + (b.width || b.size) &&
           a.x + a.width > b.x &&
           a.y < b.y + (b.height || b.size) &&
           a.y + a.height > b.y;
}

function updateScore() {
    document.getElementById('current-score').innerText = '得分： ' + score;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
        document.getElementById('high-score').innerText = '最高得分： ' + highScore;
    }
}

function endGame() {
    gameOver = true;
    displayRestartBox();
}

function displayRestartBox() {
    var restartBox = document.createElement('div');
    restartBox.id = 'restart-box';
    
    var message = document.createElement('p');
    message.innerText = '遊戲結束！ 是否重新開始？';
    restartBox.appendChild(message);
    
    var yesButton = document.createElement('button');
    yesButton.innerText = '是';
    yesButton.onclick = function() {
        resetGame(); // Reset the game
    };
    restartBox.appendChild(yesButton);
    
    var noButton = document.createElement('button');
    noButton.innerText = '否';
    noButton.onclick = function() {
        document.body.innerHTML = '<h1 style="text-align:center; margin-top:200px;">謝謝你的遊玩！</h1>';
    };
    restartBox.appendChild(noButton);
    
    document.getElementById('game-area').appendChild(restartBox);
}

function resetGame() {
    // Reset player state
    player.x = canvas.width / 2 - 15;
    player.y = canvas.height - 60;
    player.hasPowerUp = false;
    player.powerUpType = null;
    player.powerUpTimer = 0;
    player.color = 'blue';

    // Clear game element arrays
    obstacles = [];
    powerUps = [];
    bullets = [];
    enemyBullets = [];
    orbitParticles = [];
    particles = [];

    // Reset game variables
    score = 0;
    speedMultiplier = 1;
    obstacleFrequency = 100;
    obstacleTimer = 0;
    powerUpTimer = 0;
    gameOver = false;
    gamePaused = false;

    // Update score display
    updateScore();

    // Remove game over dialog
    var restartBox = document.getElementById('restart-box');
    if (restartBox) {
        restartBox.parentNode.removeChild(restartBox);
    }

    // Restart the game loop
    lastTime = Date.now();
    gameLoop();
}