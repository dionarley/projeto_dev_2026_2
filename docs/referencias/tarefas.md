# Tarefas:

## Sanitizar entradas do usuario
[x] implementada — `backend/scheduling/validators.py` (control-chars, tamanhos, telefone) nos serializers + modelos

## Tratar SQL injection (SQLi)
[x] implementada — ORM/Django parametrizado (sem SQL cru) + regressao com payloads em `test_security.py`

## Cross-site scripting (XSS)
[x] implementada — CSP + security headers (`config/middleware.py`) e CSV-injection guard no AdminPanel

## Mitigar Man-in-the-Middle & DDoS
[x] implementada — hardening em `settings.py` (HSTS/SSL/cookies) + rate limit por IP e por conta no login (`RateLimitMiddleware`)

## Criar equipes Suporte e TI com controle de privilegios para acesso a manutencoes em servicos e banco de dados
[x] implementada — `role` admin|suporte (+ `create_support`, guarda do /admin/); banco least-privilege (`vidasaude_app` nao-superuser, `vidasaude_admin` p/ manutencao via `db-shell.sh`/`db-backup.sh`)