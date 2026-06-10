# Product Requirements Document: Wavelength (Multiplayer)

**Status:** Built — playable MVP, verified by automated tests
**Last updated:** June 9, 2026
**Type:** Real-time multiplayer web party game

---

## 1. Overview

Wavelength is a real-time, browser-based multiplayer party game inspired by the
tabletop game *Wavelength* and structured like skribbl.io. Players take turns as
the **clue-giver**. On your turn a spectrum is in play (e.g. *Cold ⟷ Hot*), you
secretly see a random target number from **1 to 20**, and you give a short text
hint that fits that spot on the spectrum. Everyone else reads the spectrum and
hint and guesses the number with a slider. Guesses score by how close they land;
the clue-giver scores for getting people close. After a fixed number of rounds,
the highest individual score wins.

The game runs over a persistent WebSocket connection so players can join from
their own phones or laptops, or pass a single device around. A live chat sidebar
runs alongside play the whole time.

This document describes the game **as built**. Section 12 records how it evolved
from the original concept (an AI-rated, single-player slider game).

---

## 2. Goals

1. Let a group define their own spectrums (written freehand or picked from presets).
2. Run a fast, turn-based guessing loop where the fun is reading the hint-giver's mind.
3. Reward both accurate guessing and clear hint-giving through individual scoring.
4. Support 2–10 players in real time across devices, with no accounts and no database.
5. Keep the hidden target genuinely hidden (no client-side peeking).
6. Be deployable as a single Node process with no build step.

## 3. Non-Goals

- User accounts, authentication, or persistent cross-session history.
- A database; all state is in memory per server instance.
- AI-generated content (removed during development — see §12).
- Teams (removed in favor of individual scoring).
- Voice/video chat, public leaderboards, content moderation dashboards.
- Multi-instance horizontal scaling (would require a shared store — see §10).

---

## 4. Target Users

Casual social groups who want a quick, replayable guessing game: friends online or
in person, students, Discord groups, and fans of Wavelength, Jackbox, or skribbl.io.
Plays well from 2 players (head-to-head) up to a full party of 10.

---

## 5. Core Gameplay Loop

1. A player **creates a game** and receives a 4-letter room code.
2. Friends **join** with the code (up to 10 players total).
3. The host picks the **number of rounds** (1–5 in the UI; one round = every player
   clue-gives once) and starts.
4. The **clue-giver** for the turn sets the spectrum — pick a **preset category**
   or write two custom ends — and secretly sees a random **1–20** target.
5. The clue-giver writes a **hint** (no numbers) and sends it.
6. Every other player reads the spectrum + hint and **locks a guess** (1–20).
7. When all guessers have locked, the round **reveals**: the target, each guess,
   distance, points earned, the clue-giver's points, and updated **standings**.
8. **Next turn** passes the clue-giver role to the next player (round-robin).
9. After the final round, a **winner screen** shows the final leaderboard.
   **Play again** resets scores and returns to the lobby.

---

## 6. Detailed Requirements

### 6.1 Lobby & Setup

- Create game → 4-letter room code (unambiguous alphabet, no 0/O/1/I).
- Join via code; rejected if the room is full (**10-player cap**) or not found.
- Players list shows everyone, host marked, disconnected players dimmed.
- Host selects number of rounds (1–5). Start is disabled until ≥2 players.
- Any player can copy the room code by clicking it.

### 6.2 The Spectrum (persistent, written or preset)

- A spectrum is two opposing ends (left/right labels), e.g. *Cold ⟷ Hot*.
- On a **setup turn** (game start, or after a change) the clue-giver either:
  - taps a **preset category** chip (quick-fills both ends; editable), or
  - types custom left and right ends.
- Once set, the spectrum **persists across turns and players** until changed.
- The spectrum is public to all players once submitted; it is shown read-only to
  the clue-giver on normal turns.

### 6.3 Changing the Spectrum

- The **current clue-giver** can change the spectrum:
  - **mid-compose** ("Stuck? Change category") — clears it and lets them rewrite
    or re-pick a preset on the same turn, or
  - **at reveal** ("Change spectrum") — clears it so the **next** clue-giver writes
    a fresh one.
- Guessers cannot change the spectrum.

### 6.4 The Hidden Target

- Each turn the server rolls a uniform random integer **1–20**.
- The target is sent **only to the clue-giver** during compose/guess, and to
  everyone at reveal. Guessers never receive it over the wire (anti-cheat, §9).

### 6.5 Guessing

- Guessers see the spectrum, the hint, and a **1–20 slider** (whole-number steps,
  default 10) with tick marks.
- Each guesser locks one guess. The clue-giver does not guess.
- When all connected guessers have locked, the turn auto-reveals.

