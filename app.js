// Aplicação principal
class TravelApp {
    constructor() {
        this.currentUser = null;
        this.currentTrip = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
    }

    bindEvents() {
        // Login
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('guestLoginBtn').addEventListener('click', () => this.handleGuestLogin());
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());

        // Navegação
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Modais
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                this.closeModal(modal.id);
            });
        });

        // Botões principais
        document.getElementById('newTripBtn').addEventListener('click', () => this.openTripModal());
        document.getElementById('newExpenseBtn').addEventListener('click', () => this.openExpenseModal());

        // Formulários
        document.getElementById('tripForm').addEventListener('submit', (e) => this.handleTripSubmit(e));
        document.getElementById('expenseForm').addEventListener('submit', (e) => this.handleExpenseSubmit(e));

        // Preview de recibo
        document.getElementById('expenseReceipt').addEventListener('change', (e) => this.handleReceiptPreview(e));

        // Filtros
        document.getElementById('tripFilter').addEventListener('change', () => this.loadExpenses());
        document.getElementById('categoryFilter').addEventListener('change', () => this.loadExpenses());
    }

    checkAuthStatus() {
        const user = db.getCurrentUser();
        if (user) {
            this.currentUser = user;
            this.showDashboard();
        } else {
            this.showLogin();
        }
    }

    handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const user = db.authenticateUser(username, password);
        if (user) {
            this.currentUser = user;
            db.setCurrentUser(user);
            this.showDashboard();
        } else {
            alert('Usuário ou senha inválidos!');
        }
    }

    handleGuestLogin() {
        const guestUser = { id: 0, username: 'guest', role: 'guest', name: 'Convidado' };
        this.currentUser = guestUser;
        db.setCurrentUser(guestUser);
        this.showDashboard();
    }

    handleLogout() {
        db.logout();
        this.currentUser = null;
        this.showLogin();
    }

    showLogin() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('dashboardScreen').classList.remove('active');
    }

    showDashboard() {
        document.getElementById('loginScreen').classList.remove('active');
        document.getElementById('dashboardScreen').classList.add('active');
        
        // Mostrar nome do usuário
        document.getElementById('currentUser').textContent = this.currentUser.name;
        
        // Mostrar/ocultar elementos admin
        if (this.currentUser.role === 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.add('show'));
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('show'));
        }

        // Carregar dados iniciais
        this.loadTrips();
        this.loadExpenses();
        this.loadReports();
        this.loadAdminData();
        this.populateFilters();
    }

    switchTab(tabName) {
        // Atualizar navegação
        document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Mostrar conteúdo
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(`${tabName}Tab`).classList.add('active');

        // Recarregar dados se necessário
        switch(tabName) {
            case 'trips':
                this.loadTrips();
                break;
            case 'expenses':
                this.loadExpenses();
                break;
            case 'reports':
                this.loadReports();
                break;
            case 'admin':
                this.loadAdminData();
                break;
        }
    }

    // Gerenciamento de Viagens
    loadTrips() {
        const trips = db.getTrips();
        const container = document.getElementById('tripsList');
        
        if (trips.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhuma viagem cadastrada ainda.</p>';
            return;
        }

        container.innerHTML = trips.map(trip => this.createTripCard(trip)).join('');
    }

    createTripCard(trip) {
        const summary = db.getTripSummary(trip.id);
        const statusClass = trip.status === 'active' ? 'active' : trip.status === 'completed' ? 'completed' : 'planned';
        const statusText = trip.status === 'active' ? 'Em Andamento' : trip.status === 'completed' ? 'Concluída' : 'Planejada';

        return `
            <div class="trip-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <h3>${trip.mainDestination}</h3>
                    <span class="status ${statusClass}">${statusText}</span>
                </div>
                
                <div class="trip-info">
                    <div class="info-item">
                        <span class="info-label">Motivo</span>
                        <span class="info-value">${trip.mainReason}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Período</span>
                        <span class="info-value">${this.formatDate(trip.startDate)} - ${this.formatDate(trip.endDate)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Distância</span>
                        <span class="info-value">${trip.distance || 'N/A'} km</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Saldo Inicial</span>
                        <span class="info-value">R$ ${parseFloat(trip.initialCash).toFixed(2)}</span>
                    </div>
                    ${summary ? `
                    <div class="info-item">
                        <span class="info-label">Total Gasto</span>
                        <span class="info-value">R$ ${summary.totalExpenses.toFixed(2)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Dinheiro Restante</span>
                        <span class="info-value ${summary.remainingCash < 0 ? 'text-danger' : 'text-success'}">
                            R$ ${summary.remainingCash.toFixed(2)}
                        </span>
                    </div>
                    ` : ''}
                </div>

                ${trip.companions ? `
                <div class="info-item mb-20">
                    <span class="info-label">Acompanhantes</span>
                    <span class="info-value">${trip.companions}</span>
                </div>
                ` : ''}

                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="app.viewTripDetails(${trip.id})">
                        <i class="fas fa-eye"></i> Ver Detalhes
                    </button>
                    ${this.currentUser.role === 'admin' ? `
                    <button class="btn btn-secondary" onclick="app.editTrip(${trip.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-outline" onclick="app.toggleTripStatus(${trip.id})">
                        <i class="fas fa-${trip.status === 'active' ? 'stop' : 'play'}"></i> 
                        ${trip.status === 'active' ? 'Finalizar' : 'Iniciar'}
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteTrip(${trip.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    openTripModal(trip = null) {
        const modal = document.getElementById('tripModal');
        const form = document.getElementById('tripForm');
        
        if (trip) {
            // Edição
            document.querySelector('#tripModal .modal-header h3').textContent = 'Editar Viagem';
            document.getElementById('mainDestination').value = trip.mainDestination;
            document.getElementById('mainReason').value = trip.mainReason;
            document.getElementById('otherDestinations').value = trip.otherDestinations || '';
            document.getElementById('companions').value = trip.companions || '';
            document.getElementById('distance').value = trip.distance || '';
            document.getElementById('fuelConsumption').value = trip.fuelConsumption || '';
            document.getElementById('startDate').value = trip.startDate;
            document.getElementById('endDate').value = trip.endDate;
            document.getElementById('initialCash').value = trip.initialCash;
            form.dataset.editId = trip.id;
        } else {
            // Criação
            document.querySelector('#tripModal .modal-header h3').textContent = 'Nova Viagem';
            form.reset();
            delete form.dataset.editId;
        }
        
        this.openModal('tripModal');
    }

    handleTripSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData(form);
        
        const tripData = {
            mainDestination: document.getElementById('mainDestination').value,
            mainReason: document.getElementById('mainReason').value,
            otherDestinations: document.getElementById('otherDestinations').value,
            companions: document.getElementById('companions').value,
            distance: parseFloat(document.getElementById('distance').value) || null,
            fuelConsumption: parseFloat(document.getElementById('fuelConsumption').value) || null,
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value,
            initialCash: parseFloat(document.getElementById('initialCash').value)
        };

        if (form.dataset.editId) {
            // Editar
            db.updateTrip(form.dataset.editId, tripData);
        } else {
            // Criar
            db.createTrip(tripData);
        }

        this.closeModal('tripModal');
        this.loadTrips();
        this.populateFilters();
    }

    toggleTripStatus(tripId) {
        const trip = db.getTripById(tripId);
        const newStatus = trip.status === 'active' ? 'completed' : 'active';
        db.updateTrip(tripId, { status: newStatus });
        this.loadTrips();
    }

    deleteTrip(tripId) {
        if (confirm('Tem certeza que deseja excluir esta viagem? Todas as despesas relacionadas também serão excluídas.')) {
            db.deleteTrip(tripId);
            this.loadTrips();
            this.loadExpenses();
            this.populateFilters();
        }
    }

    editTrip(tripId) {
        const trip = db.getTripById(tripId);
        this.openTripModal(trip);
    }

    viewTripDetails(tripId) {
        // Implementar visualização detalhada da viagem
        const trip = db.getTripById(tripId);
        const summary = db.getTripSummary(tripId);
        
        alert(`Detalhes da Viagem: ${trip.mainDestination}\n\nTotal de Despesas: R$ ${summary.totalExpenses.toFixed(2)}\nDinheiro Restante: R$ ${summary.remainingCash.toFixed(2)}\nNúmero de Despesas: ${summary.expensesCount}`);
    }

    // Gerenciamento de Despesas
    loadExpenses() {
        let expenses = db.getExpenses();
        
        // Aplicar filtros
        const tripFilter = document.getElementById('tripFilter').value;
        const categoryFilter = document.getElementById('categoryFilter').value;
        
        if (tripFilter) {
            expenses = expenses.filter(expense => expense.tripId === parseInt(tripFilter));
        }
        
        if (categoryFilter) {
            expenses = expenses.filter(expense => expense.category === categoryFilter);
        }

        const container = document.getElementById('expensesList');
        
        if (expenses.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhuma despesa encontrada.</p>';
            return;
        }

        container.innerHTML = expenses.map(expense => this.createExpenseCard(expense)).join('');
    }

    createExpenseCard(expense) {
        const trip = db.getTripById(expense.tripId);
        const receipt = db.getReceiptByExpenseId(expense.id);
        
        return `
            <div class="expense-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <h3>${expense.description}</h3>
                    <span class="info-value" style="font-size: 1.2rem; font-weight: bold; color: var(--accent-red);">
                        R$ ${parseFloat(expense.amount).toFixed(2)}
                    </span>
                </div>
                
                <div class="expense-info">
                    <div class="info-item">
                        <span class="info-label">Viagem</span>
                        <span class="info-value">${trip ? trip.mainDestination : 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Categoria</span>
                        <span class="info-value">${expense.category}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Pagamento</span>
                        <span class="info-value">${expense.paymentType}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Data</span>
                        <span class="info-value">${this.formatDate(expense.date)}</span>
                    </div>
                </div>

                ${receipt ? `
                <div class="info-item mb-20">
                    <span class="info-label">Recibo</span>
                    <img src="${receipt.imageData}" alt="Recibo" style="max-width: 200px; max-height: 150px; border-radius: 8px; margin-top: 10px;">
                </div>
                ` : ''}

                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${this.currentUser.role === 'admin' ? `
                    <button class="btn btn-secondary" onclick="app.editExpense(${expense.id})">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-danger" onclick="app.deleteExpense(${expense.id})">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    openExpenseModal(expense = null) {
        const modal = document.getElementById('expenseModal');
        const form = document.getElementById('expenseForm');
        
        // Popular selects
        this.populateExpenseSelects();
        
        if (expense) {
            // Edição
            document.querySelector('#expenseModal .modal-header h3').textContent = 'Editar Despesa';
            document.getElementById('expenseTripId').value = expense.tripId;
            document.getElementById('expenseCategory').value = expense.category;
            document.getElementById('expenseAmount').value = expense.amount;
            document.getElementById('expensePaymentType').value = expense.paymentType;
            document.getElementById('expenseDescription').value = expense.description;
            document.getElementById('expenseDate').value = expense.date;
            form.dataset.editId = expense.id;
        } else {
            // Criação
            document.querySelector('#expenseModal .modal-header h3').textContent = 'Nova Despesa';
            form.reset();
            document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
            delete form.dataset.editId;
        }
        
        this.openModal('expenseModal');
    }

    populateExpenseSelects() {
        // Popular select de viagens
        const trips = db.getTrips();
        const tripSelect = document.getElementById('expenseTripId');
        tripSelect.innerHTML = '<option value="">Selecione uma viagem</option>' +
            trips.map(trip => `<option value="${trip.id}">${trip.mainDestination} (${this.formatDate(trip.startDate)})</option>`).join('');

        // Popular select de categorias
        const categories = db.getCategories();
        const categorySelect = document.getElementById('expenseCategory');
        categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>' +
            categories.map(category => `<option value="${category.name}">${category.name}</option>`).join('');

        // Popular select de tipos de pagamento
        const paymentTypes = db.getPaymentTypes();
        const paymentSelect = document.getElementById('expensePaymentType');
        paymentSelect.innerHTML = '<option value="">Selecione o tipo de pagamento</option>' +
            paymentTypes.map(type => `<option value="${type.name}">${type.name}</option>`).join('');
    }

    handleExpenseSubmit(e) {
        e.preventDefault();
        const form = e.target;
        
        const expenseData = {
            tripId: parseInt(document.getElementById('expenseTripId').value),
            category: document.getElementById('expenseCategory').value,
            amount: parseFloat(document.getElementById('expenseAmount').value),
            paymentType: document.getElementById('expensePaymentType').value,
            description: document.getElementById('expenseDescription').value,
            date: document.getElementById('expenseDate').value
        };

        let expenseId;
        if (form.dataset.editId) {
            // Editar
            db.updateExpense(form.dataset.editId, expenseData);
            expenseId = form.dataset.editId;
        } else {
            // Criar
            const newExpense = db.createExpense(expenseData);
            expenseId = newExpense.id;
        }

        // Salvar recibo se fornecido
        const receiptFile = document.getElementById('expenseReceipt').files[0];
        if (receiptFile) {
            const reader = new FileReader();
            reader.onload = (e) => {
                db.saveReceipt(expenseId, e.target.result);
            };
            reader.readAsDataURL(receiptFile);
        }

        this.closeModal('expenseModal');
        this.loadExpenses();
        this.loadTrips(); // Atualizar resumos das viagens
    }

    handleReceiptPreview(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('receiptPreview');
        
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview do recibo" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-top: 10px;">`;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = '';
        }
    }

    editExpense(expenseId) {
        const expense = db.getExpenses().find(e => e.id === expenseId);
        this.openExpenseModal(expense);
    }

    deleteExpense(expenseId) {
        if (confirm('Tem certeza que deseja excluir esta despesa?')) {
            db.deleteExpense(expenseId);
            this.loadExpenses();
            this.loadTrips(); // Atualizar resumos das viagens
        }
    }

    // Relatórios
    loadReports() {
        const summary = db.getOverallSummary();
        const container = document.getElementById('financialSummary');
        
        container.innerHTML = `
            <div class="expense-info">
                <div class="info-item">
                    <span class="info-label">Total de Viagens</span>
                    <span class="info-value">${summary.totalTrips}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Viagens Ativas</span>
                    <span class="info-value">${summary.activeTrips}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Viagens Concluídas</span>
                    <span class="info-value">${summary.completedTrips}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Total de Gastos</span>
                    <span class="info-value">R$ ${summary.totalExpenses.toFixed(2)}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Média por Viagem</span>
                    <span class="info-value">R$ ${summary.averageExpensePerTrip.toFixed(2)}</span>
                </div>
            </div>
        `;
    }

    // Administração
    loadAdminData() {
        if (this.currentUser.role !== 'admin') return;
        
        this.loadCategoriesManagement();
        this.loadPaymentTypesManagement();
    }

    loadCategoriesManagement() {
        const categories = db.getCategories();
        const container = document.getElementById('categoriesManagement');
        
        container.innerHTML = `
            <div style="margin-bottom: 20px;">
                <button class="btn btn-primary" onclick="app.addCategory()">
                    <i class="fas fa-plus"></i> Nova Categoria
                </button>
            </div>
            <div class="categories-list">
                ${categories.map(category => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 10px;">
                        <span><i class="${category.icon}"></i> ${category.name}</span>
                        <div>
                            <button class="btn btn-secondary" onclick="app.editCategory(${category.id})" style="padding: 5px 10px; margin-right: 5px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger" onclick="app.deleteCategory(${category.id})" style="padding: 5px 10px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    loadPaymentTypesManagement() {
        const paymentTypes = db.getPaymentTypes();
        const container = document.getElementById('paymentTypesManagement');
        
        container.innerHTML = `
            <div style="margin-bottom: 20px;">
                <button class="btn btn-primary" onclick="app.addPaymentType()">
                    <i class="fas fa-plus"></i> Novo Tipo de Pagamento
                </button>
            </div>
            <div class="payment-types-list">
                ${paymentTypes.map(type => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border: 1px solid #e9ecef; border-radius: 8px; margin-bottom: 10px;">
                        <span><i class="${type.icon}"></i> ${type.name}</span>
                        <div>
                            <button class="btn btn-secondary" onclick="app.editPaymentType(${type.id})" style="padding: 5px 10px; margin-right: 5px;">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-danger" onclick="app.deletePaymentType(${type.id})" style="padding: 5px 10px;">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    addCategory() {
        const name = prompt('Nome da categoria:');
        const icon = prompt('Classe do ícone (ex: fas fa-car):', 'fas fa-tag');
        
        if (name && icon) {
            db.createCategory({ name, icon });
            this.loadCategoriesManagement();
            this.populateFilters();
        }
    }

    editCategory(categoryId) {
        const category = db.getCategories().find(c => c.id === categoryId);
        const name = prompt('Nome da categoria:', category.name);
        const icon = prompt('Classe do ícone:', category.icon);
        
        if (name && icon) {
            db.updateCategory(categoryId, { name, icon });
            this.loadCategoriesManagement();
            this.populateFilters();
        }
    }

    deleteCategory(categoryId) {
        if (confirm('Tem certeza que deseja excluir esta categoria?')) {
            db.deleteCategory(categoryId);
            this.loadCategoriesManagement();
            this.populateFilters();
        }
    }

    addPaymentType() {
        const name = prompt('Nome do tipo de pagamento:');
        const icon = prompt('Classe do ícone (ex: fas fa-credit-card):', 'fas fa-money-bill');
        
        if (name && icon) {
            db.createPaymentType({ name, icon });
            this.loadPaymentTypesManagement();
        }
    }

    editPaymentType(typeId) {
        const type = db.getPaymentTypes().find(t => t.id === typeId);
        const name = prompt('Nome do tipo de pagamento:', type.name);
        const icon = prompt('Classe do ícone:', type.icon);
        
        if (name && icon) {
            db.updatePaymentType(typeId, { name, icon });
            this.loadPaymentTypesManagement();
        }
    }

    deletePaymentType(typeId) {
        if (confirm('Tem certeza que deseja excluir este tipo de pagamento?')) {
            db.deletePaymentType(typeId);
            this.loadPaymentTypesManagement();
        }
    }

    // Filtros
    populateFilters() {
        // Filtro de viagens
        const trips = db.getTrips();
        const tripFilter = document.getElementById('tripFilter');
        const currentValue = tripFilter.value;
        tripFilter.innerHTML = '<option value="">Todas as viagens</option>' +
            trips.map(trip => `<option value="${trip.id}">${trip.mainDestination} (${this.formatDate(trip.startDate)})</option>`).join('');
        tripFilter.value = currentValue;

        // Filtro de categorias
        const categories = db.getCategories();
        const categoryFilter = document.getElementById('categoryFilter');
        const currentCategoryValue = categoryFilter.value;
        categoryFilter.innerHTML = '<option value="">Todas as categorias</option>' +
            categories.map(category => `<option value="${category.name}">${category.name}</option>`).join('');
        categoryFilter.value = currentCategoryValue;
    }

    // Utilitários
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        // Limpar preview de recibo
        if (modalId === 'expenseModal') {
            document.getElementById('receiptPreview').innerHTML = '';
        }
    }
}

// Função global para fechar modal (usada no HTML)
function closeModal(modalId) {
    app.closeModal(modalId);
}

// Inicializar aplicação
const app = new TravelApp();