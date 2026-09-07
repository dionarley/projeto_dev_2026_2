# Architecture & Reliability

Um desenvolvedor sênior precisa entender os tradeoffs de sua arquitetura e garantir que o sistema sobreviva a imprevistos.

## Tradeoffs de Arquitetura

### Escolhas Importantes

| Decisão | Prós | Contras |
|---------|------|---------|
| Monólito | Simples, menor latência | Escalabilidade limitada |
| Microsserviços | Escalável, equipes independentes | Complexidade operacional |
| SQL | ACID, queries complexas | Escala horizontal difícil |
| NoSQL | Escala horizontal, flexibilidade | Consistência eventual |
| Síncrono | Simples de entender | Acoplamento temporal |
| Assíncrono | Desacoplamento, resiliência | Complexidade de debugging |

### RTO e RPO

- **RTO (Recovery Time Objective)**: Tempo máximo aceitável de indisponibilidade
- **RPO (Recovery Point Objective)**: Quantidade máxima de dados aceitável para perder

## Testes de Falha (Chaos Engineering)

### O que testar

1. **Queda de banco de dados** - sistema continua funcionando?
2. **Latência de rede** - degradação graceful?
3. **Timeout de serviços** - circuit breaker funciona?
4. **Alta carga** - sistema escala corretamente?

### Exemplo - Testando Queda de DB

```typescript
// Teste de contingência - banco indisponível
describe('Database failure scenarios', () => {
  it('should return cached data when DB is down', async () => {
    // Simula DB fora do ar
    jest.spyOn(prisma, '$connect').mockRejectedOnce(new Error('DB unavailable'));
    
    const result = await userService.getUser('123');
    
    // Deve retornar do cache
    expect(result).toEqual(cachedUser);
    expect(logger.warn).toHaveBeenCalledWith('DB unavailable, serving from cache');
  });
  
  it('should queue writes when primary is down', async () => {
    const writeQueue = new WriteQueue();
    
    await writeQueue.enqueue({ type: 'CREATE', data: { id: '1' } });
    
    // Verifica que foi adicionado à fila
    const pending = await writeQueue.getPending();
    expect(pending).toHaveLength(1);
  });
});
```

## Circuit Breaker Pattern

Impede falhas em cascata quando um serviço está indisponível.

### Implementação

```typescript
class CircuitBreaker {
  constructor(
    private failureThreshold = 5,
    private timeout = 60000,
    private resetTimeout = 30000
  ) {}
  
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }
}
```

### Uso

```typescript
const dbBreaker = new CircuitBreaker();

async function getUser(id: string) {
  return dbBreaker.execute(() => prisma.user.findUnique({ where: { id } }));
}
```

## Contingências para Queda de Banco

### 1. Cache com Fallback

```typescript
async function getUser(id: string) {
  // Tenta cache primeiro
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  
  try {
    // Tenta banco
    const user = await prisma.user.findUnique({ where: { id } });
    if (user) {
      await redis.setex(`user:${id}`, 300, JSON.stringify(user));
    }
    return user;
  } catch (dbError) {
    // Fallback: retorna erro amigável ou dados defaults
    logger.error('DB unavailable', { id, error: dbError });
    throw new ServiceUnavailableError('Serviço temporariamente indisponível');
  }
}
```

### 2. Filas de Escrita

```typescript
class WriteQueue {
  private queue: Buffer[] = [];
  
  async enqueue(operation: Operation) {
    // Sempre adiciona à fila primeiro
    this.queue.push({
      ...operation,
      timestamp: Date.now(),
      retries: 0
    });
    
    // Tenta processar em background
    this.processQueue();
  }
  
  async processQueue() {
    while (this.queue.length > 0) {
      try {
        const op = this.queue[0];
        await this.executeOperation(op);
        this.queue.shift();
      } catch (error) {
        // Deixa na fila para retry
        break;
      }
    }
  }
}
```

### 3. Read Replica Fallback

```typescript
async function getUsers() {
  try {
    // Tenta replica primeiro (para leitura)
    return await prismaReplica.user.findMany();
  } catch (error) {
    // Fallback para primary
    logger.warn('Replica unavailable, using primary');
    return await prisma.user.findMany();
  }
}
```

## Retry com Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError;
}
```

## Health Checks

```typescript
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    cache: await checkCache(),
    externalServices: await checkExternalServices()
  };
  
  const healthy = Object.values(checks).every(c => c.healthy);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  });
});

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true };
  } catch {
    return { healthy: false, error: 'DB unavailable' };
  }
}
```

## Boas Práticas

- **Planeje para falha**: Não é "se o banco cair", mas "quando o banco cair"
- **Fail-fast**: Circuit breaker evita espera innecesária
- **Graceful degradation**: Sistema deve funcionar com recursos limitados
- **Teste em produção**: Chaos engineering valida resiliência real
- **Monitoramento**: Alertas para detecção rápida de problemas
- **Runbooks**: Documentação de procedimentos de recovery