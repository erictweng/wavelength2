# UI/UX Documentation: Clock-Based Dial Interface

## 1. Design Concept and Rationale

The Wavelength dial interface draws inspiration from the physical Wavelength board game, reimagining its iconic dial as an interactive SVG-based semicircle. The design prioritizes:

- **Tactile familiarity**: The clock-hand metaphor makes guessing intuitive
- **Visual drama**: The reveal animation builds anticipation like uncovering the board game dial
- **Clean aesthetics**: Monochrome palette with red accent reduces visual noise
- **Mobile-first interaction**: Touch-friendly drag targets work on all devices

### Why Semicircle Over Linear Slider

1. **Spatial mapping**: A dial provides stronger visual anchoring for spectrum endpoints
2. **Reveal mechanics**: The sweeping cover animation isn't possible with a linear slider
3. **Game heritage**: Matches the physical Wavelength game's iconic design
4. **Differentiation**: Sets this digital version apart from simple slider implementations

---

## 2. Visual Specifications

### Color Palette (Soft Pastel Theme)

| Element | Color | Purpose |
|---------|-------|---------|
| Background | `#f8f6f4` | Warm, easy-on-eyes backdrop |
| Secondary bg | `#f0ebe5` | Subtle section distinction |
| Tertiary bg | `#e8e2db` | Cards and elevated surfaces |
| Dial arc | `#ddd6cf` | Subtle track for the hand |
| Dial arc stroke | `#c9c1b8` | Soft definition |
| Tick marks (major) | `#9a9493` | Clear value indicators |
| Tick marks (minor) | `#c9c1b8` | Subdivision markers |
| Cover/shield | `#5c5552` | Softer contrast for drama |
| Guess hand | `#e8a598` | Coral pastel accent - primary action |
| Target zone (4pts) | `#a8c5b8` | Sage green bullseye |
| Target zone (3pts) | `#bdd4c9` | Lighter sage ring |
| Target zone (2pts) | `#d1e3da` | Faded sage |
| Target zone (1pts) | `#e5f1eb` | Very light sage |
| Target zone (0pts) | `#f0ebe5` | Warm cream miss zone |
| Player markers | Pastel mix | Coral, sage, sky, lavender variants |
| Primary text | `#4a4543` | Comfortable readability |
| Secondary text | `#6b6563` | Supporting information |

**Accent Colors:**
- Coral (primary action): `#e8a598` / `#d4877a` (dark)
- Sage (success/target): `#a8c5b8` / `#8fb3a0` (dark)
- Lavender: `#c4b7d4`
- Sky: `#a8c4d4`
- Peach: `#f0d5c8`

### Dimensions

```
SVG ViewBox: 0 0 400 240
Dial Radius: 160px
Center Point: (200, 200)
Arc Stroke Width: 40px
Hand Stroke Width: 6px
Tick Mark Length: 40px (major), 20px (minor)
```

### Typography

- Font family: System stack (-apple-system, BlinkMacSystemFont, Segoe UI, etc.)
- Value display: 24px bold
- Tick labels: 12px regular
- Spectrum labels: 14px semibold

---

## 3. Interaction Patterns

### Guessing Phase

1. **Initial state**: Dial shows with cover hiding target zone
2. **Hand position**: Red clock hand starts at value 10 (top center)
3. **Dragging**:
   - Touch/click anywhere on SVG initiates drag
   - Hand follows cursor/finger position around the arc
   - Movement is constrained to the semicircle (0-180 degrees)
   - Value updates in real-time (displayed in center)
4. **Snapping**: Hand snaps to integer positions (1-20)
5. **Lock**: User confirms guess with "Lock Guess" button

### Drag Mechanics

```javascript
// Angle calculation from cursor position
angle = atan2(centerY - cursorY, cursorX - centerX)
// Clamped to semicircle: 0 (right) to PI (left)
angle = clamp(angle, 0, PI)
// Convert to value: 1 (left) to 20 (right)
value = round(1 + 19 * (1 - angle/PI))
```

### Touch Considerations

- Hit area extends 20px beyond visual hand
- Touch events prevent default scrolling on dial
- 44px minimum tap target for lock button
- Visual feedback on touch (hand glow intensifies)

---

## 4. Animation Specifications

### Home Screen Animation (Staggered fade-up)

On page load, home screen elements animate in with staggered timing:

1. **Title** (0-0.8s): "Wavelength" fades up from bottom
2. **Subtitle** (0.3-1.1s): "A multiplayer guessing game" follows
3. **Name input** (0.6-1.4s): Input field animates in
4. **Buttons** (0.9-1.7s): Create/Join buttons appear last

Elements use the `.animate-in` class with delay modifiers:

```css
.animate-in { animation: elementFadeUp 0.8s ease-out forwards; }
.animate-in.delay-1 { animation-delay: 0.3s; }
.animate-in.delay-2 { animation-delay: 0.6s; }
.animate-in.delay-3 { animation-delay: 0.9s; }
```

### Screen Transitions

**Home to Lobby (Slide):**
- Home screen slides out to the left
- Lobby slides in from the right
- Duration: 0.5 seconds

**Lobby to Game (Fade + Pop):**
- Lobby fades out with slight scale-down
- Game screen pops in with slight overshoot
- Duration: 0.3-0.4 seconds

**Between Game Screens (Fade + Pop):**
- Current screen fades out
- Next screen pops in
- Maintains flow continuity

### Reveal Sequence (1.5 seconds)

