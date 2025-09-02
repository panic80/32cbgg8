import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.join(__dirname, '../public/favicon.svg');
const publicPath = path.join(__dirname, '../public');

// Read the SVG file
const svgBuffer = fs.readFileSync(svgPath);

// Generate different sizes
const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 48, name: 'favicon-48x48.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' }
];

async function generateIcons() {
  try {
    // Generate PNG files for each size
    for (const { size, name } of sizes) {
      console.log(`Generating ${name} (${size}x${size})...`);
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(path.join(publicPath, name));
    }

    // Generate ICO file with multiple sizes
    // Note: Sharp doesn't directly support ICO format, so we'll use png-to-ico package
    console.log('\nTo generate favicon.ico, you need to install png-to-ico:');
    console.log('npm install -g png-to-ico');
    console.log('Then run:');
    console.log('png-to-ico public/favicon-16x16.png public/favicon-32x32.png public/favicon-48x48.png > public/favicon.ico');
    
    console.log('\nAll PNG icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();