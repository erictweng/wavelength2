/**
 * Wavelength Dial Component
 * SVG-based semicircle dial with drag interaction and reveal animation
 */

class WavelengthDial {
  constructor(container, options = {}) {
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    this.options = {
      width: 400,
      height: 240,
      radius: 160,
      centerX: 200,
      centerY: 200,
      minValue: 1,
      maxValue: 20,
      interactive: false,
      showTarget: false,
      showCover: true,
      ...options
    };

    this.value = 10;
    this.target = null;
    this.guesses = {};
    this.isRevealing = false;
    this.revealProgress = 0;
    this.onChangeCallback = null;

    this.colors = {
      background: '#f8f6f4',
      dialArc: '#ddd6cf',
      dialArcStroke: '#c9c1b8',
      tickMark: '#9a9493',
      tickMarkMinor: '#c9c1b8',
      cover: '#5c5552',
      guessHand: '#e8a598',
      guessHandGlow: 'rgba(232, 165, 152, 0.3)',
      targetZone4: '#a8c5b8',
      targetZone3: '#bdd4c9',
      targetZone2: '#d1e3da',
      targetZone1: '#e5f1eb',
      targetZone0: '#f0ebe5',
      playerMarker: '#6b6563',
      textPrimary: '#4a4543',
      textSecondary: '#6b6563'
    };

    this.svg = null;
    this.elements = {};

    this.init();
  }

  init() {
    this.createSVG();
    this.setupInteraction();
  }

  // Convert value (1-20) to angle in radians
  // 1 = 180° (left, 9 o'clock), 20 = 0° (right, 3 o'clock)
  valueToAngle(value) {
    const normalized = (value - this.options.minValue) / (this.options.maxValue - this.options.minValue);
    return Math.PI * (1 - normalized);
  }

  // Convert angle to value
  angleToValue(angle) {
    const normalized = 1 - (angle / Math.PI);
    return Math.round(normalized * (this.options.maxValue - this.options.minValue) + this.options.minValue);
  }

  // Get coordinates on arc from angle
  angleToCoords(angle, radius = this.options.radius) {
    return {
      x: this.options.centerX + radius * Math.cos(angle),
      y: this.options.centerY - radius * Math.sin(angle)
    };
  }

  // Create SVG arc path
  describeArc(startAngle, endAngle, radius = this.options.radius) {
    const start = this.angleToCoords(startAngle, radius);
    const end = this.angleToCoords(endAngle, radius);
    const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
    const sweepFlag = startAngle > endAngle ? 1 : 0;

    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
  }

  // Create SVG wedge path (arc + lines to center)
  describeWedge(startAngle, endAngle, radius = this.options.radius) {
    const start = this.angleToCoords(startAngle, radius);
    const end = this.angleToCoords(endAngle, radius);
    const largeArcFlag = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
    const sweepFlag = startAngle > endAngle ? 1 : 0;

    return `M ${this.options.centerX} ${this.options.centerY}
            L ${start.x} ${start.y}
            A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}
            Z`;
  }

