// Aplicação principal com integração ao backend
class TravelApp {
    constructor() {
        this.currentUser = null;
        this.token = localStorage.getItem('travel_token');
        this.apiUrl = window.location.origin + '/api';
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

    // Métodos de API
    async apiCall(endpoint, options = {}) {
        const url = `${this.apiUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);

            if (response.status === 401) {
                this.handleLogout();
                return null;
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erro na requisição');
            }

            return await response.json();
        } catch (error) {
            console.error('Erro na API:', error);
            alert('Erro: ' + error.message);
            return null;
        }
    }

    async checkAuthStatus() {
        if (this.token) {
            // Verificar se o token ainda é válido fazendo uma requisição
            const result = await this.apiCall('/trips');
            if (result !== null) {
                // Token válido, decodificar informações do usuário
                try {
                    const payload = JSON.parse(atob(this.token.split('.')[1]));
                    this.currentUser = {
                        id: payload.id,
                        username: payload.username,
                        role: payload.role,
                        name: payload.username === 'guest' ? 'Convidado' : payload.username
                    };
                    this.showDashboard();
                    return;
                } catch (e) {
                    console.error('Erro ao decodificar token:', e);
                }
            }
        }
        this.showLogin();
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const result = await this.apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (result) {
            this.token = result.token;
            this.currentUser = result.user;
            localStorage.setItem('travel_token', this.token);
            this.showDashboard();
        }
    }

    async handleGuestLogin() {
        const result = await this.apiCall('/guest-login', {
            method: 'POST'
        });

        if (result) {
            this.token = result.token;
            this.currentUser = result.user;
            localStorage.setItem('travel_token', this.token);
            this.showDashboard();
        }
    }

    handleLogout() {
        this.token = null;
        this.currentUser = null;
        localStorage.removeItem('travel_token');
        this.showLogin();
    }

    showLogin() {
        document.getElementById('loginScreen').classList.add('active');
        document.getElementById('dashboardScreen').classList.remove('active');
        document.getElementById('loginForm').reset();
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
        switch (tabName) {
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
    async loadTrips() {
        const container = document.getElementById('tripsList');
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Carregando...</div>';

        const trips = await this.apiCall('/trips');
        if (!trips) return;

        if (trips.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhuma viagem cadastrada ainda.</p>';
            return;
        }

        // Carregar resumos das viagens
        const tripsWithSummary = await Promise.all(
            trips.map(async (trip) => {
                const summary = await this.apiCall(`/reports/trip/${trip.id}`);
                return { ...trip, summary };
            })
        );

        container.innerHTML = tripsWithSummary.map(trip => this.createTripCard(trip)).join('');
    }

    createTripCard(trip) {
        const summary = trip.summary;
        const statusClass = trip.status === 'active' ? 'active' : trip.status === 'completed' ? 'completed' : 'planned';
        const statusText = trip.status === 'active' ? 'Em Andamento' : trip.status === 'completed' ? 'Concluída' : 'Planejada';

        return `
            <div class="trip-card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <h3>${trip.main_destination}</h3>
                    <span class="status ${statusClass}">${statusText}</span>
                </div>
                
                <div class="trip-info">
                    <div class="info-item">
                        <span class="info-label">Motivo</span>
                        <span class="info-value">${trip.main_reason}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Período</span>
                        <span class="info-value">${this.formatDate(trip.start_date)} - ${this.formatDate(trip.end_date)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Distância</span>
                        <span class="info-value">${trip.distance || 'N/A'} km</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Saldo Inicial</span>
                        <span class="info-value">R$ ${parseFloat(trip.initial_cash).toFixed(2)}</span>
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
            document.getElementById('mainDestination').value = trip.main_destination;
            document.getElementById('mainReason').value = trip.main_reason;
            document.getElementById('otherDestinations').value = trip.other_destinations || '';
            document.getElementById('companions').value = trip.companions || '';
            document.getElementById('distance').value = trip.distance || '';
            document.getElementById('fuelConsumption').value = trip.fuel_consumption || '';
            document.getElementById('startDate').value = trip.start_date;
            document.getElementById('endDate').value = trip.end_date;
            document.getElementById('initialCash').value = trip.initial_cash;
            form.dataset.editId = trip.id;
        } else {
            // Criação
            document.querySelector('#tripModal .modal-header h3').textContent = 'Nova Viagem';
            form.reset();
            delete form.dataset.editId;
        }

        this.openModal('tripModal');
    }

    async handleTripSubmit(e) {
        e.preventDefault();
        const form = e.target;

        const tripData = {
            main_destination: document.getElementById('mainDestination').value,
            main_reason: document.getElementById('mainReason').value,
            other_destinations: document.getElementById('otherDestinations').value,
            companions: document.getElementById('companions').value,
            distance: parseFloat(document.getElementById('distance').value) || null,
            fuel_consumption: parseFloat(document.getElementById('fuelConsumption').value) || null,
            start_date: document.getElementById('startDate').value,
            end_date: document.getElementById('endDate').value,
            initial_cash: parseFloat(document.getElementById('initialCash').value)
        };

        let result;
        if (form.dataset.editId) {
            // Editar
            result = await this.apiCall(`/trips/${form.dataset.editId}`, {
                method: 'PUT',
                body: JSON.stringify(tripData)
            });
        } else {
            // Criar
            result = await this.apiCall('/trips', {
                method: 'POST',
                body: JSON.stringify(tripData)
            });
        }

        if (result) {
            this.closeModal('tripModal');
            this.loadTrips();
            this.populateFilters();
        }
    }

    async toggleTripStatus(tripId) {
        const trips = await this.apiCall('/trips');
        const trip = trips.find(t => t.id === tripId);
        const newStatus = trip.status === 'active' ? 'completed' : 'active';

        const result = await this.apiCall(`/trips/${tripId}`, {
            method: 'PUT',
            body: JSON.stringify({ ...trip, status: newStatus })
        });

        if (result) {
            this.loadTrips();
        }
    }

    async deleteTrip(tripId) {
        if (confirm('Tem certeza que deseja excluir esta viagem? Todas as despesas relacionadas também serão excluídas.')) {
            const result = await this.apiCall(`/trips/${tripId}`, {
                method: 'DELETE'
            });

            if (result) {
                this.loadTrips();
                this.loadExpenses();
                this.populateFilters();
            }
        }
    }

    async editTrip(tripId) {
        const trips = await this.apiCall('/trips');
        const trip = trips.find(t => t.id === tripId);
        this.openTripModal(trip);
    }

    async viewTripDetails(tripId) {
        const summary = await this.apiCall(`/reports/trip/${tripId}`);
        if (summary) {
            alert(`Detalhes da Viagem: ${summary.trip.main_destination}\n\nTotal de Despesas: R$ ${summary.totalExpenses.toFixed(2)}\nDinheiro Restante: R$ ${summary.remainingCash.toFixed(2)}\nNúmero de Despesas: ${summary.expensesCount}`);
        }
    }

    // Gerenciamento de Despesas
    async loadExpenses() {
        const container = document.getElementById('expensesList');
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Carregando...</div>';

        let expenses = await this.apiCall('/expenses');
        if (!expenses) return;

        // Aplicar filtros
        const tripFilter = document.getElementById('tripFilter').value;
        const categoryFilter = document.getElementById('categoryFilter').value;

        if (tripFilter) {
            expenses = expenses.filter(expense => expense.trip_id === parseInt(tripFilter));
        }

        if (categoryFilter) {
            expenses = expenses.filter(expense => expense.category_name === categoryFilter);
        }

        if (expenses.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhuma despesa encontrada.</p>';
            return;
        }

        container.innerHTML = expenses.map(expense => this.createExpenseCard(expense)).join('');
    }

    createExpenseCard(expense) {
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
                        <span class="info-value">${expense.trip_destination}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Categoria</span>
                        <span class="info-value">${expense.category_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Pagamento</span>
                        <span class="info-value">${expense.payment_type_name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Data</span>
                        <span class="info-value">${this.formatDate(expense.date)}</span>
                    </div>
                </div>

                ${expense.receipt_path ? `
                <div class="info-item mb-20">
                    <span class="info-label">Recibo</span>
                    <img src="/api/receipts/${expense.receipt_path}" alt="Recibo" style="max-width: 200px; max-height: 150px; border-radius: 8px; margin-top: 10px;">
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

    async openExpenseModal(expense = null) {
        const modal = document.getElementById('expenseModal');
        const form = document.getElementById('expenseForm');

        // Popular selects
        await this.populateExpenseSelects();

        if (expense) {
            // Edição
            document.querySelector('#expenseModal .modal-header h3').textContent = 'Editar Despesa';
            document.getElementById('expenseTripId').value = expense.trip_id;
            document.getElementById('expenseCategory').value = expense.category_id;
            document.getElementById('expenseAmount').value = expense.amount;
            document.getElementById('expensePaymentType').value = expense.payment_type_id;
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

    async populateExpenseSelects() {
        // Popular select de viagens
        const trips = await this.apiCall('/trips');
        const tripSelect = document.getElementById('expenseTripId');
        tripSelect.innerHTML = '<option value="">Selecione uma viagem</option>' +
            trips.map(trip => `<option value="${trip.id}">${trip.main_destination} (${this.formatDate(trip.start_date)})</option>`).join('');

        // Popular select de categorias
        const categories = await this.apiCall('/categories');
        const categorySelect = document.getElementById('expenseCategory');
        categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>' +
            categories.map(category => `<option value="${category.id}">${category.name}</option>`).join('');

        // Popular select de tipos de pagamento
        const paymentTypes = await this.apiCall('/payment-types');
        const paymentSelect = document.getElementById('expensePaymentType');
        paymentSelect.innerHTML = '<option value="">Selecione o tipo de pagamento</option>' +
            paymentTypes.map(type => `<option value="${type.id}">${type.name}</option>`).join('');
    }

    async handleExpenseSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const formData = new FormData();

        formData.append('trip_id', document.getElementById('expenseTripId').value);
        formData.append('category_id', document.getElementById('expenseCategory').value);
        formData.append('amount', document.getElementById('expenseAmount').value);
        formData.append('payment_type_id', document.getElementById('expensePaymentType').value);
        formData.append('description', document.getElementById('expenseDescription').value);
        formData.append('date', document.getElementById('expenseDate').value);

        const receiptFile = document.getElementById('expenseReceipt').files[0];
        if (receiptFile) {
            formData.append('receipt', receiptFile);
        }

        let result;
        const endpoint = form.dataset.editId ? `/expenses/${form.dataset.editId}` : '/expenses';
        const method = form.dataset.editId ? 'PUT' : 'POST';

        try {
            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });

            if (response.ok) {
                result = await response.json();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Erro na requisição');
            }
        } catch (error) {
            alert('Erro: ' + error.message);
            return;
        }

        if (result) {
            this.closeModal('expenseModal');
            this.loadExpenses();
            this.loadTrips(); // Atualizar resumos das viagens
        }
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

    async editExpense(expenseId) {
        const expenses = await this.apiCall('/expenses');
        const expense = expenses.find(e => e.id === expenseId);
        this.openExpenseModal(expense);
    }

    async deleteExpense(expenseId) {
        if (confirm('Tem certeza que deseja excluir esta despesa?')) {
            const result = await this.apiCall(`/expenses/${expenseId}`, {
                method: 'DELETE'
            });

            if (result) {
                this.loadExpenses();
                this.loadTrips(); // Atualizar resumos das viagens
            }
        }
    }

    // Relatórios
    async loadReports() {
        const container = document.getElementById('financialSummary');
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Carregando...</div>';

        const summary = await this.apiCall('/reports/summary');
        if (!summary) return;

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
    async loadAdminData() {
        if (this.currentUser.role !== 'admin') return;

        await this.loadCategoriesManagement();
        await this.loadPaymentTypesManagement();
    }

    async loadCategoriesManagement() {
        const categories = await this.apiCall('/categories');
        if (!categories) return;

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

    async loadPaymentTypesManagement() {
        const paymentTypes = await this.apiCall('/payment-types');
        if (!paymentTypes) return;

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

    async addCategory() {
        const name = prompt('Nome da categoria:');
        const icon = prompt('Classe do ícone (ex: fas fa-car):', 'fas fa-tag');

        if (name && icon) {
            const result = await this.apiCall('/categories', {
                method: 'POST',
                body: JSON.stringify({ name, icon })
            });

            if (result) {
                this.loadCategoriesManagement();
                this.populateFilters();
            }
        }
    }

    async editCategory(categoryId) {
        const categories = await this.apiCall('/categories');
        const category = categories.find(c => c.id === categoryId);

        if (!category) return;

        const name = prompt('Nome da categoria:', category.name);
        const icon = prompt('Classe do ícone:', category.icon);

        if (name && icon) {
            const result = await this.apiCall(`/categories/${categoryId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, icon })
            });

            if (result) {
                this.loadCategoriesManagement();
                this.populateFilters();
            }
        }
    }

