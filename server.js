const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8282;
const JWT_SECRET = process.env.JWT_SECRET || 'travel_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuração de cache para arquivos estáticos (desabilitar cache para evitar problemas de atualização)
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Apenas imagens são permitidas!'), false);
        }
    }
});

// Conectar ao banco SQLite
const dbPath = path.join(__dirname, 'database', 'travel.db');
const dbDir = path.dirname(dbPath);

// Rota de Diagnóstico de Versão
app.get('/api/version', (req, res) => {
    res.json({ 
        version: '2.0', 
        timestamp: new Date().toISOString(),
        message: 'Versão com correção de datas e cache busting' 
    });
});

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar com o banco:', err.message);
    } else {
        console.log('Conectado ao banco SQLite.');
        initializeDatabase();
    }
});

// Inicializar estrutura do banco
function initializeDatabase() {
    console.log('Verificando estrutura do banco...');
    
    // Habilitar foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Verificar se as tabelas existem
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, row) => {
        if (err) {
            console.error('Erro ao verificar tabelas:', err.message);
            console.log('\n⚠️  ERRO: Execute primeiro o comando: node setup-database.js');
            process.exit(1);
        }
        
        if (!row) {
            console.log('\n⚠️  BANCO NÃO INICIALIZADO!');
            console.log('Execute primeiro: node setup-database.js');
            console.log('Depois execute: node server.js\n');
            process.exit(1);
        } else {
            console.log('✓ Banco de dados verificado e pronto!');
        }
    });
}

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token inválido ou expirado' });
        req.user = user;
        next();
    });
}

// Middleware para verificar se é admin
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' });
    }
    next();
}

// Rotas de autenticação
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Erro no servidor' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        bcrypt.compare(password, user.password, (err, result) => {
            if (err || !result) {
                return res.status(401).json({ error: 'Senha incorreta' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    name: user.name
                }
            });
        });
    });
});

app.post('/api/guest-login', (req, res) => {
    const token = jwt.sign(
        { id: 0, username: 'guest', role: 'guest' },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        token,
        user: {
            id: 0,
            username: 'guest',
            role: 'guest',
            name: 'Convidado'
        }
    });
});

// Rotas de viagens
app.get('/api/trips', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM trips ORDER BY created_at DESC`, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/trips', authenticateToken, requireAdmin, (req, res) => {
    const {
        main_destination, main_reason, other_destinations, companions,
        distance, fuel_consumption, start_date, end_date, initial_cash
    } = req.body;

    let estimated_fuel_cost = null;
    if (distance && fuel_consumption) {
        const fuelNeeded = distance / fuel_consumption;
        const fuelPrice = 5.50; // Preço médio da gasolina
        estimated_fuel_cost = fuelNeeded * fuelPrice;
    }

    db.run(`INSERT INTO trips (
        main_destination, main_reason, other_destinations, companions,
        distance, fuel_consumption, estimated_fuel_cost, start_date, end_date,
        initial_cash, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [main_destination, main_reason, other_destinations, companions,
         distance, fuel_consumption, estimated_fuel_cost, start_date, end_date,
         initial_cash, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Viagem criada com sucesso' });
        }
    );
});

app.put('/api/trips/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const {
        main_destination, main_reason, other_destinations, companions,
        distance, fuel_consumption, start_date, end_date, initial_cash, status
    } = req.body;

    let estimated_fuel_cost = null;
    if (distance && fuel_consumption) {
        const fuelNeeded = distance / fuel_consumption;
        const fuelPrice = 5.50;
        estimated_fuel_cost = fuelNeeded * fuelPrice;
    }

    db.run(`UPDATE trips SET
        main_destination = ?, main_reason = ?, other_destinations = ?, companions = ?,
        distance = ?, fuel_consumption = ?, estimated_fuel_cost = ?, start_date = ?,
        end_date = ?, initial_cash = ?, status = ?
        WHERE id = ?`,
        [main_destination, main_reason, other_destinations, companions,
         distance, fuel_consumption, estimated_fuel_cost, start_date, end_date,
         initial_cash, status || 'planned', id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Viagem atualizada com sucesso' });
        }
    );
});

app.delete('/api/trips/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM trips WHERE id = ?`, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Viagem excluída com sucesso' });
    });
});

// Rotas de despesas
app.get('/api/expenses', authenticateToken, (req, res) => {
    const query = `
        SELECT e.*, c.name as category_name, pt.name as payment_type_name,
               t.main_destination as trip_destination
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        JOIN payment_types pt ON e.payment_type_id = pt.id
        JOIN trips t ON e.trip_id = t.id
        ORDER BY e.created_at DESC
    `;

    db.all(query, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/expenses', authenticateToken, upload.single('receipt'), (req, res) => {
    const {
        trip_id, category_id, payment_type_id, amount, description, date
    } = req.body;

    const receipt_path = req.file ? req.file.filename : null;

    db.run(`INSERT INTO expenses (
        trip_id, category_id, payment_type_id, amount, description, date, receipt_path, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [trip_id, category_id, payment_type_id, amount, description, date, receipt_path, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Despesa criada com sucesso' });
        }
    );
});

app.put('/api/expenses/:id', authenticateToken, requireAdmin, upload.single('receipt'), (req, res) => {
    const { id } = req.params;
    const {
        trip_id, category_id, payment_type_id, amount, description, date
    } = req.body;

    let query = `UPDATE expenses SET
        trip_id = ?, category_id = ?, payment_type_id = ?, amount = ?, description = ?, date = ?`;
    let params = [trip_id, category_id, payment_type_id, amount, description, date];

    if (req.file) {
        query += `, receipt_path = ?`;
        params.push(req.file.filename);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    db.run(query, params, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Despesa atualizada com sucesso' });
    });
});

app.delete('/api/expenses/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    db.run(`DELETE FROM expenses WHERE id = ?`, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: 'Despesa excluída com sucesso' });
    });
});

// Rotas de categorias
app.get('/api/categories', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM categories ORDER BY name`, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/categories', authenticateToken, requireAdmin, (req, res) => {
    const { name, icon } = req.body;

    db.run(`INSERT INTO categories (name, icon) VALUES (?, ?)`,
        [name, icon],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Categoria criada com sucesso' });
        }
    );
});

app.put('/api/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, icon } = req.body;

    db.run(`UPDATE categories SET name = ?, icon = ? WHERE id = ?`,
        [name, icon, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Categoria atualizada com sucesso' });
        }
    );
});

