import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');
const zipFile = path.resolve(__dirname, '../flashx-extension.zip');

if (!fs.existsSync(distDir)) {
  console.error('Error: dist directory does not exist. Run "npm run build" first.');
  process.exit(1);
}

// Validate critical Manifest V3 files in dist
const requiredFiles = [
  'manifest.json',
  'background.js',
  'content.js',
  'popup.html',
  'options.html',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

const missing = requiredFiles.filter((f) => !fs.existsSync(path.join(distDir, f)));
if (missing.length > 0) {
  console.error('Error: Missing required extension files in dist/:', missing);
  process.exit(1);
}

// Remove old zip if exists
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

// Zip dist contents
try {
  execSync(`cd "${distDir}" && zip -r "${zipFile}" . -x "*.DS_Store"`, { stdio: 'inherit' });
  const stat = fs.statSync(zipFile);
  console.log(`\nSuccessfully packaged FlashX Chrome Extension:`);
  console.log(`  File: ${zipFile}`);
  console.log(`  Size: ${(stat.size / 1024).toFixed(1)} KB\n`);
} catch (err) {
  console.error('Failed to create extension zip:', err);
  process.exit(1);
}
