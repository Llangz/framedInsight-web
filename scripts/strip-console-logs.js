// strip-console-logs.js
// Removes console.log/warn/error from production builds
const fs = require('fs')
const path = require('path')
const glob = require('glob')

const APP_DIR = path.join(__dirname, '..', 'app')
const LIB_DIR = path.join(__dirname, '..', 'lib')
const COMPONENTS_DIR = path.join(__dirname, '..', 'components')

const CONSOLE_REGEX = /console\.(log|warn|error|info|debug)\([^)]*\);?/g

function stripConsoleLogs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  
  let modified = false
  const newLines = lines.map(line => {
    if (line.trim().startsWith('//')) return line
    if (CONSOLE_REGEX.test(line)) {
      modified = true
      return line.replace(CONSOLE_REGEX, '/* console removed */')
    }
    return line
  })
  
  if (modified) {
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8')
    console.log(`✓ Stripped: ${path.relative(__dirname, filePath)}`)
  }
}

function processDirectory(dir) {
  const pattern = path.join(dir, '**/*.{ts,tsx,js,jsx}')
  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/.next/**', '**/*.test.ts']
  })
  files.forEach(stripConsoleLogs)
}

console.log('🧹 Stripping console logs...\n')
processDirectory(APP_DIR)
processDirectory(LIB_DIR)
processDirectory(COMPONENTS_DIR)
console.log('\n✅ Complete!')
