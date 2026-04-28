# Viordles

Bot do Discord para meu servidor privado. Gerencie listas de filmes, séries, animes, animações e jogos com votações, avaliações e eventos.

## Stack

- [discord.js](https://discord.js.org/) v14
- PostgreSQL via `pg`
- [TMDB API](https://www.themoviedb.org/documentation/api) — posters de filmes, séries e animes
- [RAWG API](https://rawg.io/apidocs) — imagens de jogos
- PM2 para processo em produção
- Oracle Cloud (Ubuntu 22.04)

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

### 📣 Geral

| Subcomando | Descrição |
|---|---|
| `evento` | Cria aviso de evento com imagem automática *(admin)* |
| `enquete` | Cria uma enquete com até 5 opções e ping opcional |

