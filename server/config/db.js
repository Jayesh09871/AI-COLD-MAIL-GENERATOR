const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);

        // Handle stale username index if it exists
        try {
            const collections = await conn.connection.db.listCollections({ name: 'users' }).toArray();
            if (collections.length > 0) {
                const indexes = await conn.connection.db.collection('users').indexes();
                const hasUsernameIndex = indexes.some(idx => idx.name === 'username_1');
                if (hasUsernameIndex) {
                    await conn.connection.db.collection('users').dropIndex('username_1');
                    console.log('Successfully dropped stale username_1 index');
                }
            }
        } catch (idxError) {
            console.warn('Note: Stale index check failed or not needed:', idxError.message);
        }
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
