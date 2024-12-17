const sharp = require('sharp');
const path = require('path');
const fs = require('fs-extra');

const SIZES = [16, 48, 128];
const SOURCE_ICON = path.join(__dirname, '../src/assets/icon.jpeg');
const OUTPUT_DIR = path.join(__dirname, '../dist/assets/icons');

async function generateIcons() {
  try {
    // Ensure source icon exists
    if (!fs.existsSync(SOURCE_ICON)) {
      console.error('[Error: Input file is missing: src/assets/icon.png]');
      process.exit(1);
    }

    // Create output directory
    await fs.ensureDir(OUTPUT_DIR);

    // Generate icons for each size
    await Promise.all(
      SIZES.map(async (size) => {
        const output = path.join(OUTPUT_DIR, `icon${size}.png`);
        await sharp(SOURCE_ICON)
          .resize(size, size)
          .toFile(output);
      })
    );

    console.log('Icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
