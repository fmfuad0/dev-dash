const pty = require('node-pty');
console.log('Testing node-pty spawn...');
try {
  const term = pty.spawn('powershell.exe', [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env,
    // explicitly use ConPTY
    useConpty: true
  });
  
  term.onData(data => {
    console.log('Data:', JSON.stringify(data));
  });
  
  setTimeout(() => {
    console.log('Test complete, killing term');
    term.kill();
    process.exit(0);
  }, 2000);
} catch (err) {
  console.error('Failed to spawn:', err);
}
