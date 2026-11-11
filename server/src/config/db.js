import mongoose from 'mongoose';

/**
 * Checks if MongoDB is currently in the connected state (readyState === 1).
 * @returns {boolean}
 */
export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

/**
 * Establishes a secure connection to MongoDB / MongoDB Atlas.
 * Applies safe timeouts and diagnostic error logging without leaking credentials.
 *
 * @param {string} [uri] - Optional MongoDB URI override (defaults to process.env.MONGODB_URI)
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not defined.');
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
    });
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    const errorMsg = error.message || '';
    console.error(`[MongoDB] Connection failed: ${errorMsg}`);

    // Diagnostic hint for MongoDB Atlas TLS/SSL alert 80
    if (errorMsg.includes('alert number 80') || errorMsg.includes('tlsv1 alert internal error')) {
      console.error(
        '[MongoDB Diagnostic] TLS Alert 80 (Internal Error) detected. ' +
        'In MongoDB Atlas, this occurs when the client machine\'s public IP is not in the Network Access IP Access List. ' +
        'Action: Add your current public IP to MongoDB Atlas Console -> Network Access -> IP Access List.'
      );
    }

    throw error;
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