app.delete('/api/categories/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    // Primeiro verificar se há despesas usando esta categoria
    db.get(`SELECT COUNT(*) as count FROM expenses WHERE category_id = ?`, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (row.count > 0) {
            return res.status(400).json({ 
                error: `Não é possível excluir esta categoria. Existem ${row.count} despesa(s) cadastrada(s) com esta categoria.` 
            });
        }

        // Se não há despesas, pode excluir
        db.run(`DELETE FROM categories WHERE id = ?`, [id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Categoria excluída com sucesso' });
        });
    });
});

// Rotas de tipos de pagamento
app.get('/api/payment-types', authenticateToken, (req, res) => {
    db.all(`SELECT * FROM payment_types ORDER BY name`, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.post('/api/payment-types', authenticateToken, requireAdmin, (req, res) => {
    const { name, icon } = req.body;

    db.run(`INSERT INTO payment_types (name, icon) VALUES (?, ?)`,
        [name, icon],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: 'Tipo de pagamento criado com sucesso' });
        }
    );
});

app.put('/api/payment-types/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;
    const { name, icon } = req.body;

    db.run(`UPDATE payment_types SET name = ?, icon = ? WHERE id = ?`,
        [name, icon, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Tipo de pagamento atualizado com sucesso' });
        }
    );
});

app.delete('/api/payment-types/:id', authenticateToken, requireAdmin, (req, res) => {
    const { id } = req.params;

    // Primeiro verificar se há despesas usando este tipo de pagamento
    db.get(`SELECT COUNT(*) as count FROM expenses WHERE payment_type_id = ?`, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (row.count > 0) {
            return res.status(400).json({ 
                error: `Não é possível excluir este tipo de pagamento. Existem ${row.count} despesa(s) cadastrada(s) com este tipo de pagamento.` 
            });
        }

        // Se não há despesas, pode excluir
        db.run(`DELETE FROM payment_types WHERE id = ?`, [id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Tipo de pagamento excluído com sucesso' });
        });
    });
});

// Rota para servir imagens de recibos
app.get('/api/receipts/:filename', authenticateToken, (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'uploads', filename);
    
    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).json({ error: 'Arquivo não encontrado' });
    }
});

// Rota para relatórios
app.get('/api/reports/summary', authenticateToken, (req, res) => {
    const queries = {
        totalTrips: `SELECT COUNT(*) as count FROM trips`,
        activeTrips: `SELECT COUNT(*) as count FROM trips WHERE status = 'active'`,
        completedTrips: `SELECT COUNT(*) as count FROM trips WHERE status = 'completed'`,
        totalExpenses: `SELECT COALESCE(SUM(amount), 0) as total FROM expenses`
    };

    const results = {};
    let completed = 0;
    const total = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
        db.get(query, (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            
            results[key] = key === 'totalExpenses' ? row.total : row.count;
            completed++;
            
            if (completed === total) {
                results.averageExpensePerTrip = results.totalTrips > 0 ? 
                    results.totalExpenses / results.totalTrips : 0;
                res.json(results);
            }
        });
    });
});

app.get('/api/reports/trip/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    
    const tripQuery = `SELECT * FROM trips WHERE id = ?`;
    const expensesQuery = `
        SELECT e.*, c.name as category_name, pt.name as payment_type_name
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        JOIN payment_types pt ON e.payment_type_id = pt.id
        WHERE e.trip_id = ?
    `;

    db.get(tripQuery, [id], (err, trip) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        
        if (!trip) {
            return res.status(404).json({ error: 'Viagem não encontrada' });
        }

        db.all(expensesQuery, [id], (err, expenses) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
            const cashExpenses = expenses
                .filter(expense => expense.payment_type_name === 'Dinheiro')
                .reduce((sum, expense) => sum + expense.amount, 0);
            
            const remainingCash = trip.initial_cash - cashExpenses;
            
            const expensesByCategory = {};
            const expensesByPaymentType = {};
            
            expenses.forEach(expense => {
                expensesByCategory[expense.category_name] = 
                    (expensesByCategory[expense.category_name] || 0) + expense.amount;
                expensesByPaymentType[expense.payment_type_name] = 
                    (expensesByPaymentType[expense.payment_type_name] || 0) + expense.amount;
            });

            res.json({
                trip,
                totalExpenses,
                cashExpenses,
                remainingCash,
                expensesByCategory,
                expensesByPaymentType,
                expensesCount: expenses.length
            });
        });
    });
});

// Servir arquivos estáticos
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://0.0.0.0:${PORT}`);
    console.log(`Acesso local: http://localhost:${PORT}`);
    console.log(`Acesso na rede: http://192.168.100.117:${PORT}`);
});

// Fechar banco ao encerrar aplicação
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Conexão com banco fechada.');
        process.exit(0);
    });
});