import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, '../src/assets/logo.png');
const outputPath = path.join(__dirname, '../src/assets/logo-transparent.png');

async function makeTransparent() {
  try {
    // Read the image and get metadata
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Extract raw pixel data
    const { data, info } = await image
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Create a new buffer for the output with alpha channel
    const outputData = Buffer.alloc(info.width * info.height * 4);
    
    // Process each pixel
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Check if pixel is white or near-white (threshold of 240)
      const isWhite = r > 240 && g > 240 && b > 240;
      
      // Output position (4 channels: RGBA)
      const outputIndex = (i / info.channels) * 4;
      
      outputData[outputIndex] = r;
      outputData[outputIndex + 1] = g;
      outputData[outputIndex + 2] = b;
      outputData[outputIndex + 3] = isWhite ? 0 : 255; // Alpha: 0 for white, 255 for others
    }
    
    // Save the result
    await sharp(outputData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4
      }
    })
    .png()
    .toFile(outputPath);
    
    console.log('Successfully created transparent logo at:', outputPath);
  } catch (error) {
    console.error('Error processing image:', error);
  }
}

makeTransparent();