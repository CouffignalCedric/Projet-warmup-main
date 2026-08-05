const fs = require('fs');
const path = require('path');

// Minimal MP3 header for a silent 1-second audio file
// This is a valid but minimal MP3 file that plays silence
const createMinimalMP3 = (duration = 1) => {
  // MP3 frame header for 128 kbps stereo at 44.1 kHz
  // Duration: ~1 second per frame
  const frames = [];
  
  // MP3 MPEG version 1 Layer 3, 128 kbps, 44.1 kHz, stereo
  const frameHeader = Buffer.from([0xFF, 0xFB, 0x90, 0x04]);
  
  // Generate multiple frames for the desired duration
  for (let i = 0; i < duration; i++) {
    frames.push(frameHeader);
    // Add minimal frame data (silence)
    frames.push(Buffer.alloc(418)); // Frame size for 128 kbps at 44.1 kHz
  }
  
  return Buffer.concat(frames);
};

// Create public folder if it doesn't exist
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Create ralenti.mp3 (slow down sound - 1 second)
const ralentiMP3 = createMinimalMP3(1);
fs.writeFileSync(path.join(publicDir, 'ralenti.mp3'), ralentiMP3);
console.log('✓ Created ralenti.mp3');

// Create end.mp3 (finish sound - 1 second)
const endMP3 = createMinimalMP3(1);
fs.writeFileSync(path.join(publicDir, 'end.mp3'), endMP3);
console.log('✓ Created end.mp3');

console.log('Audio files created successfully!');
