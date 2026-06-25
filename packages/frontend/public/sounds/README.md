# Audio Files

This directory contains audio assets for the Kuizot quiz game.

## Required Audio Files

Add the following audio files to this directory:

### 1. `timer-music.mp3`
- **Purpose**: Background music during question countdown timer
- **Duration**: Should loop seamlessly (15-30 seconds recommended)
- **Style**: Energetic, tension-building, quiz-show style
- **Volume**: Will be played at 30% volume

### 2. `leaderboard-music.mp3`
- **Purpose**: Celebratory music during leaderboard/podium display
- **Duration**: Should loop seamlessly (20-40 seconds recommended)
- **Style**: Triumphant, celebratory, fanfare-like
- **Volume**: Will be played at 40% volume

## Audio Format Recommendations

- **Format**: MP3 (best browser compatibility)
- **Sample Rate**: 44.1 kHz
- **Bitrate**: 128-192 kbps (balance quality vs file size)
- **Looping**: Ensure audio loops seamlessly by trimming to exact beat boundaries

## Free Audio Resources

Consider these sources for royalty-free game music:
- [Freesound.org](https://freesound.org) - Creative Commons licensed sounds
- [Incompetech](https://incompetech.com) - Kevin MacLeod's royalty-free music
- [Mixkit](https://mixkit.co/free-stock-music/) - Free music tracks
- [OpenGameArt.org](https://opengameart.org) - Game assets including music

## Accessibility Note

The audio system respects the `prefers-reduced-motion` system preference. Users who have enabled reduced motion in their OS settings will not hear any audio automatically played by the game.

## Testing Without Audio Files

The game will work without these audio files - the audio will simply not play. Check the browser console for any warnings about missing files during development.
