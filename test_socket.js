const { io } = require("socket.io-client");
const socket = io("http://localhost:5000", { transports: ['websocket'] });

// We need a valid token to connect, wait, I can just write a script that connects...
// Wait, the backend requires a JWT token. This might be hard to test if I don't have a token.
