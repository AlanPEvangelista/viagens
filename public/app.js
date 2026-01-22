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

        // Filtros de Viagens (Minhas Viagens)
        document.getElementById('tripLocationFilter').addEventListener('input', () => this.loadTrips());
        document.getElementById('tripDateFilter').addEventListener('change', () => this.loadTrips());

        // Usuários
        const newUserBtn = document.getElementById('newUserBtn');
        if (newUserBtn) newUserBtn.addEventListener('click', () => this.openUserModal());
        
        const userForm = document.getElementById('userForm');
        if (userForm) userForm.addEventListener('submit', (e) => this.handleUserSubmit(e));

        const resetPasswordForm = document.getElementById('resetPasswordForm');
        if (resetPasswordForm) resetPasswordForm.addEventListener('submit', (e) => this.handleResetPasswordSubmit(e));
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

            if (response.status === 401 || response.status === 403) {
                // Token inválido ou expirado
                this.handleLogout();
                return null;
            }

            if (!response.ok) {
                let errorMessage = 'Erro na requisição';
                try {
                    const error = await response.json();
                    errorMessage = error.error || errorMessage;
                } catch (e) {
                    // Se não for JSON, usa o status text
                    errorMessage = response.statusText;
                }
                throw new Error(errorMessage);
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
            case 'charts':
                this.loadCharts();
                break;
            case 'users':
                this.loadUsers();
                break;
        }
    }

    // Gerenciamento de Usuários
    async loadUsers() {
        if (this.currentUser.role !== 'admin') return;

        const container = document.getElementById('usersList');
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Carregando...</div>';

        const users = await this.apiCall('/users');
        if (!users) return;

        if (users.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhum usuário cadastrado.</p>';
            return;
        }

        container.innerHTML = `
            <table class="users-table" style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <thead style="background: #f8f9fa;">
                    <tr>
                        <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #e9ecef;">Nome</th>
                        <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #e9ecef;">Usuário</th>
                        <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #e9ecef;">Perfil</th>
                        <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #e9ecef;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(user => `
                        <tr style="border-bottom: 1px solid #e9ecef;">
                            <td style="padding: 12px 15px;">${user.name}</td>
                            <td style="padding: 12px 15px;">${user.username}</td>
                            <td style="padding: 12px 15px;">
                                <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; background: ${user.role === 'admin' ? '#e3f2fd' : '#e9ecef'}; color: ${user.role === 'admin' ? '#0d6efd' : '#495057'};">
                                    ${user.role === 'admin' ? 'Administrador' : 'Usuário'}
                                </span>
                            </td>
                            <td style="padding: 12px 15px;">
                                <button class="btn btn-sm btn-secondary" onclick="app.openUserModal({id: ${user.id}, name: '${user.name}', username: '${user.username}', role: '${user.role}'})" style="padding: 4px 8px; margin-right: 5px;">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-warning" onclick="app.openResetPasswordModal(${user.id}, '${user.name}')" title="Resetar Senha" style="padding: 4px 8px; margin-right: 5px; background: #ffc107; color: #000; border: none;">
                                    <i class="fas fa-key"></i>
                                </button>
                                ${user.id !== this.currentUser.id ? `
                                <button class="btn btn-sm btn-danger" onclick="app.deleteUser(${user.id})" style="padding: 4px 8px;">
                                    <i class="fas fa-trash"></i>
                                </button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    openUserModal(user = null) {
        const modal = document.getElementById('userModal');
        const form = document.getElementById('userForm');
        const title = document.getElementById('userModalTitle');
        const passwordGroup = document.getElementById('passwordGroup');
        const passwordInput = document.getElementById('userPassword');
        const hint = passwordGroup.querySelector('.hint');

        if (user) {
            title.textContent = 'Editar Usuário';
            document.getElementById('userId').value = user.id;
            document.getElementById('userName').value = user.name;
            document.getElementById('userUsername').value = user.username;
            document.getElementById('userRole').value = user.role;
            
            passwordInput.required = false;
            hint.style.display = 'block';
            form.dataset.mode = 'edit';
        } else {
            title.textContent = 'Novo Usuário';
            form.reset();
            document.getElementById('userId').value = '';
            
            passwordInput.required = true;
            hint.style.display = 'none';
            form.dataset.mode = 'create';
        }

        this.openModal('userModal');
    }

    async handleUserSubmit(e) {
        e.preventDefault();
        const mode = e.target.dataset.mode;
        const id = document.getElementById('userId').value;
        const name = document.getElementById('userName').value;
        const username = document.getElementById('userUsername').value;
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;

        const data = { name, username, role };
        if (password) data.password = password;

        let result;
        if (mode === 'edit') {
            result = await this.apiCall(`/users/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            result = await this.apiCall('/users', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        if (result) {
            this.closeModal('userModal');
            this.loadUsers();
        }
    }

    async deleteUser(id) {
        if (confirm('Tem certeza que deseja excluir este usuário?')) {
            const result = await this.apiCall(`/users/${id}`, {
                method: 'DELETE'
            });

            if (result) {
                this.loadUsers();
            }
        }
    }

    openResetPasswordModal(id, name) {
        document.getElementById('resetUserId').value = id;
        document.getElementById('resetUserName').textContent = name;
        document.getElementById('newPassword').value = '';
        this.openModal('resetPasswordModal');
    }

    async handleResetPasswordSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('resetUserId').value;
        const newPassword = document.getElementById('newPassword').value;

        const result = await this.apiCall(`/users/${id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });

        if (result) {
            alert('Senha resetada com sucesso!');
            this.closeModal('resetPasswordModal');
        }
    }

    // Gerenciamento de Viagens
    async loadTrips() {
        const container = document.getElementById('tripsList');
        container.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i> Carregando...</div>';

        let trips = await this.apiCall('/trips');
        if (!trips) return;

        // Filtros de viagens
        const locationFilter = document.getElementById('tripLocationFilter').value.toLowerCase();
        const dateFilter = document.getElementById('tripDateFilter').value;

        if (locationFilter) {
            trips = trips.filter(trip => 
                trip.main_destination.toLowerCase().includes(locationFilter) || 
                (trip.other_destinations && trip.other_destinations.toLowerCase().includes(locationFilter))
            );
        }

        if (dateFilter) {
            trips = trips.filter(trip => {
                const start = trip.start_date.split('T')[0];
                const end = trip.end_date.split('T')[0];
                return dateFilter >= start && dateFilter <= end;
            });
        }

        if (trips.length === 0) {
            container.innerHTML = '<p class="text-center">Nenhuma viagem encontrada.</p>';
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
            // Garantir formato YYYY-MM-DD para os inputs de data
            document.getElementById('startDate').value = trip.start_date ? trip.start_date.split('T')[0] : '';
            document.getElementById('endDate').value = trip.end_date ? trip.end_date.split('T')[0] : '';
            document.getElementById('initialCash').value = trip.initial_cash;
            form.dataset.editId = trip.id;
        } else {
            // Criação
            document.querySelector('#tripModal .modal-header h3').textContent = 'Nova Viagem';
            form.reset();
            
            // Definir datas iniciais seguras (hoje)
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            
            document.getElementById('startDate').value = todayStr;
            document.getElementById('endDate').value = todayStr;
            
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
        const totalDisplay = document.getElementById('totalExpensesDisplay');
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

        // Calcular total
        const total = expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0);
        if (totalDisplay) {
            totalDisplay.textContent = `Total: R$ ${total.toFixed(2)}`;
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
            // Garantir formato YYYY-MM-DD
            document.getElementById('expenseDate').value = expense.date ? expense.date.split('T')[0] : '';
            form.dataset.editId = expense.id;
        } else {
            // Criação
            document.querySelector('#expenseModal .modal-header h3').textContent = 'Nova Despesa';
            form.reset();
            
            // Definir data de hoje no fuso horário local
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            document.getElementById('expenseDate').value = `${year}-${month}-${day}`;
            
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

    // Administração (Removido conforme solicitação)


    // Gráficos
    async loadCharts() {
        await this.populateChartFilters();
        await this.updateCharts();
        
        // Adicionar listener para o filtro de viagem
        document.getElementById('chartTripFilter').addEventListener('change', () => this.updateCharts());
    }

    async populateChartFilters() {
        // Popular filtro de viagens para gráficos
        const trips = await this.apiCall('/trips');
        if (trips) {
            const tripFilter = document.getElementById('chartTripFilter');
            tripFilter.innerHTML = '<option value="">Todas as viagens</option>' +
                trips.map(trip => `<option value="${trip.id}">${trip.main_destination} (${this.formatDate(trip.start_date)})</option>`).join('');
        }
    }

    async updateCharts() {
        const tripId = document.getElementById('chartTripFilter').value;
        
        // Buscar dados das despesas
        let expenses = await this.apiCall('/expenses');
        if (!expenses) return;

        // Filtrar por viagem se selecionada
        if (tripId) {
            expenses = expenses.filter(expense => expense.trip_id === parseInt(tripId));
        }

        if (expenses.length === 0) {
            this.showEmptyCharts();
            return;
        }

        // Processar dados para gráficos
        const categoryData = this.processExpensesByCategory(expenses);
        const paymentData = this.processExpensesByPaymentType(expenses);

        // Criar gráficos
        this.createCategoryChart(categoryData);
        this.createPaymentChart(paymentData);
    }

    processExpensesByCategory(expenses) {
        const categoryTotals = {};
        let totalAmount = 0;

        expenses.forEach(expense => {
            const category = expense.category_name;
            const amount = parseFloat(expense.amount);
            
            if (!categoryTotals[category]) {
                categoryTotals[category] = 0;
            }
            categoryTotals[category] += amount;
            totalAmount += amount;
        });

        // Converter para array e calcular percentuais
        const data = Object.entries(categoryTotals).map(([category, amount]) => ({
            category,
            amount,
            percentage: ((amount / totalAmount) * 100).toFixed(1)
        })).sort((a, b) => b.amount - a.amount);

        return { data, totalAmount };
    }

    processExpensesByPaymentType(expenses) {
        const paymentTotals = {};
        let totalAmount = 0;

        expenses.forEach(expense => {
            const paymentType = expense.payment_type_name;
            const amount = parseFloat(expense.amount);
            
            if (!paymentTotals[paymentType]) {
                paymentTotals[paymentType] = 0;
            }
            paymentTotals[paymentType] += amount;
            totalAmount += amount;
        });

        // Converter para array e calcular percentuais
        const data = Object.entries(paymentTotals).map(([paymentType, amount]) => ({
            paymentType,
            amount,
            percentage: ((amount / totalAmount) * 100).toFixed(1)
        })).sort((a, b) => b.amount - a.amount);

        return { data, totalAmount };
    }

    createCategoryChart(categoryData) {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        
        // Destruir gráfico anterior se existir
        if (this.categoryChart) {
            this.categoryChart.destroy();
        }

        const colors = [
            '#2a5298', '#dc3545', '#28a745', '#ffc107', '#17a2b8',
            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d'
        ];

        const labels = categoryData.data.map(item => item.category);
        const data = categoryData.data.map(item => parseFloat(item.percentage));
        const backgroundColors = colors.slice(0, labels.length);

        this.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = categoryData.data[context.dataIndex];
                                return `${item.category}: ${item.percentage}% (R$ ${item.amount.toFixed(2)})`;
                            }
                        }
                    }
                }
            }
        });

        // Criar legenda personalizada
        this.createCustomLegend('categoryLegend', categoryData.data, backgroundColors, 'category');
    }

    createPaymentChart(paymentData) {
        const ctx = document.getElementById('paymentChart').getContext('2d');
        
        // Destruir gráfico anterior se existir
        if (this.paymentChart) {
            this.paymentChart.destroy();
        }

        const colors = [
            '#28a745', '#dc3545', '#2a5298', '#ffc107', '#17a2b8',
            '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d'
        ];

        const labels = paymentData.data.map(item => item.paymentType);
        const data = paymentData.data.map(item => parseFloat(item.percentage));
        const backgroundColors = colors.slice(0, labels.length);

        this.paymentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const item = paymentData.data[context.dataIndex];
                                return `${item.paymentType}: ${item.percentage}% (R$ ${item.amount.toFixed(2)})`;
                            }
                        }
                    }
                }
            }
        });

        // Criar legenda personalizada
        this.createCustomLegend('paymentLegend', paymentData.data, backgroundColors, 'paymentType');
    }

    createCustomLegend(containerId, data, colors, typeKey) {
        const container = document.getElementById(containerId);
        
        container.innerHTML = data.map((item, index) => {
            const label = typeKey === 'category' ? item.category : item.paymentType;
            return `
                <div class="legend-item">
                    <div class="legend-color" style="background-color: ${colors[index]}"></div>
                    <span class="legend-label">${label}:</span>
                    <span class="legend-value">${item.percentage}%</span>
                </div>
            `;
        }).join('');
    }

    showEmptyCharts() {
        // Destruir gráficos existentes
        if (this.categoryChart) {
            this.categoryChart.destroy();
        }
        if (this.paymentChart) {
            this.paymentChart.destroy();
        }

        // Mostrar mensagem de dados vazios
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        const paymentCtx = document.getElementById('paymentChart').getContext('2d');

        categoryCtx.clearRect(0, 0, categoryCtx.canvas.width, categoryCtx.canvas.height);
        paymentCtx.clearRect(0, 0, paymentCtx.canvas.width, paymentCtx.canvas.height);

        categoryCtx.font = '16px Arial';
        categoryCtx.fillStyle = '#6c757d';
        categoryCtx.textAlign = 'center';
        categoryCtx.fillText('Nenhuma despesa encontrada', categoryCtx.canvas.width / 2, categoryCtx.canvas.height / 2);

        paymentCtx.font = '16px Arial';
        paymentCtx.fillStyle = '#6c757d';
        paymentCtx.textAlign = 'center';
        paymentCtx.fillText('Nenhuma despesa encontrada', paymentCtx.canvas.width / 2, paymentCtx.canvas.height / 2);

        // Limpar legendas
        document.getElementById('categoryLegend').innerHTML = '';
        document.getElementById('paymentLegend').innerHTML = '';
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
        if (!dateString) return '';
        
        // Handle YYYY-MM-DD string directly to avoid timezone issues
        let datePart = dateString;
        if (typeof dateString === 'string') {
             if (dateString.includes('T')) {
                 datePart = dateString.split('T')[0];
             }
             if (datePart.match(/^\d{4}-\d{2}-\d{2}$/)) {
                 const [year, month, day] = datePart.split('-');
                 return `${day}/${month}/${year}`;
             }
        }

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