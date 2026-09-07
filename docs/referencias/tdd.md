# TDD - Test Driven Development

TDD é uma metodologia de desenvolvimento onde testes são escritos ANTES do código. O ciclo Red-Green-Refactor garante código de qualidade.

## O Ciclo Red-Green-Refactor

### Fase 1: RED - Escreva um teste que falha
- Escreva o menor teste possível para uma funcionalidade que não existe
- O teste falha porque o código não existe ainda
- Isso prova que o teste é válido

### Fase 2: GREEN - Escreva código mínimo
- Escreva a menor quantidade de código para fazer o teste passar
- Priorize simplicidade, não elegância
- NÃO gold-plate

### Fase 3: REFACTOR - Melhore o código
- Com testes passando, limpe nomes, remova duplicação
-Melhore estrutura sem mudar comportamento
- testes são sua rede de segurança

## Exemplo Prático

### Step 1: RED - Teste que falha

```typescript
// user.service.test.ts
describe('UserService', () => {
  it('should create a user with valid email', () => {
    const service = new UserService();
    
    const user = service.createUser({
      name: 'John',
      email: 'john@example.com'
    });
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe('john@example.com');
  });
});
```

```bash
# Resultado: FAIL
# TypeError: Cannot read property 'createUser' of undefined
```

### Step 2: GREEN - Código mínimo

```typescript
// user.service.ts
class UserService {
  createUser(data: { name: string; email: string }) {
    return {
      id: '1',
      name: data.name,
      email: data.email
    };
  }
}
```

```bash
# Resultado: PASS
```

### Step 3: REFACTOR - Melhorar

```typescript
// Extract UUID creation
class UserService {
  private generateId(): string {
    return crypto.randomUUID();
  }
  
  createUser(data: CreateUserDTO): User {
    return {
      id: this.generateId(),
      name: data.name,
      email: data.email,
      createdAt: new Date()
    };
  }
}
```

## Regras de Ouro TDD

| Regra | Descrição |
|-------|-----------|
| ZERO código sem teste | Nunca escreva código sem teste falhando |
| Mínimo código | Escreva só o suficiente para passar |
| GREEN não é selesai | Refatore antes de próximo teste |
| Um assertion por teste | Teste uma coisa só |

## Estrutura de Testes

### Arrange, Act, Assert (AAA)

```typescript
it('should calculate total correctly', () => {
  // Arrange
  const cart = new Cart();
  cart.addItem({ price: 10, quantity: 2 });
  cart.addItem({ price: 5, quantity: 3 });
  
  // Act
  const total = cart.calculateTotal();
  
  // Assert
  expect(total).toBe(35);
});
```

### Given, When, Then

```typescript
given('a user is logged in', () => { ... });
when('they access /dashboard', () => { ... });
then('they should see their data', () => { ... });
```

## Testes Unitários

### O que testar
- Funções puras
- Lógica de negócio
- Validações
- Transformações de dados

### Exemplo

```typescript
// calculator.ts
function calculateTax(amount: number, rate: number): number {
  if (amount < 0) throw new Error('Amount must be positive');
  return amount * rate;
}

// calculator.test.ts
describe('calculateTax', () => {
  it('should calculate 10% tax on 100', () => {
    expect(calculateTax(100, 0.10)).toBe(10);
  });
  
  it('should throw on negative amount', () => {
    expect(() => calculateTax(-10, 0.10)).toThrow();
  });
});
```

## Testes de Integração

### O que testar
- APIs (HTTP)
- Integração com DB
- Integração com serviços externos

### Exemplo com Supertest

```typescript
import request from 'supertest';
import { app } from './app';

describe('POST /users', () => {
  it('should create user', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'John', email: 'john@test.com' });
    
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
  });
  
  it('should reject invalid email', async () => {
    const res = await request(app)
      .post('/users')
      .send({ name: 'John', email: 'invalid' });
    
    expect(res.status).toBe(400);
  });
});
```

## TDD em Diferentes Cenários

### 1. Novo Feature

```
Red: escreva teste para comportamento desejado
Green: implemente funcionalidade mínima
Refactor: melhore design
Repita para próximo comportamento
```

### 2. Bug Fix

```
Red: escreva teste que reproduz o bug
Green: corrija o código
Refactor: limpe se necessário
```

### 3. Refactoring

```
Green: testes já existen
Refactor: melhore código, testes garantem que nada quebrou
```

## Quando TDD é Difícil

### Problema: "Não tenho tempo"

**Solução**: "TDD reduz tempo total"
- Menos bugs em produção
- Menos tempo debugando
- Documentação automática

### Problema: "Testar coisa trivial"

**Solução**: "Teste comportamento, não implementação"
- Dado input X, output Y esperado
- Testes que verificam comportamento resistem refactors

### Problema: "Código existente"

**Solução**: "Teste adicionar por último"
- Adicione testes para código existente quando bugs aparecerem
- Legacy code: testes de caracterização

## Boas Práticas

### Nomes de Testes

```typescript
// BOM - descreve comportamento
it('should throw error when email is invalid');
it('should return user by id');

// RUINHO - descreve implementação  
it('should call userRepository.findOne');
```

### Um Assertion por Teste

```typescript
// BOM
it('should create user with correct properties', () => {
  const user = service.createUser(data);
  expect(user.name).toBe(data.name);
});

//另一個test
it('should create user with generated id', () => {
  const user = service.createUser(data);
  expect(user.id).toBeDefined();
});
```

### Testes Independentes

```typescript
// Cada teste deve funcionar SOZINHO
// Sem dependência de ordem de execução

// Use beforeEach para setup
beforeEach(() => {
  service = new UserService();
});
```

##coverage Métrica

- **Unit tests**: 80%+ em lógica de negócio
- **Integração**: principais fluxos
- **E2E**: críticos caminhos de usuário

## TDD Stack

| Linguagem | Framework | Assertion |
|-----------|-----------|-----------|
| JS/TS | Jest, Vitest | expect |
| Python | pytest | assert |
| Rust | cargo test | assert! |
| Java | JUnit | AssertJ |

## TDD Workflow

```
1. Nova task/tarefa
2. RED: escreva teste falhando
3. GREEN: código mínimo
4. REFACTOR: melhore
5. GREEN: testes passam
6. Repita
```

## Definition of Done (TDD)

- [ ] Teste falha escrito ANTES do código
- [ ] Código faz teste passar
- [ ] Testes passaram
- [ ] Refactor completo
- [ ] coverage 80%+
- [ ] Code review aprovado