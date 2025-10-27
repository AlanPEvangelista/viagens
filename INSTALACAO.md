# Guia de Instalação - Sistema de Controle de Viagens
## Servidor Debian - IP 192.168.100.117:8282

### Pré-requisitos
- Servidor Debian com acesso SSH
- Usuário: alan
- Porta: 8282

---

## 1. Conectar ao Servidor

```bash
ssh alan@192.168.100.117
```

---

## 2. Atualizar o Sistema

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 3. Instalar Node.js e npm

```bash
# Instalar Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalação
node --version
npm --version
```

---

## 4. Instalar Dependências do Sistema

```bash
# Instalar build tools necessários para compilar módulos nativos
sudo apt install -y build-essential python3 python3-dev

# Instalar SQLite3
sudo apt install -y sqlite3 libsqlite3-dev
```

---

## 5. Criar Diretório do Projeto

```bash
# Criar diretório
mkdir -p /home/alan/controle-viagens
cd /home/alan/controle-viagens

# Dar permissões adequadas
sudo chown -R alan:alan /home/alan/controle-viagens
chmod 755 /home/alan/controle-viagens
```

---

## 6. Transferir Arquivos do Projeto

### Opção A: Via SCP (do seu computador local)
```bash
# Execute no seu computador local (não no servidor)
scp -r * alan@192.168.100.117:/home/alan/controle-viagens/
```

### Opção B: Via Git (se você tem um repositório)
```bash
# No servidor
git clone [URL_DO_SEU_REPOSITORIO] /home/alan/controle-viagens
cd /home/alan/controle-viagens
```

### Opção C: Criar arquivos manualmente
```bash
# No servidor, criar cada arquivo com o conteúdo fornecido
# Use nano ou vim para criar os arquivos
nano package.json
# Cole o conteúdo do package.json e salve (Ctrl+X, Y, Enter)

# Repita para todos os arquivos:
# - server.js
# - public/index.html
# - public/styles.css
# - public/app.js
```

---

## 7. Instalar Dependências do Node.js

```bash
cd /home/alan/controle-viagens
npm install
```

---

## 8. Criar Estrutura de Diretórios

```bash
# Criar diretórios necessários
mkdir -p database
mkdir -p uploads
mkdir -p logs

# Definir permissões
chmod 755 database uploads logs
```

---

## 9. Inicializar o Banco de Dados

```bash
# IMPORTANTE: Execute este comando primeiro para criar as tabelas
node setup-database.js
```

Você deve ver uma saída similar a:
```
Inicializando banco de dados...
Caminho do banco: /home/alan/controle-viagens/database/travel.db
Conectado ao banco SQLite.
Criando tabelas...
✓ Tabela users criada/verificada
✓ Tabela categories criada/verificada
✓ Tabela payment_types criada/verificada
✓ Tabela trips criada/verificada
✓ Tabela expenses criada/verificada
Inserindo dados padrão...
✓ Usuário admin criado
✓ Usuário guest criado
✓ Categoria Combustível criada
...
🎉 Banco de dados inicializado com sucesso!
```

---

## 10. Configurar Firewall (se necessário)

```bash
# Verificar se o firewall está ativo
sudo ufw status

# Se estiver ativo, liberar a porta 8282
sudo ufw allow 8282/tcp

# Ou desabilitar temporariamente para teste
sudo ufw disable
```

---

## 11. Testar a Aplicação

```bash
# Executar o servidor
node server.js
```

Você deve ver:
```
Servidor rodando em http://0.0.0.0:8282
Acesso local: http://localhost:8282
Acesso na rede: http://192.168.100.117:8282
Conectado ao banco SQLite.
Verificando estrutura do banco...
✓ Banco de dados verificado e pronto!
```

**Acesso:** http://192.168.100.117:8282

---

## 11. Configurar como Serviço (PM2)

### Instalar PM2
```bash
sudo npm install -g pm2
```

### Criar arquivo de configuração
```bash
nano ecosystem.config.js
```

**Conteúdo do ecosystem.config.js:**
```javascript
module.exports = {
  apps: [{
    name: 'controle-viagens',
    script: 'server.js',
    cwd: '/home/alan/controle-viagens',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8282
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### Iniciar com PM2
```bash
# Iniciar aplicação
pm2 start ecosystem.config.js

# Salvar configuração para reinicialização automática
pm2 save

