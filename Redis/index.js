const express = require('express');
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const redis = require('redis');
const util = require('util');

const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017')
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Redis Connection
const redisClient = redis.createClient();
redisClient.connect()
    .then(() => console.log('Redis connected'))
    .catch(err => console.error('Redis connection error:', err));

// Promisify Redis methods
const setAsync = util.promisify(redisClient.set).bind(redisClient);
const getAsync = util.promisify(redisClient.get).bind(redisClient);
// Schemas and Models
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    historicoDeAvaliacao: [mongoose.Schema.Types.ObjectId], // Referencing books
    preferenciasGenero: [String],
});
const User = mongoose.model('User', userSchema);

const bookSchema = new mongoose.Schema({
    titulo: String,
    autor: String,
    genero: String,
    descricao: String,
    avaliacoes: [{
        nota: Number,
        comentario: String,
    }],
});
const Book = mongoose.model('Book', bookSchema);

// Middleware for caching
async function cache(req, res, next) {
    const key = req.originalUrl;

    try {
        console.log(`[CACHE] Checking for key: ${key}`);
        const cachedData = await redisClient.get(key);

        if (cachedData) {
            console.log(`[CACHE HIT] Key: ${key}`);
            return res.json(JSON.parse(cachedData));
        }

        console.log(`[CACHE MISS] Key: ${key}`);
        res.sendResponse = res.json;
        res.json = async (body) => {
            try {
                console.log(`[CACHE SETTING KEY] Key: ${key}`);
                await redisClient.set(key, JSON.stringify(body), { EX: 3600 }); // Expire in 1 hour
                console.log(`[CACHE SET SUCCESS] Key: ${key}`);
            } catch (cacheError) {
                console.error(`[CACHE ERROR] Failed to set key: ${key}`, cacheError);
            }
            res.sendResponse(body);
        };

        next();
    } catch (error) {
        console.error(`[CACHE ERROR] Key: ${key}`, error);
        next(); // Continue if cache fails
    }
}


// Endpoints

app.get('/test-cache', async (req, res) => {
    const key = 'test_key';
    const value = { message: 'This is a test' };

    try {
        console.log('[REDIS TEST] Setting key...');
        await redisClient.set(key, JSON.stringify(value), { EX: 10 }); // Expire in 10 seconds
        console.log('[REDIS TEST] Key set successfully.');

        const cachedValue = await redisClient.get(key);
        console.log('[REDIS TEST] Retrieved value:', cachedValue);

        res.json({ cachedValue: JSON.parse(cachedValue) });
    } catch (error) {
        console.error('[REDIS TEST] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create Users
app.post('/usuarios', async (req, res) => {
    const { name, email, preferenciasGenero } = req.body;
    const newUser = new User({ name, email, preferenciasGenero, historicoDeAvaliacao: [] });
    await newUser.save();
    res.status(201).json(newUser);
});

// Create Books
app.post('/livros', async (req, res) => {
    const { titulo, autor, genero, descricao } = req.body;
    const newBook = new Book({ titulo, autor, genero, descricao, avaliacoes: [] });
    await newBook.save();
    res.status(201).json(newBook);
});

// Add Reviews
app.post('/livros/:bookId/avaliacoes', async (req, res) => {
    try {
        const { bookId } = req.params;
        const { nota, comentario, userId } = req.body;

        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Livro não encontrado' });

        book.avaliacoes.push({ nota, comentario });
        const updatedBook = await book.save();

        const user = await User.findById(userId);
        if (user) {
            user.historicoDeAvaliacao.push(updatedBook._id);
            await user.save();
        }

        res.status(201).json(updatedBook);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get Reviews of a Book (with caching)
app.get('/livros/:bookId/avaliacoes', cache, async (req, res) => {
    try {
        const { bookId } = req.params;
        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Livro não encontrado' });

        res.json(book.avaliacoes);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Search Books (with caching)
app.get('/busca', cache, async (req, res) => {
    try {
        const books = await Book.find();
        res.json(books);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Search Books by Title (with caching)
app.get('/busca/titulo', cache, async (req, res) => {
    try {
        const { titulo } = req.query;
        if (!titulo) return res.status(400).json({ message: 'Título é obrigatório' });

        const books = await Book.find({ titulo: new RegExp(titulo, 'i') });
        res.json(books);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Search Books by Genre (with caching)
app.get('/busca/genero', cache, async (req, res) => {
    try {
        const { genero } = req.query;
        if (!genero) return res.status(400).json({ message: 'Gênero é obrigatório' });

        const books = await Book.find({ genero });
        res.json(books);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Populate Database with Fake Data
app.post('/populate', async (req, res) => {
    const { usersCount, booksCount } = req.body;

    try {
        for (let i = 0; i < usersCount; i++) {
            await User.create({
                name: faker.person.fullName(),
                email: faker.internet.email(),
                preferenciasGenero: faker.helpers.arrayElements(['Fiction', 'Non-Fiction', 'Science', 'Fantasy', 'History'], 2),
            });
        }

        for (let i = 0; i < booksCount; i++) {
            await Book.create({
                titulo: faker.lorem.words(3),
                autor: faker.person.fullName(),
                genero: faker.helpers.arrayElement(['Fiction', 'Non-Fiction', 'Science', 'Fantasy', 'History']),
                descricao: faker.lorem.sentences(2),
            });
        }

        res.json({ message: 'Database populated successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
