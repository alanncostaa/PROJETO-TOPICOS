const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const { faker } = require('@faker-js/faker');

const app = express();
app.use(express.json());

// Conexão com o MySQL usando Sequelize
const sequelize = new Sequelize('livraria_db', 'root', 'root', {
    host: 'localhost',
    dialect: 'mysql',
});

// Definição dos Modelos (Tabelas)

const Usuario = sequelize.define('Usuario', {
    nome: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    preferenciasGenero: {
        type: DataTypes.TEXT,
        get() {
            const value = this.getDataValue('preferenciasGenero');
            return value ? JSON.parse(value) : [];
        },
        set(value) {
            this.setDataValue('preferenciasGenero', JSON.stringify(value));
        },
    },
}, {
    tableName: 'usuarios',
    timestamps: false,
});

const Livro = sequelize.define('Livro', {
    titulo: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    autor: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    genero: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    descricao: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
}, {
    tableName: 'livros',
    timestamps: false,
});

const Avaliacao = sequelize.define('Avaliacao', {
    nota: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    comentario: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'avaliacoes',
    timestamps: false,
});

// Relacionamentos entre as Tabelas
Usuario.hasMany(Avaliacao, { foreignKey: 'usuario_id' });
Avaliacao.belongsTo(Usuario, { foreignKey: 'usuario_id' });

Livro.hasMany(Avaliacao, { foreignKey: 'livro_id' });
Avaliacao.belongsTo(Livro, { foreignKey: 'livro_id' });

// Sincronizar os Modelos com o Banco de Dados
sequelize.sync().then(() => {
    console.log('Banco de dados sincronizado');
});

// Endpoints

// Criar Usuário
app.post('/usuarios', async (req, res) => {
    const { nome, email, preferenciasGenero } = req.body;
    try {
        const newUser = await Usuario.create({
            nome,
            email,
            preferenciasGenero,
        });
        res.status(201).json(newUser);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Criar Livro
app.post('/livros', async (req, res) => {
    const { titulo, autor, genero, descricao } = req.body;
    try {
        const newBook = await Livro.create({
            titulo,
            autor,
            genero,
            descricao,
        });
        res.status(201).json(newBook);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Adicionar Avaliação
app.post('/livros/:bookId/avaliacoes', async (req, res) => {
    const { bookId } = req.params;
    const { usuarioId, nota, comentario } = req.body;

    try {
        const newReview = await Avaliacao.create({
            usuario_id: usuarioId,
            livro_id: bookId,
            nota,
            comentario,
        });
        res.status(201).json(newReview);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Obter Avaliações de um Livro
app.get('/livros/:bookId/avaliacoes', async (req, res) => {
    const { bookId } = req.params;
    try {
        const reviews = await Avaliacao.findAll({
            where: { livro_id: bookId },
            include: [
                { model: Usuario, attributes: ['nome', 'email'] },
                { model: Livro, attributes: ['titulo', 'autor'] },
            ],
        });
        res.json(reviews);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Buscar Livros por Título
app.get('/busca/titulo', async (req, res) => {
    const { titulo } = req.query;
    try {
        const books = await Livro.findAll({
            where: {
                titulo: {
                    [Sequelize.Op.like]: `%${titulo}%`,
                },
            },
        });
        res.json(books);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/busca/livros', async (req, res) => {
  
  try {
      const books = await Livro.findAll();
      res.json(books);
  } catch (error) {
      res.status(400).json({ error: error.message });
  }
});

// Buscar Livros por Gênero
app.get('/busca/genero', async (req, res) => {
    const { genero } = req.query;
    try {
        const books = await Livro.findAll({
            where: { genero },
        });
        res.json(books);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Popular Banco de Dados com Dados Fakes
app.post('/populate', async (req, res) => {
    const { usersCount, booksCount } = req.body;

    try {
        // Criar Usuários Fakes
        for (let i = 0; i < usersCount; i++) {
            const nome = faker.person.fullName();
            const email = faker.internet.email();
            const preferenciasGenero = faker.helpers.arrayElements(['Fiction', 'Non-Fiction', 'Science', 'Fantasy', 'History'], 2);
            await Usuario.create({
                nome,
                email,
                preferenciasGenero,
            });
        }

        // Criar Livros Fakes
        for (let i = 0; i < booksCount; i++) {
            const titulo = faker.lorem.words(3);
            const autor = faker.person.fullName();
            const genero = faker.helpers.arrayElement(['Fiction', 'Non-Fiction', 'Science', 'Fantasy', 'History']);
            const descricao = faker.lorem.sentences(2);
            await Livro.create({
                titulo,
                autor,
                genero,
                descricao,
            });
        }

        res.json({ message: 'Banco de dados populado com sucesso' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Iniciar Servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
