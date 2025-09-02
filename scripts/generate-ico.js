import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, '../public');

async function generateIco() {
  try {
    const files = [
      path.join(publicPath, 'favicon-16x16.png'),
      path.join(publicPath, 'favicon-32x32.png'),
      path.join(publicPath, 'favicon-48x48.png')
    ];

    const ico = await pngToIco(files);
    fs.writeFileSync(path.join(publicPath, 'favicon.ico'), ico);
    console.log('favicon.ico generated successfully!');
  } catch (error) {
    console.error('Error generating ICO:', error);
  }
}

generateIco();