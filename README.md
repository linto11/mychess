# Colorful Chess — ASP.NET Core (.NET 8) + Pure JavaScript

A small, colorful chess application with smooth animations and a great UX. The user plays against an AI. The AI move is served by an ASP.NET Core backend that integrates with OpenAI. The frontend is plain HTML/CSS/JS and uses chess.js (v0.10.3) from CDN for chess rules and legal move generation.

- Human vs AI with difficulty levels (easy, medium, hard)
- Smooth piece-move animations
- Full-square legal move hints (contrasting overlays on light/dark squares)
- Move list (SAN)
- In-check indicator, last move highlight, flip board, new game
- Promotion UI (q, r, b, n)
- Robust fallback when OpenAI is not configured or unavailable

Pull Request: https://github.com/linto11/mychess/pull/1

## Screenshots

Add screenshots into `docs/screenshots/` and they will render here.

- Home / Board view  
  ![Home](docs/screenshots/home.png)

- Legal move hints (full-square overlay)  
  ![Hints](docs/screenshots/hints.png)

- Promotion dialog  
  ![Promotion](docs/screenshots/promotion.png)

Tip: To capture, start the app (see Run section), open the site, and take screenshots. Save them as the filenames above.

## Tech Stack

- Backend: ASP.NET Core .NET 8 Minimal API
- Frontend: Pure HTML/CSS/JS
- Chess rules: chess.js v0.10.3 (global `Chess` API from CDN)
- AI: OpenAI Chat Completions (model: gpt-4o-mini by default)
- Build/run: .NET SDK 8+

## Project Structure

```
mychess/
├─ ChessAI.Api/
│  ├─ Program.cs                        # Minimal API, serves wwwroot, maps /api/move, /health
│  ├─ Models/
│  │  ├─ MoveRequest.cs                 # { fen, legalMoves[], difficulty }
│  │  └─ MoveResponse.cs                # { uci, from, to, promotion? }
│  ├─ Services/
│  │  └─ OpenAiMoveService.cs           # Calls OpenAI; validates/fallbacks to random legal move
│  ├─ wwwroot/
│  │  ├─ index.html                     # UI shell, loads chess.js (0.10.3) and main.js
│  │  ├─ styles.css                     # Colorful theme, board, animations, full-square hints
│  │  └─ main.js                        # Game logic, UI interactions, animations, API calls
│  ├─ appsettings.json
│  └─ Properties/launchSettings.json
├─ docs/
│  └─ screenshots/
│     └─ .gitkeep
└─ README.md
```

## Features

- Smooth animations: piece moves animate via a ghost element for a polished look
- Full-square legal move hints: overlay tint; white on dark squares, black on light squares
- Difficulty control:
  - easy: temperature 0.8 — more random choices
  - medium: temperature 0.3 — reasonable moves
  - hard: temperature 0.0 — best move bias
- Fallback behavior: if the OpenAI service is missing/unavailable or returns an invalid move, the server picks a random legal move (to keep the game flowing)
- UX: in-check indicator, last move highlight, move list, flip board, new game

## Setup

Prerequisites:
- .NET SDK 8+
- Optional (for live AI): OpenAI API key

Environment:
- Set environment variable `OPENAI_API_KEY` to enable live AI.
  - PowerShell:
    ```
    $env:OPENAI_API_KEY="sk-..."
    ```
  - CMD:
    ```
    set OPENAI_API_KEY=sk-...
    ```

## Run

1) Start the backend (serves the frontend):
```
cd ChessAI.Api
dotnet run
```

2) Open the printed URL (e.g., http://localhost:5276) in your browser.
3) Hard refresh (Ctrl+F5) if needed to ensure the latest frontend is loaded.

Notes:
- If `OPENAI_API_KEY` is not set, the server returns a random legal move (fallback), so the game still works.

## Backend API

### Health
- GET `/health`
- Response: `200 OK` with `{ "status": "ok" }`

### AI Move
- POST `/api/move`
- Request body:
```json
{
  "fen": "string",
  "legalMoves": ["e2e4", "g1f3", "..."], 
  "difficulty": "easy | medium | hard"
}
```

- Response body:
```json
{
  "uci": "e7e5",
  "from": "e7",
  "to": "e5",
  "promotion": "q" // optional
}
```

- Behavior:
  - Validates the returned move to ensure it is one of the provided `legalMoves`
  - If invalid or any error occurs, returns a random legal move
  - Difficulty is applied by mapping temperature and instructions in the system/user prompt

### Example curl

Health:
```
curl -i http://localhost:5276/health
```

AI move (example FEN after 1.e4; black to move):
```
curl -i -X POST http://localhost:5276/api/move ^
  -H "Content-Type: application/json" ^
  -d "{ \"fen\": \"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1\", \"legalMoves\": [\"e7e5\",\"c7c5\",\"e7e6\"], \"difficulty\": \"medium\" }"
```

Adjust the port to match what `dotnet run` prints.

## Frontend Notes

- Uses chess.js v0.10.3 via CDN with global `Chess` API:
  ```html
  <script src="https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js" referrerpolicy="no-referrer"></script>
  ```
- UI behaviors in `wwwroot/main.js`:
  - Click-to-select piece, highlight legal targets, click target to move
  - Promotions via small selection UI (default to queen if needed)
  - After user move, calls `/api/move` with current FEN + legal move list for AI side
  - Animations via ghost piece; last move and in-check highlights
  - Controls: New Game, Flip Board, Difficulty

## Security

- `OPENAI_API_KEY` is read server-side only; never shipped to the browser
- No secrets in client logs
- If key is not present, app auto-falls back to random legal moves

## Customization

- Hint overlay tint (styles.css):
  - Light squares: `.square.light.hint-target::after { background: rgba(0,0,0,0.18); }`
  - Dark squares:  `.square.dark.hint-target::after  { background: rgba(255,255,255,0.22); }`

- Model and temperature mapping (OpenAiMoveService.cs):
  - Update `model` ("gpt-4o-mini" by default) and `DifficultyToTemperature()`

## Testing

Levels:
- Critical-path testing:
  - Load app, make a user move, verify AI response (live or fallback), check animations, last move highlight
  - Special moves (castling, en passant), promotion
  - Game end states (checkmate, stalemate, draw)
  - Controls (New Game, Flip, Difficulty)
- Thorough testing:
  - All of the above plus cross-browser checks (Chrome, Edge), responsiveness, accessibility (roles/keyboard focus)
  - API edge cases: malformed FEN, empty legalMoves, OpenAI network error/timeouts → verify server fallback

To run with fallback (no key): just start the app without `OPENAI_API_KEY`.

## Roadmap

- Optional stock piece SVG set
- Sound effects and settings
- Timers and move clocks
- Save/load PGN, export games
- Stronger difficulty heuristics on server-side fallback

## License

MIT