```
Timeline:
0ms     - Reveal lever appears at 3 o'clock (angle 0)
0-1500ms - Lever sweeps counterclockwise (0 to PI)
         - Cover recedes following lever position
         - Target zone fades in (opacity 0 to 1)
1500ms  - Lever disappears
1700ms  - Player markers animate in (staggered)
```

### Easing Functions

- Lever sweep: `cubic-bezier(0.25, 0.1, 0.25, 1)` (ease-out)
- Cover recession: Linear, following lever
- Target zone fade: Linear with lever progress
- Marker appearance: `ease-out` individual animations

### CSS Animation Classes

```css
.reveal-active .dial-cover {
  transition: opacity 0.3s ease-out;
}

.player-marker {
  animation: markerPop 0.3s ease-out forwards;
}

@keyframes markerPop {
  0% { transform: scale(0); opacity: 0; }
  70% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}
```

### Fireworks

Triggered on:
1. Any exact guess (distance = 0)
2. Game over (winner celebration)

Implementation: Canvas-based particle system
- 5 sequential bursts with 200ms delay
- 50 particles per burst
- Colors: red, teal, gold, pink, blue
- Gravity simulation for natural fall-off
- 1 second total animation duration

---

## 5. Accessibility Considerations

### Keyboard Navigation

- Tab to focus dial (outline visible)
- Arrow keys to adjust value (Left/Down: -1, Right/Up: +1)
- Enter to lock guess

### Screen Reader Support

```html
<svg role="slider"
     aria-label="Guess selector dial"
     aria-valuemin="1"
     aria-valuemax="20"
     aria-valuenow="10"
     aria-valuetext="Current guess: 10">
```

### Visual Accessibility

- Color contrast ratios meet WCAG AA
- Red accent used for action, not status (colorblind-safe)
- Target zones use multiple visual cues (color + rings + position)
- Text labels always present (not color-only information)

### Motion Sensitivity

- Reveal animation respects `prefers-reduced-motion`
- With reduced motion: instant reveal, no sweep
- Fireworks disabled when reduced motion preferred

```css
@media (prefers-reduced-motion: reduce) {
  .dial-cover { transition: none; }
  .reveal-lever { display: none; }
}
```

---

## 6. Component Architecture

### Dial Component (dial.js)

```javascript
class WavelengthDial {
  constructor(container, options)

  // Core methods
  setValue(value)
  getValue()
  setTarget(target)
  setGuesses(guessesMap)

  // Interaction
  setInteractive(boolean)
  onChange(callback)

  // Display modes
  setCoverVisible(boolean)
  showGuessHand()
  hideGuessHand()
  showTargetPreview(target)  // For clue-giver

  // Animation
  reveal(target, guesses, duration)  // Returns Promise
  reset()
}
```

### State Management

Three dial instances are maintained:
1. `composeDial` - Shows target to clue-giver (non-interactive)
2. `guessDial` - Interactive guessing dial
3. `revealDial` - Animated reveal with results

---

## 7. Reference Mockups

### Guessing State

```
         1       5        10       15       20
          \      |        |        |       /
           \     |        |        |      /
            `.   |        |        |   .-'
              `. |        |        | .'
                `|        |        |'
        Cold ----+--------+--------+---- Hot
                 |`.      |      .'|
                 |  `.    |    .'  |
                 |    `.  |  .'    |
                 |      `.|.'      |
                 |        X        |  <- Red hand
                 |        |        |
                 +--------+--------+
                      [ 10 ]

            [=== Lock Guess ===]
```

### Revealed State

```
         1       5        10       15       20
          \      |        |        |       /
           \  [target zone: 12-16] |      /
            `.   |   #####|#####   |   .-'
              `. |  ######|######  | .'
                `| #######|####### |'
        Cold ----+--o--o--X--o-----+---- Hot
                 |   Ana  |  You   |
                 |   Bob  |  target|
                 |        |  = 14  |
                 +--------+--------+

    Ana: 11 (off by 3) +1pt
    You: 15 (off by 1) +3pt
    Bob: 12 (off by 2) +2pt
```

### Scoring Zones Visual

```
    4pts |  3pts  |  2pts  |  1pts  |  0pts
         |        |        |        |
    [====[====[====[====[====[====[====[====]
         ^        ^        ^        ^
      exact    off-1    off-2    off-3

    Color gradient: teal -> light teal -> white
```

---

## 8. Implementation Files

| File | Purpose |
|------|---------|
| `public/dial.js` | WavelengthDial class with SVG rendering and interaction |
| `public/styles.css` | Dial styles, colors, animations |
| `public/app.js` | Dial instantiation, game flow integration |
| `public/index.html` | Container elements for each dial instance |

---

## 9. Testing Checklist

### Interaction Testing

- [ ] Drag gesture works on desktop (mouse)
- [ ] Drag gesture works on mobile (touch)
- [ ] Value updates in real-time during drag
- [ ] Hand snaps to integer values
- [ ] Lock button disables after lock
- [ ] Cannot interact when locked

### Animation Testing

- [ ] Reveal animation plays smoothly (60fps)
- [ ] Lever sweeps full arc in ~1.5s
- [ ] Cover recedes following lever
- [ ] Target zone fades in correctly
- [ ] Player markers appear after reveal
- [ ] Animation doesn't replay on re-render

### Visual Testing

- [ ] Dial scales correctly on different screen sizes
- [ ] Labels remain readable at small sizes
- [ ] Colors match specification
- [ ] Tick marks align with values
- [ ] Player markers don't overlap severely

### Accessibility Testing

- [ ] Keyboard navigation works
- [ ] Screen reader announces value changes
- [ ] Reduced motion disables animations
- [ ] Focus indicators visible
