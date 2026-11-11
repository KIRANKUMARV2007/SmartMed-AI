import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

async function startServer() {
  // Gracefully report MongoDB connection state without crashing on startup
  if (MONGODB_URI) {
    try {
      await connectDB(MONGODB_URI);
      console.log('[SmartMed Server] Database connected successfully.');
      // Non-destructive initial administrative and clinical accounts setup
      const { provisionInitialAccounts } = await import('./config/provisionUsers.js');
      await provisionInitialAccounts();
    } catch (err) {
      console.warn(
        `[SmartMed Server] Database connection could not be established: ${err.message}. Running in offline/unconnected mode.`
      );
    }
  } else {
    console.warn(
      '[SmartMed Server] MONGODB_URI is not configured in .env. API will report database as disconnected.'
    );
  }

  const server = app.listen(PORT, () => {
    console.log(`[SmartMed Server] Express server listening on port ${PORT}`);
    console.log(`[SmartMed Server] Health endpoint: http://localhost:${PORT}/api/health`);
  });

  return server;
}

startServer();
