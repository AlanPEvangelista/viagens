const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

// Criar diretório do banco se não existir
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'travel.db');

console.log('Inicializando banco de dados...');
console.log('Caminho do banco:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar com o banco:', err.message);
        process.exit(1);
    } else {
        console.log('Conectado ao banco SQLite.');
        checkExistingData();
    }
});

function checkExistingData() {
    // Verificar se já existem dados
    db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='categories'", (err, row) => {
        if (err || !row) {
            initializeDatabase();
            return;
        }
        
        db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
            if (err) {
                initializeDatabase();
                return;
            }
            
            if (row && row.count > 0) {
                console.log('⚠️  Dados já existem no banco!');
                console.log('Deseja limpar e recriar? (y/N)');
                
                // Para automação, vamos limpar duplicatas
                cleanDuplicates();
            } else {
                initializeDatabase();
            }
        });
    });
}

function cleanDuplicates() {
    console.log('Limpando duplicatas...');
    
    // Limpar duplicatas de categorias
    db.run(`DELETE FROM categories WHERE id NOT IN (
        SELECT MIN(id) FROM categories GROUP BY name
    )`, (err) => {
        if (err) {
            console.error('Erro ao limpar categorias:', err.message);
        } else {
            console.log('✓ Duplicatas de categorias removidas');
        }
        
        // Limpar duplicatas de tipos de pagamento
        db.run(`DELETE FROM payment_types WHERE id NOT IN (
            SELECT MIN(id) FROM payment_types GROUP BY name
        )`, (err) => {
            if (err) {
                console.error('Erro ao limpar tipos de pagamento:', err.message);
            } else {
                console.log('✓ Duplicatas de tipos de pagamento removidas');
            }
            
            finishSetup();
        });
    });
}

