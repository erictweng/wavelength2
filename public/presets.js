// Preset spectrum categories for quick selection
const PRESETS = [
  { left: 'Cold', right: 'Hot' },
  { left: 'Underrated', right: 'Overrated' },
  { left: 'Bad', right: 'Good' },
  { left: 'Unpopular', right: 'Popular' },
  { left: 'Round', right: 'Pointy' },
  { left: 'Boring', right: 'Exciting' },
  { left: 'Unethical', right: 'Ethical' },
  { left: 'Useless', right: 'Useful' },
  { left: 'Dangerous', right: 'Safe' },
  { left: 'Cheap', right: 'Expensive' },
  { left: 'Old', right: 'New' },
  { left: 'Small', right: 'Big' },
  { left: 'Quiet', right: 'Loud' },
  { left: 'Slow', right: 'Fast' },
  { left: 'Ugly', right: 'Beautiful' },
  { left: 'Easy', right: 'Hard' },
  { left: 'Weak', right: 'Strong' },
  { left: 'Normal', right: 'Weird' },
  { left: 'Failure', right: 'Success' },
  { left: 'Guilty Pleasure', right: 'Proudly Enjoy' },
  { left: 'Indoors', right: 'Outdoors' },
  { left: 'Brain', right: 'Brawn' },
  { left: 'Art', right: 'Science' },
  { left: 'Fantasy', right: 'Reality' },
  { left: 'Past', right: 'Future' },
  { left: 'Simple', right: 'Complex' },
  { left: 'Casual', right: 'Formal' },
  { left: 'Serious', right: 'Silly' },
  { left: 'Rare', right: 'Common' },
  { left: 'Natural', right: 'Artificial' }
];

// Export for module systems, also attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PRESETS;
}
if (typeof window !== 'undefined') {
  window.PRESETS = PRESETS;
}
