const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Room storage
const rooms = new Map();

// Generate 4-letter room code (no ambiguous chars)
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

// Calculate score based on distance
function calculateScore(distance) {
  if (distance === 0) return 4;
  if (distance === 1) return 3;
  if (distance === 2) return 2;
  if (distance === 3) return 1;
  return 0;
}

// Get connected players in turn order
function getConnectedOrder(room) {
  return room.order.filter(id => room.players[id]?.connected);
}

// Get current clue-giver
function getCurrentGiver(room) {
  const connected = getConnectedOrder(room);
  if (connected.length === 0) return null;
  return connected[room.turnIndex % connected.length];
}

// Broadcast tailored state to each player
function broadcastState(room) {
  const giverId = getCurrentGiver(room);

  for (const [playerId, player] of Object.entries(room.players)) {
    if (!player.connected) continue;

    const socket = io.sockets.sockets.get(playerId);
    if (!socket) continue;

    // Base state (safe for everyone)
    const state = {
      code: room.code,
      hostId: room.hostId,
      phase: room.phase,
      players: room.players,
      order: room.order,
      turnIndex: room.turnIndex,
      turnNumber: room.turnNumber,
      roundNumber: room.roundNumber,
      roundsTarget: room.roundsTarget,
      spectrum: room.spectrum,
      giverId,
      timerDuration: room.timerDuration || 0,
      timerStartedAt: room.timerStartedAt || null,
      round: room.round ? {
        hint: room.round.hint,
        guesses: room.round.guesses,
        giverScore: room.round.giverScore
      } : null
    };

    // Include target only for clue-giver during compose/guess, or everyone at reveal
    if (room.round) {
      if (room.phase === 'reveal' || room.phase === 'gameover') {
        state.round.target = room.round.target;
      } else if (playerId === giverId) {
        state.round.target = room.round.target;
      }
    }

    socket.emit('state', state);
  }
}

// Start a new turn
function startTurn(room) {
  const connected = getConnectedOrder(room);
  if (connected.length < 2) {
    room.phase = 'lobby';
    broadcastState(room);
    return;
  }

  room.phase = 'compose';
  room.round = {
    hint: null,
    target: Math.floor(Math.random() * 20) + 1, // 1-20
    guesses: {},
    giverScore: 0
  };

  // Start timer if configured
  if (room.timerDuration > 0) {
    room.timerStartedAt = Date.now();
  } else {
    room.timerStartedAt = null;
  }

  broadcastState(room);
}

// Check if all guessers have locked
function checkAllGuessesIn(room) {
  const connected = getConnectedOrder(room);
  const giverId = getCurrentGiver(room);
  const guessers = connected.filter(id => id !== giverId);

  return guessers.every(id => room.round.guesses[id] !== undefined);
}

// Process reveal
function processReveal(room) {
  room.phase = 'reveal';

  const target = room.round.target;
  let giverScore = 0;

  // Calculate scores for each guesser
  for (const [playerId, guess] of Object.entries(room.round.guesses)) {
    const distance = Math.abs(guess - target);
    const points = calculateScore(distance);
    room.players[playerId].score += points;
    if (points > 0) giverScore++;
  }

  // Award clue-giver points
  const giverId = getCurrentGiver(room);
  if (giverId && room.players[giverId]) {
    room.players[giverId].score += giverScore;
  }
  room.round.giverScore = giverScore;

  broadcastState(room);
}

// Move to next turn
function nextTurn(room) {
  const connected = getConnectedOrder(room);
  room.turnIndex = (room.turnIndex + 1) % connected.length;
  room.turnNumber++;

  // Check if round completed (everyone has been clue-giver)
  if (room.turnNumber % connected.length === 0) {
    room.roundNumber++;
  }

  // Check if game over
  if (room.roundNumber > room.roundsTarget) {
    room.phase = 'gameover';
    broadcastState(room);
    return;
  }

  startTurn(room);
}

