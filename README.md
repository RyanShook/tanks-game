# 3D Wireframe Tanks vs Spaceships

A retro-style 3D tank combat game built with Three.js, featuring wireframe graphics inspired by classic arcade games like Battlezone. Fight against enemy tanks and alien spaceships in progressive waves!

## 🎮 Play Now

**[► PLAY GAME ◄](https://ryanshook.org/tanks-game/)**

*Live version hosted on GitHub Pages*

## ✨ Features

### Combat System
- **First-person tank combat** with realistic physics
- **Wave-based gameplay** with progressive difficulty
- **Multiple enemy types**: Ground tanks, flying saucers, and space fighters
- **Physics-based projectiles** with gravity and ballistics
- **Power-ups**: Speed boost, rapid fire, and shield

### Visual & Audio
- **Retro wireframe 3D graphics** in classic green vector style
- **Enhanced explosion effects** with particle systems
- **Dynamic radar system** showing enemies as different symbols
- **Sound effects** for weapons, explosions, and engine
- **Screen flash effects** for wave completion

### Enemy AI
- **Ground Tanks**: Patrol, seek, and attack with tactical positioning
- **Flying Saucers**: Hover and weave with unpredictable movement
- **Space Fighters**: Aggressive dive attacks and circling patterns
- **Smart targeting** and collision avoidance

## 🎯 Controls

- **`W`** - Move forward
- **`S`** - Move backward  
- **`A`** - Rotate left
- **`D`** - Rotate right
- **`SPACE`** - Fire cannon
- **`R`** - Restart game (when game over)

## 🏆 Scoring

- **Tanks**: 1,000 points
- **Flying Saucers**: 1,500 points
- **Space Fighters**: 2,000 points
- **Wave Bonus**: 500 × wave number
- **Bonus Life**: Every 15,000 points

## 🌊 Wave Progression

- **Wave 1**: Ground tanks only
- **Wave 2+**: Tanks + flying saucers
- **Wave 4+**: Tanks + saucers + space fighters
- Each wave increases enemy count and aggression

## 🛠️ Development Setup

1. Clone the repository:
```bash
git clone https://github.com/RyanShook/tanks-game.git
cd tanks-game
```

2. Serve the files using a local web server:
```bash
# Python 3
python -m http.server 8000

# Node.js (if you have npx)
npx serve .

# PHP
php -S localhost:8000
```

3. Open your browser and navigate to `http://localhost:8000`

## 🚀 GitHub Pages Deployment

This game is automatically deployed to GitHub Pages from the `main` branch. Any commits to main will update the live version at:
**https://ryanshook.org/tanks-game/**

## 💻 Technologies Used

- **Three.js** - 3D graphics and WebGL rendering
- **Vanilla JavaScript** - Game logic and physics
- **HTML5 Canvas** - HUD and radar display
- **CSS3** - UI styling and effects
- **Web Audio API** - Sound effects

## 📱 Browser Compatibility

- Chrome/Edge (Recommended)
- Firefox
- Safari
- Mobile browsers (with touch controls coming soon!)

## 🤝 Contributing

Feel free to fork this project and submit pull requests! Some ideas for contributions:
- Mobile touch controls
- New enemy types
- Additional power-ups
- Multiplayer support
- Better graphics

## 📄 License

MIT License - feel free to use this code for your own projects! 