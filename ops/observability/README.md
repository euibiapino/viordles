# Monitoramento gratuito do Viordles

Implementação ativa: **Grafana OSS + Prometheus + Loki + Alloy na Oracle existente**.
Sem conta Cloud, trial, cartão, bucket externo ou assinatura. Não habilitar Pro/Enterprise.
Todos os serviços escutam apenas em loopback. Nenhuma alteração no firewall.

## Abrir o painel

Na máquina com a chave SSH:

```sh
ssh -F /dev/null -N -L 3300:127.0.0.1:3300 -i ~/Documentos/oracle/viordles/ssh-key-2026-03-05.key ubuntu@146.235.34.90
```

Abrir http://localhost:3300/d/viordles-health. Leitura liberada **somente para quem
consegue acessar o loopback/túnel SSH**. Não publicar essa porta na internet.
Para administração, usuário `admin`; senha local em
`/home/ubuntu/viordles-observability/admin.env` (permissão 600). Não colocar em chat ou git.

## O que mede

- `/metrics`, no health server existente 127.0.0.1:3000: formato Prometheus.
- Busca yt-dlp, carregamento Lavalink, blocos do relay e duração de comandos.
- Cache hit/miss, redirects, tentativas de leitura e falhas.
- Eventos start/error/stuck e tempo comando → `trackStart` para início imediato.
  `trackStart` não comprova que o usuário ouviu áudio; faixas enfileiradas não entram
  nesse histograma, evitando confundir espera na fila com lentidão.
- Memória, CPU e event loop Node; stats Lavalink a cada 15s, com timeout 3s.
  Déficit/nulled são gauges do último intervalo reportado pelo Lavalink, não contadores.
- Logs JSON com requestId (não é trace OpenTelemetry). O mesmo ID acompanha o relay
  e userData da faixa. IDs e títulos não viram rótulos de métricas.

Buscar logs no Explore: `{service="viordles"} |= "<requestId>"`.
Loki coleta logs novos do bot e Lavalink; não reenvia todo histórico ao iniciar.
O logger remove credenciais conhecidas e URLs; o Alloy aplica uma segunda filtragem.
Erros/mensagens fora do logger também passam pelo filtro do Alloy.

## Limites e custo

- Prometheus: 14 dias **ou** 2 GB de blocos, o que ocorrer primeiro (WAL/head usam espaço adicional).
- Loki: retenção 7 dias; coleta global limitada a 1 linha/s, burst 20, linhas até 8 KB.
  Excedentes são descartados e contabilizados — não há cobrança por excesso.
- Logs PM2: rotação diária ou 20 MB, checada de hora em hora; cinco arquivos antigos.
  `copytruncate` pode perder algumas linhas durante a rotação.
- CPU por serviço: 50% de um núcleo; prioridade inferior à do bot. Memória máxima
  512 MB por serviço, exceto Alloy 384 MB. Falha do monitoramento não reinicia o bot.
- Sem IDs de usuários, servidores, músicas ou URLs como labels. Scrape do bot a cada
  30s com limite 2000 amostras. Cache/buffers do áudio são independentes da telemetria.

## Alertas

Regras em `alerts.yml`: bot offline, Lavalink indisponível, erros/travamentos e blocos lentos.
Exibidas no painel e no Prometheus (via túnel porta 9090). **Não enviam mensagens externas**:
nenhum webhook ou destinatário foi configurado. O monitor no mesmo host não detecta
uma queda total da Oracle enquanto ela acontece; um monitor externo seria uma etapa separada.

## Instalação e manutenção

`install-local.py` é específico da Oracle ARM64 e usa binários OSS com SHA256 verificado.
Execute como ubuntu, com sudo disponível. Versões fixas: Grafana 13.2.1,
Prometheus 3.14.0, Loki 3.7.7, Alloy 1.19.2. Configs validadas pelos binários.
Serviços systemd: `viordles-{grafana,prometheus,loki,alloy}`.

`prom-client` 15.1.3 foi mantido por compatibilidade com Node 20 da produção.
O sucessor `@prometheus-io/client` 0.16.1 requer Node 22/24/26; trocar junto de uma
migração do runtime, não atualizar a dependência isoladamente.

## Grafana Cloud Free, se quisermos migrar depois

O endpoint Prometheus e os logs JSON já permitem migração sem instrumentar tudo de novo.
No Cloud: selecionar explicitamente **Free**, sem trial pago/Pro/cartão. Obter os
endpoints e credenciais de métricas/logs no portal e armazenar em arquivo 600 fora do repo.
Alterar destinos do coletor só após validar a conta e o limite gratuito vigente.
A alternativa local permanece disponível caso a oferta gratuita mude; não há
upgrade automático nem envio a um serviço Cloud nesta implementação.

Fontes: https://grafana.com/pricing/ e https://prometheus.io/docs/prometheus/latest/storage/
