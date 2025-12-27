// check-models.js
const fs = require('fs');
const path = require('path');

console.log('📁 Checking models directory...');
console.log('Current directory:', __dirname);

const modelsDir = path.join(__dirname, 'models');
console.log('Models directory path:', modelsDir);

if (fs.existsSync(modelsDir)) {
  console.log('✅ Models directory exists');
  const files = fs.readdirSync(modelsDir);
  console.log('\n📄 Files in models directory:');
  files.forEach(file => {
    console.log(`  - ${file}`);
  });
} else {
  console.log('❌ Models directory does not exist!');
  
  // Show what's in current directory
  console.log('\n📄 Files in current directory:');
  const currentFiles = fs.readdirSync(__dirname);
  currentFiles.forEach(file => {
    const stats = fs.statSync(path.join(__dirname, file));
    console.log(`  - ${file} (${stats.isDirectory() ? 'folder' : 'file'})`);
  });
}