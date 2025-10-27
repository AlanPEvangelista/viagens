// Simulação de banco SQLite usando localStorage
class TravelDatabase {
    constructor() {
        this.initializeDatabase();
    }

    initializeDatabase() {
        // Inicializar estruturas de dados se não existirem
        if (!localStorage.getItem('travel_users')) {
            const defaultUsers = [
                { id: 1, username: 'admin', password: 'admin123', role: 'admin', name: 'Administrador' },
                { id: 2, username: 'guest', password: 'guest123', role: 'guest', name: 'Convidado' }
            ];
            localStorage.setItem('travel_users', JSON.stringify(defaultUsers));
        }

        if (!localStorage.getItem('travel_categories')) {
            const defaultCategories = [
                { id: 1, name: 'Combustível', icon: 'fas fa-gas-pump' },
                { id: 2, name: 'Alimentação', icon: 'fas fa-utensils' },
                { id: 3, name: 'Hospedagem', icon: 'fas fa-bed' },
                { id: 4, name: 'Transporte', icon: 'fas fa-car' },
                { id: 5, name: 'Entretenimento', icon: 'fas fa-ticket-alt' },
                { id: 6, name: 'Compras', icon: 'fas fa-shopping-bag' },
                { id: 7, name: 'Outros', icon: 'fas fa-ellipsis-h' }
            ];
            localStorage.setItem('travel_categories', JSON.stringify(defaultCategories));
        }

        if (!localStorage.getItem('travel_payment_types')) {
            const defaultPaymentTypes = [
                { id: 1, name: 'Dinheiro', icon: 'fas fa-money-bill-wave' },
                { id: 2, name: 'Cartão de Crédito', icon: 'fas fa-credit-card' },
                { id: 3, name: 'Cartão de Débito', icon: 'fas fa-credit-card' },
                { id: 4, name: 'PIX', icon: 'fas fa-mobile-alt' },
                { id: 5, name: 'Transferência', icon: 'fas fa-exchange-alt' }
            ];
            localStorage.setItem('travel_payment_types', JSON.stringify(defaultPaymentTypes));
        }

        // Inicializar outras tabelas vazias
        if (!localStorage.getItem('travel_trips')) {
            localStorage.setItem('travel_trips', JSON.stringify([]));
        }

        if (!localStorage.getItem('travel_expenses')) {
            localStorage.setItem('travel_expenses', JSON.stringify([]));
        }

        if (!localStorage.getItem('travel_receipts')) {
            localStorage.setItem('travel_receipts', JSON.stringify([]));
        }
    }

    // Métodos de usuários
    authenticateUser(username, password) {
        const users = JSON.parse(localStorage.getItem('travel_users') || '[]');
        return users.find(user => user.username === username && user.password === password);
    }

    // Métodos de viagens
    createTrip(tripData) {
        const trips = JSON.parse(localStorage.getItem('travel_trips') || '[]');
        const newTrip = {
            id: Date.now(),
            ...tripData,
            status: 'planned',
            createdAt: new Date().toISOString(),
            createdBy: this.getCurrentUser()?.id
        };
        
        // Calcular gasto estimado com combustível
        if (tripData.distance && tripData.fuelConsumption) {
            const fuelNeeded = tripData.distance / tripData.fuelConsumption;
            // Preço médio da gasolina (pode ser configurável)
            const fuelPrice = 5.50;
            newTrip.estimatedFuelCost = fuelNeeded * fuelPrice;
        }
        
        trips.push(newTrip);
        localStorage.setItem('travel_trips', JSON.stringify(trips));
        return newTrip;
    }

    getTrips() {
        return JSON.parse(localStorage.getItem('travel_trips') || '[]');
    }

    getTripById(id) {
        const trips = this.getTrips();
        return trips.find(trip => trip.id === parseInt(id));
    }

    updateTrip(id, updates) {
        const trips = this.getTrips();
        const index = trips.findIndex(trip => trip.id === parseInt(id));
        if (index !== -1) {
            trips[index] = { ...trips[index], ...updates };
            localStorage.setItem('travel_trips', JSON.stringify(trips));
            return trips[index];
        }
        return null;
    }

    deleteTrip(id) {
        const trips = this.getTrips();
        const filteredTrips = trips.filter(trip => trip.id !== parseInt(id));
        localStorage.setItem('travel_trips', JSON.stringify(filteredTrips));
        
        // Também deletar despesas relacionadas
        const expenses = this.getExpenses();
        const filteredExpenses = expenses.filter(expense => expense.tripId !== parseInt(id));
        localStorage.setItem('travel_expenses', JSON.stringify(filteredExpenses));
    }

    // Métodos de despesas
    createExpense(expenseData) {
        const expenses = JSON.parse(localStorage.getItem('travel_expenses') || '[]');
        const newExpense = {
            id: Date.now(),
            ...expenseData,
            createdAt: new Date().toISOString(),
            createdBy: this.getCurrentUser()?.id
        };
        
        expenses.push(newExpense);
        localStorage.setItem('travel_expenses', JSON.stringify(expenses));
        return newExpense;
    }

    getExpenses() {
        return JSON.parse(localStorage.getItem('travel_expenses') || '[]');
    }

    getExpensesByTrip(tripId) {
        const expenses = this.getExpenses();
        return expenses.filter(expense => expense.tripId === parseInt(tripId));
    }