  createSVG() {
    this.container.innerHTML = '';

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${this.options.width} ${this.options.height}`);
    this.svg.setAttribute('class', 'wavelength-dial');
    this.svg.style.width = '100%';
    this.svg.style.maxWidth = this.options.width + 'px';
    this.svg.style.height = 'auto';
    this.svg.style.touchAction = 'none';
    this.svg.style.userSelect = 'none';

    // Defs for gradients and filters
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Glow filter for guess hand
    const glowFilter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    glowFilter.setAttribute('id', 'glow');
    glowFilter.innerHTML = `
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    `;
    defs.appendChild(glowFilter);

    // Target zone gradient
    const targetGradient = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    targetGradient.setAttribute('id', 'targetGradient');
    targetGradient.innerHTML = `
      <stop offset="0%" stop-color="${this.colors.targetZone4}"/>
      <stop offset="25%" stop-color="${this.colors.targetZone3}"/>
      <stop offset="50%" stop-color="${this.colors.targetZone2}"/>
      <stop offset="75%" stop-color="${this.colors.targetZone1}"/>
      <stop offset="100%" stop-color="${this.colors.targetZone0}"/>
    `;
    defs.appendChild(targetGradient);

    this.svg.appendChild(defs);

    // Background dial arc
    this.elements.dialArc = this.createArcElement(
      Math.PI, 0, this.options.radius,
      { fill: 'none', stroke: this.colors.dialArc, strokeWidth: 40 }
    );
    this.svg.appendChild(this.elements.dialArc);

    // Target zone container (hidden until reveal)
    this.elements.targetZone = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.elements.targetZone.setAttribute('class', 'target-zone');
    this.elements.targetZone.style.opacity = '0';
    this.svg.appendChild(this.elements.targetZone);

    // Tick marks
    this.elements.ticks = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.elements.ticks.setAttribute('class', 'tick-marks');
    this.createTickMarks();
    this.svg.appendChild(this.elements.ticks);

    // Cover/shield (animated)
    this.elements.cover = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.elements.cover.setAttribute('class', 'dial-cover');
    this.elements.cover.setAttribute('fill', this.colors.cover);
    this.elements.cover.setAttribute('d', this.describeWedge(Math.PI, 0, this.options.radius + 25));
    this.svg.appendChild(this.elements.cover);

    // Reveal lever
    this.elements.revealLever = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.elements.revealLever.setAttribute('class', 'reveal-lever');
    this.elements.revealLever.setAttribute('stroke', this.colors.targetZone4);
    this.elements.revealLever.setAttribute('stroke-width', '4');
    this.elements.revealLever.setAttribute('stroke-linecap', 'round');
    this.elements.revealLever.style.opacity = '0';
    this.svg.appendChild(this.elements.revealLever);

    // Player markers container
    this.elements.playerMarkers = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.elements.playerMarkers.setAttribute('class', 'player-markers');
    this.svg.appendChild(this.elements.playerMarkers);

    // Guess hand
    this.elements.guessHand = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.elements.guessHand.setAttribute('class', 'guess-hand');
    this.elements.guessHand.setAttribute('stroke', this.colors.guessHand);
    this.elements.guessHand.setAttribute('stroke-width', '6');
    this.elements.guessHand.setAttribute('stroke-linecap', 'round');
    this.elements.guessHand.setAttribute('filter', 'url(#glow)');
    this.svg.appendChild(this.elements.guessHand);

    // Guess hand knob (center pivot)
    this.elements.centerKnob = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.elements.centerKnob.setAttribute('cx', this.options.centerX);
    this.elements.centerKnob.setAttribute('cy', this.options.centerY);
    this.elements.centerKnob.setAttribute('r', '12');
    this.elements.centerKnob.setAttribute('fill', this.colors.guessHand);
    this.svg.appendChild(this.elements.centerKnob);

    // Value display (center)
    this.elements.valueDisplay = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    this.elements.valueDisplay.setAttribute('x', this.options.centerX);
    this.elements.valueDisplay.setAttribute('y', this.options.centerY + 50);
    this.elements.valueDisplay.setAttribute('text-anchor', 'middle');
    this.elements.valueDisplay.setAttribute('font-size', '24');
    this.elements.valueDisplay.setAttribute('font-weight', 'bold');
    this.elements.valueDisplay.setAttribute('fill', this.colors.textPrimary);
    this.svg.appendChild(this.elements.valueDisplay);

    // Base line (bottom of semicircle)
    const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    baseLine.setAttribute('x1', this.options.centerX - this.options.radius - 10);
    baseLine.setAttribute('y1', this.options.centerY);
    baseLine.setAttribute('x2', this.options.centerX + this.options.radius + 10);
    baseLine.setAttribute('y2', this.options.centerY);
    baseLine.setAttribute('stroke', this.colors.dialArcStroke);
    baseLine.setAttribute('stroke-width', '2');
    this.svg.appendChild(baseLine);

    this.container.appendChild(this.svg);

    this.updateGuessHand();
  }

  createArcElement(startAngle, endAngle, radius, style = {}) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', this.describeArc(startAngle, endAngle, radius));
    path.setAttribute('fill', style.fill || 'none');
    path.setAttribute('stroke', style.stroke || '#000');
    path.setAttribute('stroke-width', style.strokeWidth || 2);
    if (style.strokeLinecap) path.setAttribute('stroke-linecap', style.strokeLinecap);
    return path;
  }

  createTickMarks() {
    for (let i = this.options.minValue; i <= this.options.maxValue; i++) {
      const angle = this.valueToAngle(i);
      const innerRadius = this.options.radius - 20;
      const outerRadius = this.options.radius + 20;

      const inner = this.angleToCoords(angle, innerRadius);
      const outer = this.angleToCoords(angle, outerRadius);

      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', inner.x);
      tick.setAttribute('y1', inner.y);
      tick.setAttribute('x2', outer.x);
      tick.setAttribute('y2', outer.y);

      // Major ticks at 1, 5, 10, 15, 20
      const isMajor = i === 1 || i === 5 || i === 10 || i === 15 || i === 20;
      tick.setAttribute('stroke', isMajor ? this.colors.tickMark : this.colors.tickMarkMinor);
      tick.setAttribute('stroke-width', isMajor ? 2 : 1);

      this.elements.ticks.appendChild(tick);

      // Add labels for major ticks
      if (isMajor) {
        const labelRadius = this.options.radius + 35;
        const labelPos = this.angleToCoords(angle, labelRadius);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', labelPos.x);
        label.setAttribute('y', labelPos.y + 5);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '12');
        label.setAttribute('fill', this.colors.textSecondary);
        label.textContent = i.toString();
        this.elements.ticks.appendChild(label);
      }
    }
  }

  updateGuessHand() {
    const angle = this.valueToAngle(this.value);
    const tip = this.angleToCoords(angle, this.options.radius - 10);

    this.elements.guessHand.setAttribute('x1', this.options.centerX);
    this.elements.guessHand.setAttribute('y1', this.options.centerY);
    this.elements.guessHand.setAttribute('x2', tip.x);
    this.elements.guessHand.setAttribute('y2', tip.y);

    this.elements.valueDisplay.textContent = this.value;
  }

  setupInteraction() {
    if (!this.options.interactive) return;

    let isDragging = false;

    const getAngleFromEvent = (e) => {
      const rect = this.svg.getBoundingClientRect();
      const scaleX = this.options.width / rect.width;
      const scaleY = this.options.height / rect.height;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      const x = (clientX - rect.left) * scaleX - this.options.centerX;
      const y = this.options.centerY - (clientY - rect.top) * scaleY;

      let angle = Math.atan2(y, x);

      // Clamp to semicircle (0 to PI)
      if (angle < 0) angle = 0;
      if (angle > Math.PI) angle = Math.PI;

      return angle;
    };

    const updateFromEvent = (e) => {
      const angle = getAngleFromEvent(e);
      const newValue = this.angleToValue(angle);

      if (newValue !== this.value) {
        this.value = Math.max(this.options.minValue, Math.min(this.options.maxValue, newValue));
        this.updateGuessHand();

        if (this.onChangeCallback) {
          this.onChangeCallback(this.value);
        }
      }
    };

    // Mouse events
    this.svg.addEventListener('mousedown', (e) => {
      isDragging = true;
      updateFromEvent(e);
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        updateFromEvent(e);
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Touch events
    this.svg.addEventListener('touchstart', (e) => {
      isDragging = true;
      updateFromEvent(e);
      e.preventDefault();
    }, { passive: false });

    this.svg.addEventListener('touchmove', (e) => {
      if (isDragging) {
        updateFromEvent(e);
        e.preventDefault();
      }
    }, { passive: false });

    this.svg.addEventListener('touchend', () => {
      isDragging = false;
    });
  }

  setValue(value) {
    this.value = Math.max(this.options.minValue, Math.min(this.options.maxValue, value));
    this.updateGuessHand();
  }

  getValue() {
    return this.value;
  }

  onChange(callback) {
    this.onChangeCallback = callback;
  }

  setTarget(target) {
    this.target = target;
    this.renderTargetZone();
  }

  setGuesses(guesses) {
    this.guesses = guesses;
    this.renderPlayerMarkers();
  }

  setCoverVisible(visible) {
    this.options.showCover = visible;
    this.elements.cover.style.opacity = visible ? '1' : '0';
  }

  setInteractive(interactive) {
    this.options.interactive = interactive;
    this.svg.style.cursor = interactive ? 'pointer' : 'default';
  }

  renderTargetZone() {
    if (!this.target) return;

    this.elements.targetZone.innerHTML = '';

    // Draw scoring zones (outer to inner: 0, 1, 2, 3, 4 points)
    const zones = [
      { offset: 4, color: this.colors.targetZone0 },
      { offset: 3, color: this.colors.targetZone1 },
      { offset: 2, color: this.colors.targetZone2 },
      { offset: 1, color: this.colors.targetZone3 },
      { offset: 0, color: this.colors.targetZone4 }
    ];

    for (const zone of zones) {
      const minVal = Math.max(this.options.minValue, this.target - zone.offset);
      const maxVal = Math.min(this.options.maxValue, this.target + zone.offset);

      // Add small padding to make zones visible
      const startAngle = this.valueToAngle(minVal) + 0.02;
      const endAngle = this.valueToAngle(maxVal) - 0.02;

      const zonePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      zonePath.setAttribute('d', this.describeWedge(startAngle, endAngle, this.options.radius - 5));
      zonePath.setAttribute('fill', zone.color);
      zonePath.setAttribute('opacity', '0.8');
      this.elements.targetZone.appendChild(zonePath);
    }

    // Target indicator line
    const targetAngle = this.valueToAngle(this.target);
    const inner = this.angleToCoords(targetAngle, this.options.radius - 30);
    const outer = this.angleToCoords(targetAngle, this.options.radius + 5);

    const targetLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    targetLine.setAttribute('x1', inner.x);
    targetLine.setAttribute('y1', inner.y);
    targetLine.setAttribute('x2', outer.x);
    targetLine.setAttribute('y2', outer.y);
    targetLine.setAttribute('stroke', '#000');
    targetLine.setAttribute('stroke-width', '3');
    this.elements.targetZone.appendChild(targetLine);

    // Target value label
    const labelPos = this.angleToCoords(targetAngle, this.options.radius - 50);
    const targetLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    targetLabel.setAttribute('x', labelPos.x);
    targetLabel.setAttribute('y', labelPos.y + 5);
    targetLabel.setAttribute('text-anchor', 'middle');
    targetLabel.setAttribute('font-size', '18');
    targetLabel.setAttribute('font-weight', 'bold');
    targetLabel.setAttribute('fill', '#000');
    targetLabel.textContent = this.target;
    this.elements.targetZone.appendChild(targetLabel);
  }

  renderPlayerMarkers() {
    this.elements.playerMarkers.innerHTML = '';

    const markerColors = [
      '#e8a598', '#a8c5b8', '#a8c4d4', '#c4b7d4',
      '#f0d5c8', '#d4c4a8', '#b8c5d4', '#d4b8c4',
      '#c4d4b8', '#d4c8b8'
    ];

    let colorIndex = 0;

    for (const [playerId, data] of Object.entries(this.guesses)) {
      const guess = typeof data === 'number' ? data : data.guess;
      const name = typeof data === 'object' ? data.name : playerId.slice(0, 4);
      const isOwn = typeof data === 'object' ? data.isOwn : false;

      const angle = this.valueToAngle(guess);
      const markerPos = this.angleToCoords(angle, this.options.radius);
      const color = markerColors[colorIndex % markerColors.length];

      // Marker dot
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      marker.setAttribute('cx', markerPos.x);
      marker.setAttribute('cy', markerPos.y);
      marker.setAttribute('r', isOwn ? '10' : '8');
      marker.setAttribute('fill', color);
      marker.setAttribute('stroke', isOwn ? '#000' : '#fff');
      marker.setAttribute('stroke-width', isOwn ? '3' : '2');
      this.elements.playerMarkers.appendChild(marker);

      // Player name label
      const labelPos = this.angleToCoords(angle, this.options.radius + 55);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', labelPos.x);
      label.setAttribute('y', labelPos.y);
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '11');
      label.setAttribute('font-weight', isOwn ? 'bold' : 'normal');
      label.setAttribute('fill', this.colors.textPrimary);
      label.textContent = name.length > 8 ? name.slice(0, 7) + '...' : name;
      this.elements.playerMarkers.appendChild(label);

      colorIndex++;
    }
  }

  // Animate the reveal sequence
  async reveal(target, guesses, duration = 1500) {
    this.target = target;
    this.guesses = guesses;
    this.isRevealing = true;

    // Prepare target zone but keep hidden
    this.renderTargetZone();
    this.elements.targetZone.style.opacity = '0';

    // Show reveal lever at starting position (right side, 3 o'clock)
    const startAngle = 0;
    const endAngle = Math.PI;

    this.elements.revealLever.style.opacity = '1';
    this.elements.revealLever.setAttribute('x1', this.options.centerX);
    this.elements.revealLever.setAttribute('y1', this.options.centerY);

    const startTime = performance.now();

    return new Promise((resolve) => {
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);

        // Current lever angle (sweeps counterclockwise from 0 to PI)
        const currentAngle = startAngle + (endAngle - startAngle) * eased;

        // Update lever position
        const leverTip = this.angleToCoords(currentAngle, this.options.radius + 20);
        this.elements.revealLever.setAttribute('x2', leverTip.x);
        this.elements.revealLever.setAttribute('y2', leverTip.y);

        // Update cover - shrink from right to left
        if (progress < 1) {
          const coverPath = this.describeWedge(Math.PI, currentAngle, this.options.radius + 25);
          this.elements.cover.setAttribute('d', coverPath);
        } else {
          this.elements.cover.style.opacity = '0';
        }

        // Gradually reveal target zone
        this.elements.targetZone.style.opacity = eased.toString();

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Animation complete
          this.isRevealing = false;
          this.elements.revealLever.style.opacity = '0';

          // Show player markers with a slight delay
          setTimeout(() => {
            this.renderPlayerMarkers();
          }, 200);

          resolve();
        }
      };

      requestAnimationFrame(animate);
    });
  }

  // Reset to guessing state
  reset() {
    this.target = null;
    this.guesses = {};
    this.value = 10;
    this.isRevealing = false;

    this.elements.targetZone.innerHTML = '';
    this.elements.targetZone.style.opacity = '0';
    this.elements.playerMarkers.innerHTML = '';
    this.elements.cover.style.opacity = '1';
    this.elements.cover.setAttribute('d', this.describeWedge(Math.PI, 0, this.options.radius + 25));
    this.elements.revealLever.style.opacity = '0';

    this.updateGuessHand();
  }

  // Hide the guess hand (for non-guessers)
  hideGuessHand() {
    this.elements.guessHand.style.opacity = '0';
    this.elements.centerKnob.style.opacity = '0';
    this.elements.valueDisplay.style.opacity = '0';
  }

  // Show the guess hand
  showGuessHand() {
    this.elements.guessHand.style.opacity = '1';
    this.elements.centerKnob.style.opacity = '1';
    this.elements.valueDisplay.style.opacity = '1';
  }

  // Show target to clue-giver during compose (without full reveal)
  showTargetPreview(target) {
    this.target = target;

    // Just show a simple target indicator line
    const targetAngle = this.valueToAngle(target);
    const inner = this.angleToCoords(targetAngle, 30);
    const outer = this.angleToCoords(targetAngle, this.options.radius - 30);

    // Remove existing preview if any
    const existing = this.svg.querySelector('.target-preview');
    if (existing) existing.remove();

    const previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    previewLine.setAttribute('class', 'target-preview');
    previewLine.setAttribute('x1', inner.x);
    previewLine.setAttribute('y1', inner.y);
    previewLine.setAttribute('x2', outer.x);
    previewLine.setAttribute('y2', outer.y);
    previewLine.setAttribute('stroke', this.colors.targetZone4);
    previewLine.setAttribute('stroke-width', '4');
    previewLine.setAttribute('stroke-dasharray', '8 4');

    // Insert before cover so it's visible but under the guess hand
    this.svg.insertBefore(previewLine, this.elements.cover);

    // Hide the cover for clue-giver
    this.elements.cover.style.opacity = '0';
  }

  hideTargetPreview() {
    const existing = this.svg.querySelector('.target-preview');
    if (existing) existing.remove();
    this.elements.cover.style.opacity = '1';
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WavelengthDial;
}
if (typeof window !== 'undefined') {
  window.WavelengthDial = WavelengthDial;
}
