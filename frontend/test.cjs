const io = require("socket.io-client");
const jwt = require("jsonwebtoken");

const token = jwt.sign({ userId: 'test_user_123' }, 'your-super-secret-jwt-key-change-in-production', { expiresIn: '15m' });

const socket = io("http://localhost:5000", { 
  transports: ['websocket'],
  auth: { token }
});

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('client:terminal.spawn', { shell: 'cmd.exe', cols: 80, rows: 24 }, (res) => {
    console.log('Spawn response:', res);
  });
});

socket.on('server:terminal.data', (payload) => {
  console.log('DATA:', payload.data);
  process.exit(0);
});

socket.on('server:terminal.error', (err) => {
  console.log('ERROR:', err);
  process.exit(1);
});
