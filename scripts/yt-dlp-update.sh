#!/bin/bash
# Mantém o yt-dlp no canal nightly.
#
# O canal stable chega a passar seis semanas sem release, e o yt-dlp é a única
# peça que ainda acompanha as defesas do YouTube — o plugin do Lavalink parou de
# acompanhar. Quando ele envelhece, a reprodução de música do bot para.
#
# Instalado em /usr/local/bin/yt-dlp-update.sh e chamado pelo cron do root,
# que é quem tem permissão de escrita no binário.
set -u

BIN=/usr/local/bin/yt-dlp
LOG=/var/log/yt-dlp-update.log

before=$("$BIN" --version 2>/dev/null)
out=$("$BIN" --update-to nightly@latest 2>&1)
after=$("$BIN" --version 2>/dev/null)

if [ "$before" = "$after" ]; then
  printf '[%s] sem mudanca (%s)\n' "$(date -Is)" "$after" >>"$LOG"
else
  printf '[%s] atualizado %s -> %s\n' "$(date -Is)" "$before" "$after" >>"$LOG"
  printf '%s\n' "$out" | grep -v 'Deprecated Feature' >>"$LOG"
fi

# O log antigo crescia sem limite; mantém só o histórico recente.
if tail -n 300 "$LOG" >"$LOG.tmp" 2>/dev/null; then
  mv "$LOG.tmp" "$LOG"
fi