    updateExpense(id, updates) {
        const expenses = this.getExpenses();
        const index = expenses.findIndex(expense => expense.id === parseInt(id));
        if (index !== -1) {
            expenses[index] = { ...expenses[index], ...updates };
            localStorage.setItem('travel_expenses', JSON.stringify(expenses));
            return expenses[index];
        }
        return null;
    }

    deleteExpense(id) {
        const expenses = this.getExpenses();
        const filteredExpenses = expenses.filter(expense => expense.id !== parseInt(id));
        localStorage.setItem('travel_expenses', JSON.stringify(filteredExpenses));
    }

    // Métodos de categorias
    getCategories() {
        return JSON.parse(localStorage.getItem('travel_categories') || '[]');
    }

    createCategory(categoryData) {
        const categories = this.getCategories();
        const newCategory = {
            id: Date.now(),
            ...categoryData
        };
        categories.push(newCategory);
        localStorage.setItem('travel_categories', JSON.stringify(categories));
        return newCategory;
    }

    updateCategory(id, updates) {
        const categories = this.getCategories();
        const index = categories.findIndex(category => category.id === parseInt(id));
        if (index !== -1) {
            categories[index] = { ...categories[index], ...updates };
            localStorage.setItem('travel_categories', JSON.stringify(categories));
            return categories[index];
        }
        return null;
    }

    deleteCategory(id) {
        const categories = this.getCategories();
        const filteredCategories = categories.filter(category => category.id !== parseInt(id));
        localStorage.setItem('travel_categories', JSON.stringify(filteredCategories));
    }

    // Métodos de tipos de pagamento
    getPaymentTypes() {
        return JSON.parse(localStorage.getItem('travel_payment_types') || '[]');
    }

    createPaymentType(paymentTypeData) {
        const paymentTypes = this.getPaymentTypes();
        const newPaymentType = {
            id: Date.now(),
            ...paymentTypeData
        };
        paymentTypes.push(newPaymentType);
        localStorage.setItem('travel_payment_types', JSON.stringify(paymentTypes));
        return newPaymentType;
    }

    updatePaymentType(id, updates) {
        const paymentTypes = this.getPaymentTypes();
        const index = paymentTypes.findIndex(type => type.id === parseInt(id));
        if (index !== -1) {
            paymentTypes[index] = { ...paymentTypes[index], ...updates };
            localStorage.setItem('travel_payment_types', JSON.stringify(paymentTypes));
            return paymentTypes[index];
        }
        return null;
    }

    deletePaymentType(id) {
        const paymentTypes = this.getPaymentTypes();
        const filteredTypes = paymentTypes.filter(type => type.id !== parseInt(id));
        localStorage.setItem('travel_payment_types', JSON.stringify(filteredTypes));
    }

    // Métodos de recibos
    saveReceipt(expenseId, imageData) {
        const receipts = JSON.parse(localStorage.getItem('travel_receipts') || '[]');
        const newReceipt = {
            id: Date.now(),
            expenseId: parseInt(expenseId),
            imageData: imageData,
            createdAt: new Date().toISOString()
        };
        receipts.push(newReceipt);
        localStorage.setItem('travel_receipts', JSON.stringify(receipts));
        return newReceipt;
    }

    getReceiptByExpenseId(expenseId) {
        const receipts = JSON.parse(localStorage.getItem('travel_receipts') || '[]');
        return receipts.find(receipt => receipt.expenseId === parseInt(expenseId));
    }

    // Métodos de sessão
    setCurrentUser(user) {
        localStorage.setItem('current_user', JSON.stringify(user));
    }

    getCurrentUser() {
        const user = localStorage.getItem('current_user');
        return user ? JSON.parse(user) : null;
    }

    logout() {
        localStorage.removeItem('current_user');
    }

    // Métodos de relatórios
    getTripSummary(tripId) {
        const trip = this.getTripById(tripId);
        const expenses = this.getExpensesByTrip(tripId);
        
        if (!trip) return null;

        const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        const cashExpenses = expenses
            .filter(expense => expense.paymentType === 'Dinheiro')
            .reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        
        const remainingCash = parseFloat(trip.initialCash) - cashExpenses;
        
        const expensesByCategory = {};
        const expensesByPaymentType = {};
        
        expenses.forEach(expense => {
            // Por categoria
            if (!expensesByCategory[expense.category]) {
                expensesByCategory[expense.category] = 0;
            }
            expensesByCategory[expense.category] += parseFloat(expense.amount);
            
            // Por tipo de pagamento
            if (!expensesByPaymentType[expense.paymentType]) {
                expensesByPaymentType[expense.paymentType] = 0;
            }
            expensesByPaymentType[expense.paymentType] += parseFloat(expense.amount);
        });

        return {
            trip,
            totalExpenses,
            cashExpenses,
            remainingCash,
            expensesByCategory,
            expensesByPaymentType,
            expensesCount: expenses.length
        };
    }

    getOverallSummary() {
        const trips = this.getTrips();
        const expenses = this.getExpenses();
        
        const totalTrips = trips.length;
        const totalExpenses = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        const activeTrips = trips.filter(trip => trip.status === 'active').length;
        const completedTrips = trips.filter(trip => trip.status === 'completed').length;
        
        return {
            totalTrips,
            totalExpenses,
            activeTrips,
            completedTrips,
            averageExpensePerTrip: totalTrips > 0 ? totalExpenses / totalTrips : 0
        };
    }
}

// Instância global do banco de dados
const db = new TravelDatabase();