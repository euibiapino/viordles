# Viordles

Bot do Discord para meu servidor privado. Gerencie listas de filmes, séries, animes, animações e jogos com votações, avaliações e eventos.

## Stack

- [discord.js](https://discord.js.org/) v14 + Node.js 22
- PostgreSQL via `pg` (pool com timeouts + handler de erro)
- [Lavalink](https://lavalink.dev/) v4 (Java 21) — player de áudio
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — resolução do YouTube (via Cloudflare WARP SOCKS5)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api) — enriquecimento de metadados
- [TMDB API](https://www.themoviedb.org/documentation/api) — posters de filmes, séries e animes
- [RAWG API](https://rawg.io/apidocs) — imagens de jogos
- [zod](https://zod.dev/) — validação de env vars no boot (fail-fast)
- [lru-cache](https://www.npmjs.com/package/lru-cache) — cache de chamadas externas (TMDB, RAWG, Spotify)
- ESLint + Prettier — qualidade e formatação
- PM2 com `ecosystem.config.js` — process manager, memory limits, graceful shutdown
- Oracle Cloud ARM (Ubuntu 22.04)

## Comandos

### 🎬 Filme · 📺 Série · ⛩️ Anime · 🎠 Animação

| Subcomando | Descrição |
|---|---|
| `sugerir <titulo>` | Busca no TMDB e adiciona à lista de pendentes |
| `listar [pagina]` | Lista os títulos pendentes (20 por página) |
| `votar` | Cria votação com até 10 títulos aleatórios |
| `sortear` | Sorteia um título da lista |
| `assistido <titulo>` | Marca como assistido |
| `avaliar <titulo> <nota>` | Avalia de 0 a 10 (atualiza se já avaliou) |
| `ranking` | Ranking dos mais bem avaliados |

### 🎮 Jogo

| Subcomando | Descrição |
|---|---|
| `lg <nome> [mensagem] [role]` | Chama o grupo pra jogar |
| `times [quantidade]` | Divide a call em times aleatórios |
| `placar <nome> <vencedor> <perdedor>` | Registra resultado de partida |
| `ranking` | Ranking geral de vitórias |
| `sorteio <user1> <user2> ...` | Sorteia um participante (até 8) |

### 🎵 Música

| Subcomando | Descrição |
|---|---|
| `tocar <query>` | Toca uma música (texto, URL YouTube ou Spotify) |
| `pular` · `anterior` | Pula / volta na fila |
| `pausar` · `retomar` · `parar` | Controle de reprodução |
| `fila` · `tocando` | Mostra fila / painel do player |
| `volume <0–200>` | Ajusta o volume |
| `repetir <modo>` | Desligado, música ou fila |
| `shuffle` · `mover` · `remover` · `pular-para` · `limpar` | Gestão da fila |
| `seek` · `avancar` · `retroceder` | Navega na faixa |
| `letras` · `efeito` | Letra atual / efeitos de áudio |

### 📣 Geral

| Subcomando | Descrição |
|---|---|
| `evento` | Cria aviso de evento com imagem automática *(admin)* |
| `enquete` | Cria uma enquete com até 5 opções e ping opcional |

## Setup local

```bash
cp .env.example .env       # preencher com tokens reais
npm install
npm run dev                # nodemon + .env.test
```

A primeira coisa que o bot faz no boot é validar todas as env vars via `src/config.js`. Se faltar/estiver inválida, o processo morre com mensagem clara.

## Qualidade de código

```bash
npm run lint        # roda ESLint
npm run lint:fix    # corrige o que dá pra corrigir
npm run format      # roda Prettier em src/ e scripts/
```

## Deploy

```bash
pm2 start ecosystem.config.js   # primeira vez (servidor)
pm2 restart viordles            # atualizar bot
pm2 restart lavalink            # atualizar Lavalink
pm2 save
```

## Player de música — arquitetura

```
/musica tocar <query>
       │
       ▼
Bot ─→ yt-dlp (via WARP SOCKS5) ─→ YouTube API ─→ URL googlevideo
       │
       ├─→ Spotify API ─→ metadata limpa (título / capa / artista)
       │
       └─→ Lavalink (sem proxy) ─→ googlevideo ─→ Discord voice
```

WARP é usado **apenas** pelo yt-dlp para contornar bloqueio do IP do Oracle no YouTube. O streaming sai direto do servidor para reduzir latência.