# Configurar para iniciar automaticamente no boot
pm2 startup
# Execute o comando que o PM2 mostrar (geralmente com sudo)

# Verificar status
pm2 status
pm2 logs controle-viagens
```

---

## 12. Configurar Nginx (Opcional - Proxy Reverso)

### Instalar Nginx
```bash
sudo apt install -y nginx
```

### Configurar site
```bash
sudo nano /etc/nginx/sites-available/controle-viagens
```

**Conteúdo:**
```nginx
server {
    listen 8282;
    server_name 192.168.100.117;

    location / {
        proxy_pass http://localhost:8282;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Ou, se preferir acesso direto sem Nginx (mais simples):**
```bash
# Pular a configuração do Nginx e acessar diretamente:
# http://192.168.100.117:8282
```

### Ativar site
```bash
sudo ln -s /etc/nginx/sites-available/controle-viagens /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 13. Backup Automático do Banco

### Criar script de backup
```bash
nano /home/alan/backup-db.sh
```

**Conteúdo:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/alan/backups"
DB_PATH="/home/alan/controle-viagens/database/travel.db"

mkdir -p $BACKUP_DIR
cp $DB_PATH $BACKUP_DIR/travel_backup_$DATE.db

# Manter apenas os últimos 7 backups
find $BACKUP_DIR -name "travel_backup_*.db" -type f -mtime +7 -delete

echo "Backup criado: travel_backup_$DATE.db"
```

### Tornar executável e agendar
```bash
chmod +x /home/alan/backup-db.sh

# Agendar backup diário às 2h da manhã
crontab -e
# Adicionar linha:
0 2 * * * /home/alan/backup-db.sh
```

---

## 14. Comandos Úteis de Gerenciamento

### PM2
```bash
# Ver status
pm2 status

# Reiniciar aplicação
pm2 restart controle-viagens

# Parar aplicação
pm2 stop controle-viagens

# Ver logs
pm2 logs controle-viagens

# Monitorar em tempo real
pm2 monit
```

### Logs do Sistema
```bash
# Ver logs da aplicação
tail -f /home/alan/controle-viagens/logs/combined.log

# Ver logs do Nginx (se configurado)
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Banco de Dados
```bash
# Acessar banco SQLite
sqlite3 /home/alan/controle-viagens/database/travel.db

# Comandos úteis no SQLite:
.tables          # Listar tabelas
.schema users    # Ver estrutura da tabela users
SELECT * FROM users;  # Ver usuários
.quit           # Sair
```

---

## 15. Solução de Problemas

### Aplicação não inicia
```bash
# Verificar logs
pm2 logs controle-viagens

# Verificar se a porta está em uso
sudo netstat -tlnp | grep 8282

# Reiniciar aplicação
pm2 restart controle-viagens
```

### Erro de permissões
```bash
# Corrigir permissões
sudo chown -R alan:alan /home/alan/controle-viagens
chmod -R 755 /home/alan/controle-viagens
chmod -R 777 /home/alan/controle-viagens/database
chmod -R 777 /home/alan/controle-viagens/uploads
```

### Banco não criado
```bash
# Verificar se o diretório existe
ls -la /home/alan/controle-viagens/database/

# Criar manualmente se necessário
mkdir -p /home/alan/controle-viagens/database
chmod 777 /home/alan/controle-viagens/database
```

---

## 16. Acesso ao Sistema

**URL:** http://192.168.100.117:8282

**Usuários padrão:**
- **Admin:** admin / admin123
- **Convidado:** guest / guest123
- **Ou clique em "Entrar como Convidado"**

---

## 17. Localização dos Arquivos

- **Aplicação:** `/home/alan/controle-viagens/`
- **Banco SQLite:** `/home/alan/controle-viagens/database/travel.db`
- **Uploads:** `/home/alan/controle-viagens/uploads/`
- **Logs:** `/home/alan/controle-viagens/logs/`
- **Backups:** `/home/alan/backups/`

---

## 18. Manutenção

### Atualizar aplicação
```bash
cd /home/alan/controle-viagens
git pull  # Se usando Git
pm2 restart controle-viagens
```

### Limpar logs antigos
```bash
pm2 flush controle-viagens
```

### Verificar espaço em disco
```bash
df -h
du -sh /home/alan/controle-viagens/
```

---

**Sistema pronto para uso!** 🚀

O banco SQLite será criado automaticamente em `/home/alan/controle-viagens/database/travel.db` na primeira execução.