const express = require('express');
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');

const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017')
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

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

// Endpoints

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

app.post('/livros/:bookId/avaliacoes', async (req, res) => {
    try {
        const { bookId } = req.params;
        const { nota, comentario, userId } = req.body;
    
        const book = await Book.findById(bookId);
        if (!book) return res.status(404).json({ message: 'Livro não encontrado' });
    
        book.avaliacoes.push({ nota, comentario });
        const updatedBook = await book.save(); // Save the book after adding the review
    
        // Update user's historicoDeAvaliacao (new)
        const user = await User.findById(userId); // Assuming a userId field in Book schema
        if (user) {
          user.historicoDeAvaliacao.push(updatedBook._id);
          await user.save();
        }
    
        res.status(201).json(updatedBook);
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
  });

// Get Reviews of a Book
app.get('/livros/:bookId/avaliacoes', async (req, res) => {
    try {
      const { bookId } = req.params;
  
      const book = await Book.findById(bookId);
      if (!book) return res.status(404).json({ message: 'Livro não encontrado' });
  
      res.json(book.avaliacoes);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });


app.get('/busca', async (req, res) => {
  try {

    const books = await Book.find();
    res.json(books);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
  

// Search Books by Title
app.get('/busca/titulo', async (req, res) => {
    try {
      const { titulo } = req.query;
      if (!titulo) return res.status(400).json({ message: 'Título é obrigatório' });
  
      const books = await Book.find({ titulo: new RegExp(titulo, 'i') });
      res.json(books);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });
  
  // Search Books by Genre
  app.get('/busca/genero', async (req, res) => {
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
        // Create Fake Users
        for (let i = 0; i < usersCount; i++) {
            await User.create({
                name: faker.person.fullName(),
                email: faker.internet.email(),
                preferenciasGenero: faker.helpers.arrayElements(['Fiction', 'Non-Fiction', 'Science', 'Fantasy', 'History'], 2),
            });
        }

        // Create Fake Books
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
