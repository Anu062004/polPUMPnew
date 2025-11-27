/**
 * Simple startup script to test server initialization
 * Run with: node start-server.js
 */

const { spawn } = require('child_process')

console.log('🚀 Starting backend server...')
console.log('📝 Check the output below for any errors\n')

const server = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
})

server.on('error', (error) => {
  console.error('❌ Failed to start server:', error)
  process.exit(1)
})

server.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Server exited with code ${code}`)
    process.exit(code)
  }
})

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping server...')
  server.kill('SIGINT')
  process.exit(0)
})