// Garbage collection for empty rooms
function scheduleCleanup(roomCode) {
  setTimeout(() => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const hasConnected = Object.values(room.players).some(p => p.connected);
    if (!hasConnected) {
      rooms.delete(roomCode);
    }
  }, 60000);
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let playerName = null;

  socket.on('createRoom', (name, callback) => {
    const code = generateRoomCode();
    const room = {
      code,
      hostId: socket.id,
      phase: 'lobby',
      players: {
        [socket.id]: { id: socket.id, name, connected: true, score: 0 }
      },
      order: [socket.id],
      turnIndex: 0,
      turnNumber: 0,
      roundNumber: 1,
      roundsTarget: 1,
      spectrum: null,
      round: null,
      messages: []
    };

    rooms.set(code, room);
    socket.join(code);
    currentRoom = code;
    playerName = name;

    callback({ success: true, code });
    broadcastState(room);
  });

  socket.on('joinRoom', (code, name, callback) => {
    const room = rooms.get(code.toUpperCase());

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    const connectedCount = Object.values(room.players).filter(p => p.connected).length;
    if (connectedCount >= 10) {
      callback({ success: false, error: 'Room is full (10 players max)' });
      return;
    }

    room.players[socket.id] = { id: socket.id, name, connected: true, score: 0 };
    room.order.push(socket.id);

    socket.join(code);
    currentRoom = code;
    playerName = name;

    callback({ success: true, code });

    // Send chat history to new joiner
    socket.emit('chatHistory', room.messages.slice(-100));

    broadcastState(room);
  });

  socket.on('rejoinRoom', (code, name, callback) => {
    const room = rooms.get(code.toUpperCase());

    if (!room) {
      callback({ success: false, error: 'Room not found' });
      return;
    }

    // Find existing player by name
    let existingPlayerId = null;
    for (const [playerId, player] of Object.entries(room.players)) {
      if (player.name === name) {
        existingPlayerId = playerId;
        break;
      }
    }

    if (existingPlayerId) {
      // Update existing player with new socket ID
      const player = room.players[existingPlayerId];
      delete room.players[existingPlayerId];
      room.players[socket.id] = {
        ...player,
        id: socket.id,
        connected: true
      };

      // Update order array
      const orderIndex = room.order.indexOf(existingPlayerId);
      if (orderIndex !== -1) {
        room.order[orderIndex] = socket.id;
      }

      // Update host if needed
      if (room.hostId === existingPlayerId) {
        room.hostId = socket.id;
      }
    } else {
      // Player not found, add as new player
      room.players[socket.id] = { id: socket.id, name, connected: true, score: 0 };
      room.order.push(socket.id);
    }

    socket.join(code);
    currentRoom = code;
    playerName = name;

    callback({ success: true, code });

    // Send chat history
    socket.emit('chatHistory', room.messages.slice(-100));

    broadcastState(room);
  });

  socket.on('startGame', (options) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || socket.id !== room.hostId) return;

    const connected = getConnectedOrder(room);
    if (connected.length < 2) return;

    // Handle both old format (just rounds number) and new format (object)
    const rounds = typeof options === 'object' ? options.rounds : options;
    const timerDuration = typeof options === 'object' ? options.timerDuration : 0;

    room.roundsTarget = Math.max(1, Math.min(5, parseInt(rounds) || 1));
    room.timerDuration = Math.max(0, Math.min(300, parseInt(timerDuration) || 0));
    room.roundNumber = 1;
    room.turnIndex = 0;
    room.turnNumber = 0;

    // Reset scores
    for (const player of Object.values(room.players)) {
      player.score = 0;
    }

    startTurn(room);
  });

  socket.on('submitRound', ({ leftLabel, rightLabel, hint }) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.phase !== 'compose') return;

    const giverId = getCurrentGiver(room);
    if (socket.id !== giverId) return;

    // Update spectrum if provided
    if (leftLabel && rightLabel) {
      room.spectrum = { leftLabel, rightLabel };
    }

    // Require spectrum to be set
    if (!room.spectrum) return;

    room.round.hint = hint?.trim() || '';
    room.phase = 'guess';
    room.timerStartedAt = null; // Clear timer when hint is submitted

    broadcastState(room);
  });

  socket.on('lockGuess', (value) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.phase !== 'guess') return;

    const giverId = getCurrentGiver(room);
    if (socket.id === giverId) return; // Clue-giver can't guess

    // Validate and clamp value
    const guess = Math.max(1, Math.min(20, Math.round(parseInt(value) || 10)));
    room.round.guesses[socket.id] = guess;

    broadcastState(room);

    // Check if all guesses in
    if (checkAllGuessesIn(room)) {
      processReveal(room);
    }
  });

  socket.on('changeSpectrum', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const giverId = getCurrentGiver(room);
    if (socket.id !== giverId) return;

    room.spectrum = null;

    // If in compose phase, stay there so they can set new spectrum
    // If in reveal phase, the next turn will need to set spectrum

    broadcastState(room);
  });

  socket.on('nextTurn', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || room.phase !== 'reveal') return;

    nextTurn(room);
  });

  socket.on('newGame', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    room.phase = 'lobby';
    room.spectrum = null;
    room.round = null;
    room.turnIndex = 0;
    room.turnNumber = 0;
    room.roundNumber = 1;

    // Reset scores
    for (const player of Object.values(room.players)) {
      player.score = 0;
    }

    broadcastState(room);
  });

  socket.on('chat', (text) => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room || !playerName) return;

    // Validate message
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    const message = {
      id: Date.now() + '-' + socket.id,
      senderId: socket.id,
      senderName: playerName,
      text: trimmed.slice(0, 500),
      timestamp: Date.now()
    };

    room.messages.push(message);

    // Cap at 1000 messages
    if (room.messages.length > 1000) {
      room.messages = room.messages.slice(-1000);
    }

    io.to(currentRoom).emit('chatMessage', message);
  });

  socket.on('disconnect', () => {
    if (!currentRoom) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const player = room.players[socket.id];
    if (player) {
      player.connected = false;
    }

    // Reassign host if needed
    if (socket.id === room.hostId) {
      const connected = getConnectedOrder(room);
      if (connected.length > 0) {
        room.hostId = connected[0];
      }
    }

    // If clue-giver disconnects mid-turn, fall back to lobby
    const giverId = getCurrentGiver(room);
    if (socket.id === giverId && (room.phase === 'compose' || room.phase === 'guess')) {
      room.phase = 'lobby';
      room.round = null;
    }

    // Check if all guesses in after disconnect
    if (room.phase === 'guess' && checkAllGuessesIn(room)) {
      processReveal(room);
    }

    broadcastState(room);
    scheduleCleanup(currentRoom);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Wavelength server running on port ${PORT}`);
});

module.exports = { server, io, rooms };