### 6.6 Reveal

Shows: the hint, the spectrum, a track with the **target marker** and every
player's **guess marker**, the clue-giver's earned points, a per-guesser results
table (guess, distance, points), and the live **standings** leaderboard.

### 6.7 Scoring (individual — no teams)

**Guessers**, by absolute distance from the target:

| Off by | Points |
|--------|--------|
| 0 (exact) | 4 |
| 1 | 3 |
| 2 | 2 |
| 3 | 1 |
| 4+ | 0 |

**Clue-giver:** **+1 for every guesser who scored** that turn (i.e. landed within
3). If two people guessed close, the clue-giver earns +2. This rewards a hint
clear enough to land but not a giveaway.

Each player has a running individual total, displayed in the standings and in the
top bar ("You: N").

### 6.8 Rounds & End of Game

- One **round** = every connected player has been clue-giver once.
- After the configured number of rounds, the game enters a **gameover** phase with
  a final leaderboard and a winner banner. **Play again** resets all scores and the
  spectrum and returns to the lobby.

### 6.9 Chat

- A live chat sidebar (right column on desktop, stacked below on mobile) is
  available the entire time a player is in a room, in every phase.
- Chat uses **dedicated socket events** (`chatMessage` / `chatHistory`), separate
  from game-state broadcasts, so history is not re-sent on every game update.
- Backlog up to **1000 messages**; up to **500 characters** per message. New
  joiners receive the recent history once on join.
- Own messages are highlighted; the view auto-scrolls unless the reader has
  scrolled up.

### 6.10 Fireworks

- A full-screen canvas fireworks animation fires on any **exact guess** (0 off),
  once per turn, and again on the **winner screen**. Scales to screen size.

---

## 7. Screens

| Screen | Contents |
|--------|----------|
| **Home** | Name input, Create game, Join by code |
| **Lobby** | Room code, players list, rounds selector (host), Start |
| **Compose** | Clue-giver: spectrum (preset chips + custom inputs, or read-only) + secret target + hint input + "Change category"; others: waiting state |
| **Guess** | Guesser: hint bubble + 1–20 slider + Lock; clue-giver/locked: waiting with progress |
| **Reveal** | Target + guess markers, clue-giver points, results table, standings, Next turn / Change spectrum / End game |
| **Game over** | Winner banner, final leaderboard, Play again |
| **Chat** (persistent sidebar) | Message list + input, present from lobby onward |

---

## 8. Architecture

- **Frontend:** static HTML/CSS/vanilla JS (no build step). Two-column responsive
  layout. Socket.IO client.
- **Backend:** Node.js + Express serving the static frontend, with **Socket.IO**
  for real-time rooms.
- **State:** in-memory per room (`Map` of rooms). No database.
- **Single deployable unit:** one Node process serves both the app and the sockets.

### 8.1 Files

```
server.js          Express + Socket.IO server: rooms, round-robin, scoring (target hidden here)
public/index.html  All screens + chat sidebar
public/styles.css  Styling, two-column layout
public/app.js      Client: socket connection, rendering, fireworks
public/presets.js  Preset spectrum categories
test-e2e.js        Scripted 3-player game test (npm test)
test-chat.js       Dedicated chat test suite (npm run test:chat)
data/items.js      Deprecated/unused (legacy item bank); safe to delete
```

### 8.2 Data Model (server, per room)

```js
room = {
  code,                 // 4-letter room code
  hostId,               // socket id of host (reassigned if host leaves)
  phase,                // "lobby" | "compose" | "guess" | "reveal" | "gameover"
  players: {            // keyed by socket id
    [id]: { id, name, connected, score }
  },
  order: [],            // turn order (join order)
  turnIndex,            // index into connected players -> current clue-giver
  turnNumber,           // increments each turn
  roundNumber,          // current round (1..roundsTarget)
  roundsTarget,         // configured rounds
  spectrum,             // { leftLabel, rightLabel } | null (persists until changed)
  round: {              // current turn, or null
    hint, target,       // target sent only to clue-giver until reveal
    guesses: { [id]: number },
    giverScore
  },
  messages: []          // chat history (server-side; sent via chat events)
}
```

### 8.3 Socket Events

**Client → server:** `createRoom`, `joinRoom`, `startGame {rounds}`,
`submitRound {leftLabel?, rightLabel?, hint}`, `lockGuess {value}`,
`changeSpectrum`, `nextTurn`, `newGame`, `chat {text}`.

**Server → client:** `state` (tailored per viewer — only the clue-giver's payload
carries the target before reveal), `chatHistory` (full backlog, on join),
`chatMessage` (single new message).

