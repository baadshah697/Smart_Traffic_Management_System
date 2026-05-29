const localtunnel = require('localtunnel');

/**
 * V.I.T.A.L.S. Tunnel Management Script
 * This script keeps the localtunnel connection alive and handles reconnections.
 */

(async () => {
  const PORT = 8000; // FastAPI default port
  const SUBDOMAIN = 'social-plants-fry'; // User requested subdomain

  const startTunnel = async () => {
    console.log(`[${new Date().toLocaleTimeString()}] Attempting to start tunnel on port ${PORT}...`);

    try {
      const tunnel = await localtunnel({
        port: PORT,
        subdomain: SUBDOMAIN
      });

      console.log('\n================================================');
      console.log(`✅ TUNNEL ACTIVE: ${tunnel.url}`);
      console.log(`📡 EXPOSING LOCALHOST:${PORT}`);
      console.log('================================================\n');

      tunnel.on('close', () => {
        console.log(`[${new Date().toLocaleTimeString()}] Tunnel connection closed. Retrying in 5s...`);
        setTimeout(startTunnel, 5000);
      });

      tunnel.on('error', (err) => {
        console.error(`[${new Date().toLocaleTimeString()}] Tunnel Error:`, err.message);
        setTimeout(startTunnel, 5000);
      });

    } catch (err) {
      console.error(`[${new Date().toLocaleTimeString()}] Connection Failed:`, err.message);
      console.log('Retrying in 10s...');
      setTimeout(startTunnel, 10000);
    }
  };

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down tunnel...');
    process.exit();
  });

  // Keep the Node.js event loop alive indefinitely so the script NEVER terminates by itself
  setInterval(() => {
    // Heartbeat: do nothing, just prevent event loop from emptying
  }, 1000 * 60 * 60); // Runs once an hour

  startTunnel();
})();
