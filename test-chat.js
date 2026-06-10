/**
 * Chat system tests for Wavelength
 */

const { io } = require('socket.io-client');

const SERVER_URL = process.env.TEST_URL || 'http://localhost:3000';

function createClient(name) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true
    });

    const messages = [];
    let chatHistory = [];

    socket.on('connect', () => {
      resolve({ socket, name, messages, getHistory: () => chatHistory });
    });

    socket.on('chatMessage', (msg) => {
      messages.push(msg);
    });

    socket.on('chatHistory', (history) => {
      chatHistory = history;
    });

    socket.on('connect_error', reject);

    setTimeout(() => reject(new Error('Connection timeout')), 5000);
  });
}

async function test() {
  console.log('Starting Wavelength Chat tests...\n');

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
    // Create clients
    console.log('Creating clients...');
    const [host, player2] = await Promise.all([
      createClient('Host'),
      createClient('Player2')
    ]);

    // Create room
    console.log('\n1. Setting up room...');
    const createResult = await new Promise((resolve) => {
      host.socket.emit('createRoom', 'Host', resolve);
    });
    const roomCode = createResult.code;

    await new Promise((resolve) => {
      player2.socket.emit('joinRoom', roomCode, 'Player2', resolve);
    });
    await new Promise(r => setTimeout(r, 100));

    // Test 1: Basic message broadcast
    console.log('\n2. Testing basic message broadcast...');
    host.socket.emit('chat', 'Hello everyone!');
    await new Promise(r => setTimeout(r, 100));

    assert(host.messages.length === 1, 'Host receives own message');
    assert(player2.messages.length === 1, 'Player2 receives message');
    assert(host.messages[0].text === 'Hello everyone!', 'Message text correct');
    assert(host.messages[0].senderName === 'Host', 'Sender name correct');

    // Test 2: Message identity
    console.log('\n3. Testing message identity...');
    assert(host.messages[0].senderId === host.socket.id, 'Sender ID matches socket ID');

    // Test 3: Message ordering
    console.log('\n4. Testing message ordering...');
    host.socket.emit('chat', 'Message 1');
    host.socket.emit('chat', 'Message 2');
    host.socket.emit('chat', 'Message 3');
    await new Promise(r => setTimeout(r, 100));

    const hostMsgs = host.messages.slice(-3);
    assert(hostMsgs[0].text === 'Message 1', 'First message in order');
    assert(hostMsgs[1].text === 'Message 2', 'Second message in order');
    assert(hostMsgs[2].text === 'Message 3', 'Third message in order');

    // Test 4: Empty message handling
    console.log('\n5. Testing empty message handling...');
    const countBefore = host.messages.length;
    host.socket.emit('chat', '');
    host.socket.emit('chat', '   ');
    await new Promise(r => setTimeout(r, 100));
    assert(host.messages.length === countBefore, 'Empty messages not sent');

    // Test 5: Message truncation
    console.log('\n6. Testing message truncation (500 chars)...');
    const longMessage = 'a'.repeat(600);
    host.socket.emit('chat', longMessage);
    await new Promise(r => setTimeout(r, 100));

    const lastMsg = host.messages[host.messages.length - 1];
    assert(lastMsg.text.length === 500, 'Message truncated to 500 chars');

    // Test 6: Special characters
    console.log('\n7. Testing special characters...');
    const specialMsg = '<script>alert("xss")</script> & "quotes"';
    host.socket.emit('chat', specialMsg);
    await new Promise(r => setTimeout(r, 100));

    const specialReceived = host.messages[host.messages.length - 1];
    assert(specialReceived.text === specialMsg, 'Special characters preserved');

    // Test 7: History for new joiner
    console.log('\n8. Testing chat history for new joiner...');
    const player3 = await createClient('Player3');
    await new Promise((resolve) => {
      player3.socket.emit('joinRoom', roomCode, 'Player3', resolve);
    });
    await new Promise(r => setTimeout(r, 100));

    const history = player3.getHistory();
    assert(history.length > 0, 'New joiner receives chat history');

    // Test 8: Cross-phase delivery
    console.log('\n9. Testing cross-phase chat delivery...');
    host.socket.emit('startGame', 1);
    await new Promise(r => setTimeout(r, 100));

    const countBeforePhase = player2.messages.length;
    host.socket.emit('chat', 'Chat during game');
    await new Promise(r => setTimeout(r, 100));

    assert(player2.messages.length > countBeforePhase, 'Chat works during game phase');

    // Cleanup
    console.log('\n10. Cleaning up...');
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