    async deleteCategory(categoryId) {
        if (confirm('Tem certeza que deseja excluir esta categoria?')) {
            const result = await this.apiCall(`/categories/${categoryId}`, {
                method: 'DELETE'
            });

            if (result) {
                this.loadCategoriesManagement();
                this.populateFilters();
            }
        }
    }

    async addPaymentType() {
        const name = prompt('Nome do tipo de pagamento:');
        const icon = prompt('Classe do ícone (ex: fas fa-credit-card):', 'fas fa-money-bill');

        if (name && icon) {
            const result = await this.apiCall('/payment-types', {
                method: 'POST',
                body: JSON.stringify({ name, icon })
            });

            if (result) {
                this.loadPaymentTypesManagement();
            }
        }
    }

    async editPaymentType(typeId) {
        const paymentTypes = await this.apiCall('/payment-types');
        const type = paymentTypes.find(t => t.id === typeId);

        if (!type) return;

        const name = prompt('Nome do tipo de pagamento:', type.name);
        const icon = prompt('Classe do ícone:', type.icon);

        if (name && icon) {
            const result = await this.apiCall(`/payment-types/${typeId}`, {
                method: 'PUT',
                body: JSON.stringify({ name, icon })
            });

            if (result) {
                this.loadPaymentTypesManagement();
            }
        }
    }

    async deletePaymentType(typeId) {
        if (confirm('Tem certeza que deseja excluir este tipo de pagamento?')) {
            const result = await this.apiCall(`/payment-types/${typeId}`, {
                method: 'DELETE'
            });

            if (result) {
                this.loadPaymentTypesManagement();
            }
        }
    }

    // Filtros
    async populateFilters() {
        // Filtro de viagens
        const trips = await this.apiCall('/trips');
        if (trips) {
            const tripFilter = document.getElementById('tripFilter');
            const currentValue = tripFilter.value;
            tripFilter.innerHTML = '<option value="">Todas as viagens</option>' +
                trips.map(trip => `<option value="${trip.id}">${trip.main_destination} (${this.formatDate(trip.start_date)})</option>`).join('');
            tripFilter.value = currentValue;
        }

        // Filtro de categorias
        const categories = await this.apiCall('/categories');
        if (categories) {
            const categoryFilter = document.getElementById('categoryFilter');
            const currentCategoryValue = categoryFilter.value;
            categoryFilter.innerHTML = '<option value="">Todas as categorias</option>' +
                categories.map(category => `<option value="${category.name}">${category.name}</option>`).join('');
            categoryFilter.value = currentCategoryValue;
        }
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