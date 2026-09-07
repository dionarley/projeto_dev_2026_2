# Os 12 Fatores (12-Factor App)

Metodologia para construir SaaS apps desenvolvidas pelo Heroku (Adam Wiggins). Garante portabilidade, escalabilidade e confiabilidade na cloud.

## I. Codebase - One Codebase, Many Deploys

### Regra
- Um repositório Git por app
- Deploys múltiplos (staging, production)

### Aplicação
```
my-app/
├── web/          # repo principal
├── mobile-app/   # outro repo
└── api/        # outro repo

# ERRADO: múltiplos repos para mesmo app
```

## II. Dependencies - Explicitly Declare

### Regra
- Declare todas dependências explicitamente
- Use gerenciador de pacotes (npm, pip, cargo)

### Aplicação
```json
// package.json - NUNCA use implicit deps
{
  "dependencies": {
    "express": "4.18.2",
    "pg": "8.11.3"
  }
}

# Errado: require('./local-lib')
# CERTO: npm install
```

## III. Config - Store Config in Environment

### Regra
- Armazene config no ambiente, NÃO no código
- Credenciais NO repositório

### Aplicação
```typescript
// .env (NÃO commitar)
DATABASE_URL=postgres://user:pass@host:5432
API_KEY=xxx

// CERTO
const dbUrl = process.env.DATABASE_URL;

// ERRADO
const dbUrl = 'postgres://localhost:5432';
```

### Twelve-Factor Config
```yaml
# docker-compose.yml
services:
  web:
    environment:
      - DATABASE_URL=${DATABASE_URL}
```

## IV. Backing Services - Treat as Attached Resources

### Regra
- DB, cache, queue são recursos externos
-连接string no config, não hardcoded

### Aplicação
```typescript
// CERTO: recurso como attachment
const db = new PostgresClient(process.env.DATABASE_URL);
const redis = new Redis(process.env.REDIS_URL);

// Trocar serviço = muda URL, não código
```

## V. Build, Release, Run - Strictly Separate

### Regra
- **Build**: compila código
- **Release**: adiciona config
- **Run**: executa

### Aplicação
```bash
# Build
docker build -t myapp:1.0.0 .

# Release
docker tag myapp:1.0.0 registry/myapp:release-42

# Run
docker run myapp:release-42
```

### Pipeline CI/CD
```
Code → Build → Test → Stage → Release → Production
```

## VI. Processes - Stateless

### Regra
- Processos stateless
- Dados no backing service

### Aplicação
```typescript
// ERRADO: estado em memória
let cache = {};
app.get('/user/:id', () => cache[id]);

// CERTO: dados em Redis/DB
app.get('/user/:id', async () => redis.get(id));
```

## VII. Port Binding - Self-Contained

### Regra
- App expõe HTTP via porta
- Não depende de servidor externo

### Aplicação
```javascript
// CERTO: app auto-contido
const app = express();
app.listen(3000);

// K8s routing
# service.yaml
spec:
  ports:
    - port: 80
      targetPort: 3000
```

## VIII. Concurrency - Scale Out

### Regra
- Processos separados para diferentes cargas
- Horizontal scaling

### Aplicação
```yaml
# Procfile (Heroku)
web: npm start        # HTTP
worker: node job    # background
scheduler: node cron
```

```yaml
# docker-compose.yml
services:
  web:
    deploy:
      replicas: 3
  worker:
    deploy:
      replicas: 2
```

## IX. Disposability - Fast Startup, Graceful Shutdown

### Regra
- Startup rápido (< 30s)
- Shutdown graceful (termine trabajo, cierre conexões)

### Aplicação
```typescript
// Signal handling
process.on('SIGTERM', async () => {
  await gracefulShutdown();
  process.exit(0);
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));
```

## X. Dev/Prod Parity

### Regra
- Desenvolvimento ≈ Produção
- Use Docker para parity

### Aplicação
```bash
# Docker everywhere
docker run -d myapp:prod    # production
docker run -d myapp:local   # development

# Same base image, different env vars
```

## XI. Logs - Treat as Event Stream

### Regra
- Logs são stream de eventos
- Nãooqueie/trate localmente

### Aplicação
```typescript
// CERTO: stdout
console.log(JSON.stringify({ level: 'info', msg: 'request' }));

// Logs → aggregation (Datadog, CloudWatch)
// ERRADO: log.info('error in file')
```

## XII. Admin Processes - Run Administrative Tasks

### Regra
- Tasks administrativas em processos one-off

### Aplicação
```bash
# Migrations
heroku run npm run migrate

# Console
heroku run npm run db:seed

# Scripts one-off
docker run myapp npm run migrate
```

## Fatores Adicionais (modernos)

### XIII. API First
```typescript
// Documente API primeiro
GET /users/{id} → retorna User
```

### XIV. Telemetry
```typescript
// Métricas estruturadas
metrics.increment('request.count');
metrics.histogram('request.latency', ms);
```

## Checklist 12 Fatores

- [ ] Um repo por app
- [ ] Dependências explícitas (package.json)
- [ ] Config em environment
- [ ] Backing services como recursos
- [ ] Build/Release/Run separados
- [ ] Stateless processes
- [ ] Porta binding
- [ ] Concurrency (processos separados)
- [ ] Disposability (startup/shutdown rápido)
- [ ] Dev/Prod parity (Docker)
- [ ] Logs para stdout
- [ ] Admin tasks one-off