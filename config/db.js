const mongoose = require('mongoose');

let cached = global._mongooseConnection;

const connectDB = async () => {
    if (cached && cached.readyState === 1) {
        return cached;
    }
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        cached = conn.connection;
        global._mongooseConnection = cached;
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`MongoDB Error: ${error.message}`);
        throw error;
    }
};

module.exports = connectDB;