function initializeDatabase() {
    console.log('Criando tabelas...');

    // Habilitar foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Criar tabelas em sequência
    const tables = [
        {
            name: 'users',
            sql: `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'guest',
                name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        },
        {
            name: 'categories',
            sql: `CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        },
        {
            name: 'payment_types',
            sql: `CREATE TABLE IF NOT EXISTS payment_types (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                icon TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        },
        {
            name: 'trips',
            sql: `CREATE TABLE IF NOT EXISTS trips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                main_destination TEXT NOT NULL,
                main_reason TEXT NOT NULL,
                other_destinations TEXT,
                companions TEXT,
                distance REAL,
                fuel_consumption REAL,
                estimated_fuel_cost REAL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                initial_cash REAL NOT NULL,
                status TEXT DEFAULT 'planned',
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES users (id)
            )`
        },
        {
            name: 'expenses',
            sql: `CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                trip_id INTEGER NOT NULL,
                category_id INTEGER NOT NULL,
                payment_type_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                description TEXT NOT NULL,
                date DATE NOT NULL,
                receipt_path TEXT,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories (id),
                FOREIGN KEY (payment_type_id) REFERENCES payment_types (id),
                FOREIGN KEY (created_by) REFERENCES users (id)
            )`
        }
    ];

    let completed = 0;
    const total = tables.length;

    tables.forEach(table => {
        db.run(table.sql, (err) => {
            if (err) {
                console.error(`Erro ao criar tabela ${table.name}:`, err.message);
                process.exit(1);
            } else {
                console.log(`✓ Tabela ${table.name} criada/verificada`);
                completed++;
                
                if (completed === total) {
                    insertDefaultData();
                }
            }
        });
    });
}

function insertDefaultData() {
    console.log('Inserindo dados padrão...');

    // Inserir usuários padrão
    const defaultUsers = [
        { username: 'admin', password: 'admin123', role: 'admin', name: 'Administrador' },
        { username: 'guest', password: 'guest123', role: 'guest', name: 'Convidado' }
    ];

    let usersCompleted = 0;
    defaultUsers.forEach(user => {
        bcrypt.hash(user.password, 10, (err, hash) => {
            if (err) {
                console.error('Erro ao criptografar senha:', err);
                return;
            }

            db.run(`INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)`,
                [user.username, hash, user.role, user.name],
                function(err) {
                    if (err) {
                        console.error(`Erro ao inserir usuário ${user.username}:`, err.message);
                    } else if (this.changes > 0) {
                        console.log(`✓ Usuário ${user.username} criado`);
                    } else {
                        console.log(`- Usuário ${user.username} já existe`);
                    }
                    
                    usersCompleted++;
                    if (usersCompleted === defaultUsers.length) {
                        insertCategories();
                    }
                }
            );
        });
    });
}

function insertCategories() {
    // Categorias padrão
    const defaultCategories = [
        { name: 'Combustível', icon: 'fas fa-gas-pump' },
        { name: 'Alimentação', icon: 'fas fa-utensils' },
        { name: 'Hospedagem', icon: 'fas fa-bed' },
        { name: 'Transporte', icon: 'fas fa-car' },
        { name: 'Entretenimento', icon: 'fas fa-ticket-alt' },
        { name: 'Compras', icon: 'fas fa-shopping-bag' },
        { name: 'Outros', icon: 'fas fa-ellipsis-h' }
    ];

    let categoriesCompleted = 0;
    defaultCategories.forEach(category => {
        db.run(`INSERT OR IGNORE INTO categories (name, icon) VALUES (?, ?)`,
            [category.name, category.icon],
            function(err) {
                if (err) {
                    console.error(`Erro ao inserir categoria ${category.name}:`, err.message);
                } else if (this.changes > 0) {
                    console.log(`✓ Categoria ${category.name} criada`);
                } else {
                    console.log(`- Categoria ${category.name} já existe`);
                }
                
                categoriesCompleted++;
                if (categoriesCompleted === defaultCategories.length) {
                    insertPaymentTypes();
                }
            }
        );
    });
}

function insertPaymentTypes() {
    // Tipos de pagamento padrão
    const defaultPaymentTypes = [
        { name: 'Dinheiro', icon: 'fas fa-money-bill-wave' },
        { name: 'Cartão de Crédito', icon: 'fas fa-credit-card' },
        { name: 'Cartão de Débito', icon: 'fas fa-credit-card' },
        { name: 'PIX', icon: 'fas fa-mobile-alt' },
        { name: 'Transferência', icon: 'fas fa-exchange-alt' }
    ];

    let paymentTypesCompleted = 0;
    defaultPaymentTypes.forEach(type => {
        db.run(`INSERT OR IGNORE INTO payment_types (name, icon) VALUES (?, ?)`,
            [type.name, type.icon],
            function(err) {
                if (err) {
                    console.error(`Erro ao inserir tipo de pagamento ${type.name}:`, err.message);
                } else if (this.changes > 0) {
                    console.log(`✓ Tipo de pagamento ${type.name} criado`);
                } else {
                    console.log(`- Tipo de pagamento ${type.name} já existe`);
                }
                
                paymentTypesCompleted++;
                if (paymentTypesCompleted === defaultPaymentTypes.length) {
                    finishSetup();
                }
            }
        );
    });
}

function finishSetup() {
    console.log('\n🎉 Banco de dados verificado/inicializado com sucesso!');
    
    // Mostrar contadores finais
    db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
        if (!err && row) {
            console.log(`📊 Categorias: ${row.count}`);
        }
    });
    
    db.get("SELECT COUNT(*) as count FROM payment_types", (err, row) => {
        if (!err && row) {
            console.log(`💳 Tipos de pagamento: ${row.count}`);
        }
    });
    
    console.log('\nUsuários padrão:');
    console.log('- admin / admin123 (Administrador)');
    console.log('- guest / guest123 (Convidado)');
    
    console.log('\nVocê pode agora executar: node server.js');
    
    db.close((err) => {
        if (err) {
            console.error('Erro ao fechar banco:', err.message);
        } else {
            console.log('Conexão com banco fechada.');
        }
        process.exit(0);
    });
}