---

## 9. Anti-Cheat

The server sends **each player a tailored state**. The hidden target is included
only in the clue-giver's payload during compose/guess, and in everyone's payload at
reveal. Spectrum ends are likewise withheld from guessers until the clue-giver
submits them on a setup turn. Guessers never receive the answer over the wire, so
it cannot be inspected through browser tools. Guess values are clamped/validated
server-side (1–20, integer).

---

## 10. Constraints & Known Limitations

- **In-memory, single instance.** All players in a game must hit the same server
  process. Horizontal scaling would require a shared store (e.g. a Socket.IO Redis
  adapter) for rooms and chat.
- **No persistence.** A server restart clears all rooms. Empty rooms are garbage-
  collected ~60s after the last player leaves.
- **Honor system on hints.** Numbers-in-hints are discouraged in UI copy but not
  enforced (as in tabletop Wavelength).
- **Round counting** keys off the turn order wrapping; mid-game joins/leaves are
  handled gracefully but make round boundaries approximate.

---

## 11. Error & Edge Handling

- Join rejected with a clear message if the room is missing or full (10 max).
- Start blocked below 2 players.
- Host reassigned automatically if the host disconnects.
- If the clue-giver disconnects mid-turn, the room falls back to the lobby.
- Disconnected players are shown dimmed and excluded from turn rotation / reveal.
- Empty/whitespace chat messages are dropped; messages trimmed and capped at 500 chars.

---

## 12. Evolution from the Original Concept

The product changed substantially during development. Recorded here for context:

1. **AI-rated slider (original):** AI generated an item and a hidden 0–100 rating;
   a single player guessed. *(Built first, then replaced.)*
2. **Clue-giver / guesser turns:** one player saw the rating and gave a hint;
   another guessed; roles swapped.
3. **Player-written spectrums + 1–20 scale:** dropped the AI item bank entirely;
   players write their own spectrum and guess a random 1–20 target.
4. **Persistent spectrum:** the spectrum stays in play across turns until changed.
5. **Round-robin, individual scoring (skribbl-style):** removed teams; the
   clue-giver role rotates through everyone; per-player scores; clue-giver earns
   +1 per guesser who scored; fixed rounds end in a winner screen; preset
   categories added; spectrum changeable mid-turn.
6. **Polish:** chat moved to a right sidebar and refactored onto dedicated events
   with raised limits (1000 messages / 500 chars); 10-player cap; fireworks on
   exact guesses.

---

## 13. Testing

Automated tests run against a live server instance.

- **`npm test` (test-e2e.js):** a full 3-player, 1-round game. Verifies the
  10-player cap, target hidden from all guessers, persistent spectrum, mid-compose
  spectrum change, guesser + clue-giver scoring, round-robin rotation, gameover
  after the set rounds, final standings totals, and play-again reset.
- **`npm run test:chat` (test-chat.js):** 10 chat scenarios — broadcast/identity,
  consistent global ordering, per-sender ordering, history on join, empty/whitespace
  handling, 500-char truncation, 1000-message history cap, cross-phase delivery,
  separation from game state, special-character passthrough, non-member safety, and
  concurrent senders.

All tests pass.

---

## 14. Deployment

Single Node process; reads `process.env.PORT`. No build step, no database.

- **Recommended:** Render / Railway / Fly.io / Heroku (persistent Node process with
  WebSocket support). Build `npm install`, start `npm start`.
- **Local:** `npm install && npm start`, open `http://localhost:3000`, use multiple
  tabs or share the LAN IP for multiplayer.
- **Vercel note:** not suitable as-is — its serverless model doesn't hold persistent
  WebSocket connections or in-memory rooms. Would require moving the real-time layer
  to a managed service (e.g. PartyKit / Ably / Pusher).

---

## 15. Success Criteria

1. 2–10 players can join a room and play in real time. ✅
2. Players define spectrums (preset or custom) that persist until changed. ✅
3. The clue-giver mechanic works with a genuinely hidden target. ✅
4. Individual scoring (guessers + clue-giver) is correct and visible. ✅
5. Games run a fixed number of rounds and end with a clear winner. ✅
6. Chat is reliable across all phases and tested in isolation. ✅
7. Deployable as a single process to a WebSocket-capable host. ✅

---

## 16. Future Enhancements

- Enforce/no-number hint validation; turn timers; re-roll the target.
- Round/turn history and per-player accuracy stats.
- Shareable results; emoji reactions in chat; typing indicators.
- Custom user-saved preset categories.
- Multi-instance scaling via a Socket.IO Redis adapter.
- Spectator mode; rejoin-by-name after disconnect.
