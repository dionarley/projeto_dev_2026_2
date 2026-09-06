#!/usr/bin/env bash
#
# Reinicia a stack: derruba e sobe novamente (sem rebuild por padrão).
#
# Uso: REBUILD=1 scripts/restart.sh     # força --build
#      VOLUMES=1 scripts/restart.sh     # apaga os dados do banco (stop -v)
#      HOST_NET=1 scripts/restart.sh    # override docker-compose.host.yml
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# As variáveis de ambiente (VOLUMES, HOST_NET, REBUILD, DOCKER) já são
# repassadas aos scripts chamados.
"$ROOT/scripts/stop.sh"
exec "$ROOT/scripts/start.sh"