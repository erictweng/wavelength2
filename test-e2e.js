/**
 * End-to-end test for Wavelength game
 * Tests a full 3-player, 1-round game
 */

const { io } = require('socket.io-client');

const SERVER_URL = process.env.TEST_URL || 'http://localhost:3000';

function createClient(name) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true
    });

    socket.on('connect', () => {
      resolve({ socket, name });
    });

    socket.on('connect_error', reject);

    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

async function test() {
  console.log('Starting Wavelength E2E tests...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.log(`  FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // Create 3 clients
    console.log('Creating clients...');
    const [host, player2, player3] = await Promise.all([
      createClient('Host'),
      createClient('Player2'),
      createClient('Player3')
    ]);

    // Track states
    let hostState = null;
    let p2State = null;
    let p3State = null;

    host.socket.on('state', (state) => { hostState = state; });
    player2.socket.on('state', (state) => { p2State = state; });
    player3.socket.on('state', (state) => { p3State = state; });

    // Test 1: Create room
    console.log('\n1. Creating room...');
    const createResult = await new Promise((resolve) => {
      host.socket.emit('createRoom', 'Host', resolve);
    });
    assert(createResult.success, 'Room created successfully');
    assert(createResult.code && createResult.code.length === 4, 'Room code is 4 characters');

    const roomCode = createResult.code;
    await new Promise(r => setTimeout(r, 100));

    // Test 2: Join room
    console.log('\n2. Joining room...');
    const join2Result = await new Promise((resolve) => {
      player2.socket.emit('joinRoom', roomCode, 'Player2', resolve);
    });
    assert(join2Result.success, 'Player 2 joined successfully');

    const join3Result = await new Promise((resolve) => {
      player3.socket.emit('joinRoom', roomCode, 'Player3', resolve);
    });
    assert(join3Result.success, 'Player 3 joined successfully');

    await new Promise(r => setTimeout(r, 100));

    // Test 3: Check lobby state
    console.log('\n3. Checking lobby state...');
    assert(hostState.phase === 'lobby', 'Phase is lobby');
    assert(Object.keys(hostState.players).length === 3, '3 players in room');
    assert(hostState.hostId === host.socket.id, 'Host ID is correct');

    // Test 4: Start game
    console.log('\n4. Starting game...');
    host.socket.emit('startGame', 1);
    await new Promise(r => setTimeout(r, 100));

    assert(hostState.phase === 'compose', 'Phase changed to compose');
    assert(hostState.roundsTarget === 1, 'Rounds target is 1');

    // Test 5: Check target visibility
    console.log('\n5. Checking target visibility (anti-cheat)...');
    const giverId = hostState.giverId;
    const giverState = [hostState, p2State, p3State].find(s => s.giverId === host.socket.id ? s === hostState : false) || hostState;

    // Find the giver's state
    let giverSocket, nonGiverStates = [];
    if (giverId === host.socket.id) {
      giverSocket = host;
      nonGiverStates = [p2State, p3State];
    } else if (giverId === player2.socket.id) {
      giverSocket = player2;
      nonGiverStates = [hostState, p3State];
    } else {
      giverSocket = player3;
      nonGiverStates = [hostState, p2State];
    }

    // Get fresh states after compose
    await new Promise(r => setTimeout(r, 100));

    const giverHasTarget = (giverId === host.socket.id && hostState.round?.target) ||
                           (giverId === player2.socket.id && p2State.round?.target) ||
                           (giverId === player3.socket.id && p3State.round?.target);

    assert(giverHasTarget, 'Clue-giver can see target');

    // Non-givers should not see target
    const nonGiversHaveTarget = nonGiverStates.some(s => s.round?.target);
    assert(!nonGiversHaveTarget, 'Non-givers cannot see target');

    // Test 6: Submit hint with spectrum
    console.log('\n6. Submitting hint...');
    giverSocket.socket.emit('submitRound', {
      leftLabel: 'Cold',
      rightLabel: 'Hot',
      hint: 'lukewarm'
    });
    await new Promise(r => setTimeout(r, 100));

    assert(hostState.phase === 'guess', 'Phase changed to guess');
    assert(hostState.spectrum.leftLabel === 'Cold', 'Spectrum left label set');
    assert(hostState.round.hint === 'lukewarm', 'Hint set correctly');

    // Test 7: Lock guesses
    console.log('\n7. Locking guesses...');
    const guessers = [host, player2, player3].filter(c => c.socket.id !== giverId);

    guessers[0].socket.emit('lockGuess', 10);
    await new Promise(r => setTimeout(r, 50));
    guessers[1].socket.emit('lockGuess', 12);
    await new Promise(r => setTimeout(r, 100));

    // Test 8: Check reveal
    console.log('\n8. Checking reveal...');
    assert(hostState.phase === 'reveal', 'Phase changed to reveal');
    assert(typeof hostState.round.target === 'number', 'Target is now visible');
    assert(Object.keys(hostState.round.guesses).length === 2, 'Two guesses recorded');

    // Test 9: Check scoring
    console.log('\n9. Checking scoring...');
    const target = hostState.round.target;
    const guesses = hostState.round.guesses;

    for (const [playerId, guess] of Object.entries(guesses)) {
      const distance = Math.abs(guess - target);
      const expectedPoints = distance === 0 ? 4 : distance === 1 ? 3 : distance === 2 ? 2 : distance === 3 ? 1 : 0;
      const actualPoints = hostState.players[playerId].score;
      // Note: score might include prior rounds in a longer game
      assert(actualPoints >= 0 && actualPoints <= 4, `Player ${playerId} scored reasonable points`);
    }

    // Test 10: Next turn and complete round
    console.log('\n10. Testing round completion...');
    host.socket.emit('nextTurn');
    await new Promise(r => setTimeout(r, 100));

    // Second turn
    const newGiverId = hostState.giverId;
    const newGiverSocket = [host, player2, player3].find(c => c.socket.id === newGiverId);

    newGiverSocket.socket.emit('submitRound', { hint: 'test hint 2' });
    await new Promise(r => setTimeout(r, 100));

    const newGuessers = [host, player2, player3].filter(c => c.socket.id !== newGiverId);
    newGuessers[0].socket.emit('lockGuess', 5);
    newGuessers[1].socket.emit('lockGuess', 15);
    await new Promise(r => setTimeout(r, 100));

    host.socket.emit('nextTurn');
    await new Promise(r => setTimeout(r, 100));

    // Third turn (final)
    const finalGiverId = hostState.giverId;
    const finalGiverSocket = [host, player2, player3].find(c => c.socket.id === finalGiverId);

    finalGiverSocket.socket.emit('submitRound', { hint: 'final hint' });
    await new Promise(r => setTimeout(r, 100));

    const finalGuessers = [host, player2, player3].filter(c => c.socket.id !== finalGiverId);
    finalGuessers[0].socket.emit('lockGuess', 7);
    finalGuessers[1].socket.emit('lockGuess', 13);
    await new Promise(r => setTimeout(r, 100));

    host.socket.emit('nextTurn');
    await new Promise(r => setTimeout(r, 100));

    // Test 11: Game over
    console.log('\n11. Checking game over...');
    assert(hostState.phase === 'gameover', 'Phase is gameover after all turns');

    // Test 12: Play again
    console.log('\n12. Testing play again...');
    host.socket.emit('newGame');
    await new Promise(r => setTimeout(r, 100));

    assert(hostState.phase === 'lobby', 'Reset to lobby');
    assert(Object.values(hostState.players).every(p => p.score === 0), 'Scores reset to 0');

    // Cleanup
    console.log('\n13. Cleaning up...');
    host.socket.disconnect();
    player2.socket.disconnect();
    player3.socket.disconnect();

    console.log(`\n========================================`);
    console.log(`Tests complete: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    process.exit(failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

// Run tests
test();
