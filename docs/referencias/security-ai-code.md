# Security for AI-Generated Code

IA está gerando código cada vez mais rápido, mas a segurança frequentemente é negligenciada. Ferramentas de IA introduzem uma nova categoria de risco que abordagens tradicionais de AppSec não foram desenhadas para capturar.

## Riscos Comuns em Código Gerado por IA

### 1. Vulnerabilidades de Segurança

- **Injeção SQL**: Query builder mal configurado
- **XSS**: Sanitização inadequada de inputs
- **Exposição de secrets**: Credenciais no código
- **Broken Authentication**: Implementação falha de auth
- **Hardcoded secrets**: Keys e tokens expostos

### 2. Código de Baixa Qualidade

- **Arquivos grandes**: IA tende a gerar arquivos de 3k+ LOC
- **Duplicação**: Quando pedidos para fazer DRY,反而 cria duplicação
- **Funções gigantes**: Falta de single responsibility
- **Nomenclatura ruim**: Variáveis sem sentido

## scanners de Segurança

### Ferramentas Obrigatórias

| Ferramenta | Descrição | Linguagem |
|------------|-----------|-----------|
| Snyk | Detecta vulnerabilidades em deps | Multi |
| SonarQube | Quality + Security | Multi |
| ESLint security | Regras de segurança JS/TS | JS/TS |
| Bandit | Segurança Python | Python |
| Semgrep | Análise estática | Multi |
| GitHub Secret Scanning | Secrets no repo | GitHub |

### Configuração Essential

```yaml
# .github/workflows/security.yml
name: Security Scan

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
          
      - name: Run ESLint security
        run: |
          npm audit --audit-level=high
          
      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main
```

## Práticas de Segurança com IA

### 1. Revisão Obrigatória

- Nunca confie em código gerado por IA sem revisão
- IA é boa em verificações mecânicas, não em decisões arquiteturais
- Reserve tempo para review, não apenas geração

### 2. Análise Automatizada

```bash
# Sempre rode antes de commitar
npm audit --audit-level=high     # Vulnerabilidades em deps
npm run lint                     # Code style + security rules
npm run security-scan            # scanners customizados
```

### 3. Pin Dependencies

```json
// package.json - SEMPRE use versões fixas
{
  "dependencies": {
    "lodash": "4.17.21",
    "express": "4.18.2"
  }
}
```

```toml
# Cargo.toml - SEMPRE use versões fixas
[dependencies]
serde = "=1.0.195"
tokio = "=1.32.0"
```

### 4. Rate Limiting e Input Validation

```typescript
// SEMPRE valide inputs, IA não faz isso automaticamente
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  age: z.number().int().min(0).max(150)
});

// Validate antes de usar
function createUser(data: unknown) {
  const validated = createUserSchema.parse(data); // Lança se invalido
  // ... proceed
}
```

### 5. Parameterized Queries

```typescript
// PROBLEMA - SQL Injection
const query = `SELECT * FROM users WHERE id = ${userId}`;

// SOLUÇÃO - Parameterized
const query = 'SELECT * FROM users WHERE id = $1';
const result = await db.query(query, [userId]);
```

## Governance de Código IA

### Políticas Recomendadas

1. **Análise automática**: Todo código que entra no repo passa por análise de segurança, independente da origem (humano ou IA)

2. **Rastreabilidade**: Mantenha metadados sobre qual código foi gerado por IA vs escrito por humanos

3. **Revisão humana**: Exija review humano para decisões de arquitetura e lógica de negócio

4. **scan em CI/CD**: Adicione scanners no pipeline

```yaml
# Exemplo: Código gerado por IA precisa de aprovação extra
rules:
  - if: $AUTHOR_IS_BOT
    then:
      - require: 2 approvals
      - require: security scan pass
```

## Checklist de Segurança para Código IA

- [ ] Secrets nunca expostos no código
- [ ] Dependencies com versões fixas
- [ ] Input validation implementado
- [ ] Parameterized queries usadas
- [ ] Error messages não expõem detalhes internos
- [ ] Authentication/Authorization verificados
- [ ] Rate limiting implementado
- [ ] Scanner de segurança passou
- [ ] Review humano realizado
- [ ] Testes de segurança existentes

## Custo da Segurança

| Prática | Custo | Retorno |
|---------|-------|---------|
| Dependências fixas | Baixo | Alto |
| SAST em CI | Baixo | Alto |
| SCA (Snyk) | Médio | Alto |
| DAST | Médio | Médio |
| Penetration testing | Alto | Médio |
| Bug bounty | Variável | Alto |

Lembre-se: velocidade sem governança gera código difícil de manter. A combinação de velocidade com controle é o que garante entregas sustentáveis.