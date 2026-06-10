/**
 * Wavelength Client Application
 */

(function() {
  'use strict';

  // Socket connection
  const socket = io();

  // State
  let gameState = null;
  let myId = null;
  let myName = null;
  let guessLocked = false;
  let revealAnimationPlayed = false;
  let currentScreen = 'home';
  let isTransitioning = false;
  let timerInterval = null;
  let timerEndTime = null;

  // Dial instances
  let composeDial = null;
  let guessDial = null;
  let revealDial = null;

  // DOM Elements
  const elements = {
    header: document.getElementById('header'),
    playerScore: document.getElementById('player-score'),
    gameArea: document.getElementById('game-area'),
    chatSidebar: document.getElementById('chat-sidebar'),

    // Screens
    screenHome: document.getElementById('screen-home'),
    screenLobby: document.getElementById('screen-lobby'),
    screenCompose: document.getElementById('screen-compose'),
    screenGuess: document.getElementById('screen-guess'),
    screenReveal: document.getElementById('screen-reveal'),
    screenGameover: document.getElementById('screen-gameover'),

    // Home
    playerName: document.getElementById('player-name'),
    btnCreate: document.getElementById('btn-create'),
    roomCodeInput: document.getElementById('room-code-input'),
    btnJoin: document.getElementById('btn-join'),
    homeError: document.getElementById('home-error'),

    // Lobby
    roomCodeDisplay: document.getElementById('room-code-display'),
    playersList: document.getElementById('players-list'),
    lobbySettings: document.getElementById('lobby-settings'),
    roundsSelect: document.getElementById('rounds-select'),
    timerSelect: document.getElementById('timer-select'),
    btnStart: document.getElementById('btn-start'),
    lobbyWaiting: document.getElementById('lobby-waiting'),

    // Compose
    composeGiver: document.getElementById('compose-giver'),
    composeWaiting: document.getElementById('compose-waiting'),
    spectrumSetup: document.getElementById('spectrum-setup'),
    spectrumReadonly: document.getElementById('spectrum-readonly'),
    presetChips: document.getElementById('preset-chips'),
    leftLabel: document.getElementById('left-label'),
    rightLabel: document.getElementById('right-label'),
    spectrumLeft: document.getElementById('spectrum-left'),
    spectrumRight: document.getElementById('spectrum-right'),
    btnChangeSpectrum: document.getElementById('btn-change-spectrum'),
    composeDialContainer: document.getElementById('compose-dial-container'),
    hintInput: document.getElementById('hint-input'),
    btnSubmitHint: document.getElementById('btn-submit-hint'),
    giverName: document.getElementById('giver-name'),
    giverTimer: document.getElementById('giver-timer'),
    giverTimerValue: document.getElementById('giver-timer-value'),
    composeTimer: document.getElementById('compose-timer'),
    composeTimerValue: document.getElementById('compose-timer-value'),
    composeStandings: document.getElementById('compose-standings'),

    // Guess
    guessGuesser: document.getElementById('guess-guesser'),
    guessWaiting: document.getElementById('guess-waiting'),
    guessLocked: document.getElementById('guess-locked'),
    guessSpectrumLeft: document.getElementById('guess-spectrum-left'),
    guessSpectrumRight: document.getElementById('guess-spectrum-right'),
    guessHint: document.getElementById('guess-hint'),
    guessDialContainer: document.getElementById('guess-dial-container'),
    dialLabelLeft: document.getElementById('dial-label-left'),
    dialLabelRight: document.getElementById('dial-label-right'),
    btnLockGuess: document.getElementById('btn-lock-guess'),
    giverHintDisplay: document.getElementById('giver-hint-display'),
    guessProgress: document.getElementById('guess-progress'),
    lockedProgress: document.getElementById('locked-progress'),

    // Reveal
    revealSpectrumLeft: document.getElementById('reveal-spectrum-left'),
    revealSpectrumRight: document.getElementById('reveal-spectrum-right'),
    revealHint: document.getElementById('reveal-hint'),
    revealDialContainer: document.getElementById('reveal-dial-container'),
    revealDialLeft: document.getElementById('reveal-dial-left'),
    revealDialRight: document.getElementById('reveal-dial-right'),
    giverScoreDisplay: document.getElementById('giver-score-display'),
    resultsBody: document.getElementById('results-body'),
    standingsList: document.getElementById('standings-list'),
    btnNextTurn: document.getElementById('btn-next-turn'),
    btnChangeSpectrumReveal: document.getElementById('btn-change-spectrum-reveal'),

    // Game Over
    winnerName: document.getElementById('winner-name'),
    finalStandings: document.getElementById('final-standings'),
    btnPlayAgain: document.getElementById('btn-play-again'),

    // Chat
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    btnSendChat: document.getElementById('btn-send-chat'),

    // Fireworks
    fireworksCanvas: document.getElementById('fireworks-canvas'),

    // Toast
    toast: document.getElementById('toast')
  };

  // Initialize
  function init() {
    setupEventListeners();
    setupPresetChips();
    myId = socket.id;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Home screen
    elements.btnCreate.addEventListener('click', createGame);
    elements.btnJoin.addEventListener('click', joinGame);
    elements.playerName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') createGame();
    });
    elements.roomCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') joinGame();
    });

    // Lobby
    elements.roomCodeDisplay.addEventListener('click', copyRoomCode);
    elements.btnStart.addEventListener('click', startGame);

    // Compose
    elements.btnChangeSpectrum.addEventListener('click', changeSpectrum);
    elements.btnSubmitHint.addEventListener('click', submitHint);

    // Guess
    elements.btnLockGuess.addEventListener('click', lockGuess);

    // Reveal
    elements.btnNextTurn.addEventListener('click', nextTurn);
    elements.btnChangeSpectrumReveal.addEventListener('click', changeSpectrumAndNext);

    // Game Over
    elements.btnPlayAgain.addEventListener('click', playAgain);

    // Chat
    elements.btnSendChat.addEventListener('click', sendChat);
    elements.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendChat();
    });
  }

  // Setup preset chips
  function setupPresetChips() {
    if (!window.PRESETS) return;

    elements.presetChips.innerHTML = '';
    window.PRESETS.forEach((preset, index) => {
      const chip = document.createElement('button');
      chip.className = 'preset-chip';
      chip.textContent = `${preset.left} / ${preset.right}`;
      chip.addEventListener('click', () => selectPreset(preset));
      elements.presetChips.appendChild(chip);
    });
  }

  function selectPreset(preset) {
    elements.leftLabel.value = preset.left;
    elements.rightLabel.value = preset.right;
  }

  // Screen management with transitions
  function showScreen(screenId) {
    if (screenId === currentScreen || isTransitioning) return;

    const oldScreen = document.getElementById(`screen-${currentScreen}`);
    const newScreen = document.getElementById(`screen-${screenId}`);

    if (!newScreen) return;

    // Determine transition type
    const transitionType = getTransitionType(currentScreen, screenId);

    // Show/hide header and chat
    const showHeader = screenId !== 'home';
    const showChat = screenId !== 'home';
    elements.header.style.display = showHeader ? 'flex' : 'none';
    elements.chatSidebar.style.display = showChat ? 'flex' : 'none';

    if (transitionType === 'none' || !oldScreen) {
      // No animation - just switch
      if (oldScreen) oldScreen.classList.remove('active');
      newScreen.classList.add('active');
      currentScreen = screenId;
      return;
    }

    isTransitioning = true;

    // Apply transition classes based on type
    if (transitionType === 'slide-right') {
      // Home -> Lobby: home slides left, lobby slides in from right
      oldScreen.classList.add('transitioning', 'slide-out-left');
      newScreen.classList.add('active', 'transitioning', 'slide-in-right');
    } else if (transitionType === 'slide-left') {
      // Lobby -> Home: lobby slides right, home slides in from left
      oldScreen.classList.add('transitioning', 'slide-out-right');
      newScreen.classList.add('active', 'transitioning', 'slide-in-left');
    } else if (transitionType === 'fade-pop') {
      // Lobby -> Game screens: fade out, pop in
      oldScreen.classList.add('transitioning', 'fade-out');
      newScreen.classList.add('active', 'transitioning', 'pop-in');
    }

    // Clean up after animation
    setTimeout(() => {
      oldScreen.classList.remove('active', 'transitioning', 'slide-out-left', 'slide-out-right', 'fade-out');
      newScreen.classList.remove('transitioning', 'slide-in-right', 'slide-in-left', 'pop-in');
      currentScreen = screenId;
      isTransitioning = false;
    }, 500);
  }

  // Determine which transition to use based on screen change
  function getTransitionType(from, to) {
    // Home <-> Lobby: slide
    if (from === 'home' && to === 'lobby') return 'slide-right';
    if (from === 'lobby' && to === 'home') return 'slide-left';

    // Lobby -> Game screens: fade-pop
    if (from === 'lobby' && (to === 'compose' || to === 'guess' || to === 'reveal' || to === 'gameover')) {
      return 'fade-pop';
    }

    // Game screens -> Lobby (play again): fade-pop
    if ((from === 'gameover' || from === 'reveal') && to === 'lobby') {
      return 'fade-pop';
    }

    // Between game screens: fade-pop
    if (['compose', 'guess', 'reveal', 'gameover'].includes(from) &&
        ['compose', 'guess', 'reveal', 'gameover'].includes(to)) {
      return 'fade-pop';
    }

    return 'none';
  }

  // Show error message
  function showError(message) {
    elements.homeError.textContent = message;
    elements.homeError.style.display = 'block';
    setTimeout(() => {
      elements.homeError.style.display = 'none';
    }, 5000);
  }

  // Show toast notification
  function showToast(message, duration = 3000) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    setTimeout(() => {
      elements.toast.classList.remove('show');
    }, duration);
  }

  // Timer functions
  function startTimer(startedAt, duration) {
    // Clear any existing timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }

    timerEndTime = startedAt + (duration * 1000);

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.ceil((timerEndTime - now) / 1000));

      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      const display = minutes > 0
        ? `${minutes}:${seconds.toString().padStart(2, '0')}`
        : `${seconds}`;

      // Update both timer displays
      elements.giverTimerValue.textContent = display;
      elements.composeTimerValue.textContent = display;

      // Add warning class when under 10 seconds
      const isWarning = remaining <= 10 && remaining > 0;
      elements.giverTimerValue.classList.toggle('warning', isWarning);
      elements.composeTimerValue.classList.toggle('warning', isWarning);

      if (remaining <= 0) {
        stopTimer();
      }
    };

    // Show timer displays
    elements.giverTimer.style.display = 'block';
    elements.composeTimer.style.display = 'block';

    updateTimer();
    timerInterval = setInterval(updateTimer, 250);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerEndTime = null;
    elements.giverTimer.style.display = 'none';
    elements.composeTimer.style.display = 'none';
    elements.giverTimerValue.classList.remove('warning');
    elements.composeTimerValue.classList.remove('warning');
  }

  // Game actions
  function createGame() {
    const name = elements.playerName.value.trim();
    if (!name) {
      showError('Please enter your name');
      return;
    }

    myName = name;
    socket.emit('createRoom', name, (response) => {
      if (response.success) {
        myId = socket.id;
      } else {
        showError(response.error || 'Failed to create game');
      }
    });
  }

  function joinGame() {
    const name = elements.playerName.value.trim();
    const code = elements.roomCodeInput.value.trim().toUpperCase();

    if (!name) {
      showError('Please enter your name');
      return;
    }
    if (!code || code.length !== 4) {
      showError('Please enter a valid 4-letter room code');
      return;
    }

    myName = name;
    socket.emit('joinRoom', code, name, (response) => {
      if (response.success) {
        myId = socket.id;
      } else {
        showError(response.error || 'Failed to join game');
      }
    });
  }

  function copyRoomCode() {
    const code = elements.roomCodeDisplay.textContent.replace('Copy', '').trim();
    navigator.clipboard.writeText(code).then(() => {
      elements.roomCodeDisplay.setAttribute('data-copied', 'true');
      setTimeout(() => {
        elements.roomCodeDisplay.removeAttribute('data-copied');
      }, 1000);
    });
  }

  function startGame() {
    const rounds = parseInt(elements.roundsSelect.value) || 3;
    const timerDuration = parseInt(elements.timerSelect.value) || 0;
    socket.emit('startGame', { rounds, timerDuration });
  }

  function changeSpectrum() {
    socket.emit('changeSpectrum');
  }

  function submitHint() {
    const hint = elements.hintInput.value.trim();
    const leftLabel = elements.leftLabel.value.trim();
    const rightLabel = elements.rightLabel.value.trim();

    if (!gameState.spectrum && (!leftLabel || !rightLabel)) {
      alert('Please set the spectrum labels');
      return;
    }
    if (!hint) {
      alert('Please enter a hint');
      return;
    }

    const data = { hint };
    if (!gameState.spectrum) {
      data.leftLabel = leftLabel;
      data.rightLabel = rightLabel;
    }

    socket.emit('submitRound', data);
  }

  function lockGuess() {
    if (!guessDial || guessLocked) return;

    const value = guessDial.getValue();
    socket.emit('lockGuess', value);
    guessLocked = true;
  }

  function nextTurn() {
    socket.emit('nextTurn');
  }

  function changeSpectrumAndNext() {
    socket.emit('changeSpectrum');
    socket.emit('nextTurn');
  }

  function playAgain() {
    socket.emit('newGame');
  }

  function sendChat() {
    const text = elements.chatInput.value.trim();
    if (!text) return;

    socket.emit('chat', text);
    elements.chatInput.value = '';
  }

  // Calculate score based on distance
  function calculateScore(distance) {
    if (distance === 0) return 4;
    if (distance === 1) return 3;
    if (distance === 2) return 2;
    if (distance === 3) return 1;
    return 0;
  }

  // Render functions
  function renderLobby() {
    elements.roomCodeDisplay.textContent = gameState.code;

    // Players list
    const playerOrder = gameState.order || Object.keys(gameState.players);
    elements.playersList.innerHTML = playerOrder.map(id => {
      const player = gameState.players[id];
      if (!player) return '';

      let classes = 'player-tag';
      if (id === gameState.hostId) classes += ' host';
      if (!player.connected) classes += ' disconnected';

      return `<span class="${classes}">${player.name}</span>`;
    }).join('');

    // Host controls
    const isHost = myId === gameState.hostId;
    elements.lobbySettings.style.display = isHost ? 'flex' : 'none';
    elements.btnStart.style.display = isHost ? 'block' : 'none';
    elements.lobbyWaiting.style.display = isHost ? 'none' : 'block';

    // Enable/disable start button
    const connectedCount = Object.values(gameState.players).filter(p => p.connected).length;
    elements.btnStart.disabled = connectedCount < 2;
  }

  function renderCompose() {
    const isGiver = myId === gameState.giverId;

    elements.composeGiver.style.display = isGiver ? 'block' : 'none';
    elements.composeWaiting.style.display = isGiver ? 'none' : 'block';

    // Handle timer
    if (gameState.timerDuration && gameState.timerStartedAt) {
      startTimer(gameState.timerStartedAt, gameState.timerDuration);
    } else {
      stopTimer();
    }

    if (isGiver) {
      // Spectrum setup vs readonly
      const hasSpectrum = gameState.spectrum !== null;
      elements.spectrumSetup.style.display = hasSpectrum ? 'none' : 'block';
      elements.spectrumReadonly.style.display = hasSpectrum ? 'block' : 'none';

      if (hasSpectrum) {
        elements.spectrumLeft.textContent = gameState.spectrum.leftLabel;
        elements.spectrumRight.textContent = gameState.spectrum.rightLabel;
      }

      // Create/update dial for clue-giver showing target
      const target = gameState.round?.target;
      if (!composeDial) {
        composeDial = new WavelengthDial(elements.composeDialContainer, {
          interactive: false,
          showCover: false
        });
      }
      composeDial.hideGuessHand();
      if (target) {
        composeDial.showTargetPreview(target);
      }

      // Clear hint input
      elements.hintInput.value = '';
    } else {
      // Show who is giving
      const giver = gameState.players[gameState.giverId];
      elements.giverName.textContent = giver ? giver.name : 'Someone';

      // Show standings for non-givers
      renderStandings(elements.composeStandings);
    }
  }

  function renderGuess() {
    const isGiver = myId === gameState.giverId;
    const hasGuessed = gameState.round?.guesses && myId in gameState.round.guesses;

    elements.guessGuesser.style.display = (!isGiver && !hasGuessed) ? 'block' : 'none';
    elements.guessWaiting.style.display = isGiver ? 'block' : 'none';
    elements.guessLocked.style.display = (!isGiver && hasGuessed) ? 'block' : 'none';

    if (!isGiver && !hasGuessed) {
      // Set up guesser view
      if (gameState.spectrum) {
        elements.guessSpectrumLeft.textContent = gameState.spectrum.leftLabel;
        elements.guessSpectrumRight.textContent = gameState.spectrum.rightLabel;
        elements.dialLabelLeft.textContent = gameState.spectrum.leftLabel;
        elements.dialLabelRight.textContent = gameState.spectrum.rightLabel;
      }
      elements.guessHint.textContent = gameState.round?.hint || '';

      // Create/update dial for guesser
      if (!guessDial) {
        guessDial = new WavelengthDial(elements.guessDialContainer, {
          interactive: true,
          showCover: true
        });
        guessDial.showGuessHand();
      }
      guessDial.setInteractive(true);
      guessDial.setCoverVisible(true);
      guessLocked = false;
    } else if (isGiver) {
      elements.giverHintDisplay.textContent = gameState.round?.hint || '';
    }

    // Update progress
    const guessers = Object.values(gameState.players).filter(p =>
      p.connected && p.id !== gameState.giverId
    );
    const guessedCount = Object.keys(gameState.round?.guesses || {}).length;
    const progressText = `${guessedCount} / ${guessers.length} guessed`;
    elements.guessProgress.textContent = progressText;
    elements.lockedProgress.textContent = progressText;
  }

  async function renderReveal() {
    // Spectrum and hint
    if (gameState.spectrum) {
      elements.revealSpectrumLeft.textContent = gameState.spectrum.leftLabel;
      elements.revealSpectrumRight.textContent = gameState.spectrum.rightLabel;
      elements.revealDialLeft.textContent = gameState.spectrum.leftLabel;
      elements.revealDialRight.textContent = gameState.spectrum.rightLabel;
    }
    elements.revealHint.textContent = gameState.round?.hint || '';

    // Create/update reveal dial
    if (!revealDial) {
      revealDial = new WavelengthDial(elements.revealDialContainer, {
        interactive: false,
        showCover: true
      });
    }

    // Prepare guesses data
    const guessesData = {};
    for (const [playerId, guess] of Object.entries(gameState.round?.guesses || {})) {
      const player = gameState.players[playerId];
      guessesData[playerId] = {
        guess,
        name: player?.name || 'Unknown',
        isOwn: playerId === myId
      };
    }

    // Play reveal animation if not already played
    if (!revealAnimationPlayed && gameState.round?.target) {
      revealAnimationPlayed = true;
      revealDial.hideGuessHand();
      await revealDial.reveal(gameState.round.target, guessesData, 1500);

      // Check for exact guesses and trigger fireworks
      const target = gameState.round.target;
      const hasExact = Object.values(gameState.round.guesses || {}).some(g => g === target);
      if (hasExact) {
        triggerFireworks();
      }
    } else {
      // Already revealed, just show the state
      revealDial.setTarget(gameState.round.target);
      revealDial.setGuesses(guessesData);
      revealDial.setCoverVisible(false);
    }

    // Giver score
    const giver = gameState.players[gameState.giverId];
    const giverScore = gameState.round?.giverScore || 0;
    elements.giverScoreDisplay.innerHTML = `
      <strong>${giver?.name || 'Clue Giver'}</strong> earned <strong>+${giverScore}</strong> point${giverScore !== 1 ? 's' : ''}
    `;

    // Results table
    const target = gameState.round?.target || 0;
    elements.resultsBody.innerHTML = Object.entries(gameState.round?.guesses || {})
      .map(([playerId, guess]) => {
        const player = gameState.players[playerId];
        const distance = Math.abs(guess - target);
        const points = calculateScore(distance);
        const isExact = distance === 0;

        return `
          <tr>
            <td>${player?.name || 'Unknown'}</td>
            <td>${guess}</td>
            <td>${distance}</td>
            <td class="points ${isExact ? 'exact' : ''}">+${points}</td>
          </tr>
        `;
      }).join('');

    // Standings
    renderStandings(elements.standingsList);
  }

  function renderGameOver() {
    // Find winner
    const sortedPlayers = Object.values(gameState.players)
      .filter(p => p.connected)
      .sort((a, b) => b.score - a.score);

    if (sortedPlayers.length > 0) {
      elements.winnerName.textContent = sortedPlayers[0].name;
    }

    // Final standings
    renderStandings(elements.finalStandings);

    // Fireworks
    triggerFireworks();
  }

  function renderStandings(container) {
    const sortedPlayers = Object.values(gameState.players)
      .sort((a, b) => b.score - a.score);

    container.innerHTML = sortedPlayers.map((player, index) => {
      const isWinner = index === 0 && gameState.phase === 'gameover';
      return `
        <div class="standings-item ${isWinner ? 'winner' : ''}">
          <span class="standings-rank">${index + 1}.</span>
          <span class="standings-name">${player.name}${!player.connected ? ' (disconnected)' : ''}</span>
          <span class="standings-score">${player.score}</span>
        </div>
      `;
    }).join('');
  }

  function updatePlayerScore() {
    const me = gameState.players[myId];
    if (me) {
      elements.playerScore.innerHTML = `You: <strong>${me.score}</strong>`;
    }
  }

  // Fireworks
  function triggerFireworks() {
    const canvas = elements.fireworksCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#e8a598', '#a8c5b8', '#f0d5c8', '#c4b7d4', '#a8c4d4'];

    function createFirework(x, y) {
      const particleCount = 50;
      const color = colors[Math.floor(Math.random() * colors.length)];

      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const velocity = 2 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * velocity,
          vy: Math.sin(angle) * velocity,
          alpha: 1,
          color,
          size: 2 + Math.random() * 2
        });
      }
    }

    function animate() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.alpha -= 0.015;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}`;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (particles.length > 0) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    // Launch multiple fireworks
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        createFirework(
          Math.random() * canvas.width * 0.8 + canvas.width * 0.1,
          Math.random() * canvas.height * 0.4 + canvas.height * 0.1
        );
      }, i * 200);
    }

    animate();
  }

  // Socket event handlers
  socket.on('connect', () => {
    myId = socket.id;
  });

  socket.on('state', (state) => {
    const previousPhase = gameState?.phase;
    gameState = state;

    // Reset reveal animation flag on phase change
    if (state.phase !== 'reveal' && state.phase !== previousPhase) {
      revealAnimationPlayed = false;
    }

    // Show toast when hint is submitted (phase changes to guess)
    if (state.phase === 'guess' && previousPhase === 'compose') {
      const giver = state.players[state.giverId];
      const giverName = giver ? giver.name : 'The clue giver';
      if (myId !== state.giverId) {
        showToast(`${giverName} submitted a hint!`);
      }
      stopTimer();
    }

    // Stop timer when leaving compose phase
    if (state.phase !== 'compose' && previousPhase === 'compose') {
      stopTimer();
    }

    // Update screen based on phase
    switch (state.phase) {
      case 'lobby':
        showScreen('lobby');
        renderLobby();
        break;
      case 'compose':
        showScreen('compose');
        renderCompose();
        break;
      case 'guess':
        showScreen('guess');
        renderGuess();
        break;
      case 'reveal':
        showScreen('reveal');
        renderReveal();
        break;
      case 'gameover':
        showScreen('gameover');
        renderGameOver();
        break;
    }

    updatePlayerScore();
  });

  socket.on('chatHistory', (messages) => {
    elements.chatMessages.innerHTML = '';
    messages.forEach(addChatMessage);
  });

  socket.on('chatMessage', (message) => {
    addChatMessage(message);
  });

  function addChatMessage(message) {
    const div = document.createElement('div');
    div.className = `chat-message ${message.senderId === myId ? 'own' : ''}`;
    div.innerHTML = `
      <span class="chat-sender">${message.senderName}</span>
      <span class="chat-text">${escapeHtml(message.text)}</span>
    `;
    elements.chatMessages.appendChild(div);

    // Auto-scroll if near bottom
    const { scrollHeight, scrollTop, clientHeight } = elements.chatMessages;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      elements.chatMessages.scrollTop = scrollHeight;
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
