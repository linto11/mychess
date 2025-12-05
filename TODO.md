# Chess App (ASP.NET Core + Pure JS) - TODO

Status: Planned

## Backend (ASP.NET Core .NET 8 Minimal API)
- [x] Scaffold ASP.NET Core minimal API project (ChessAI.Api)
- [x] Configure static file serving (UseDefaultFiles + UseStaticFiles) and host frontend from wwwroot
- [ ] Add Models:
  - [x] Models/MoveRequest.cs (fen, legalMoves[], difficulty)
  - [x] Models/MoveResponse.cs (uci, from, to, promotion?)
- [ ] Add Services:
  - [x] Services/OpenAiMoveService.cs (HttpClient call to OpenAI Chat Completions, difficulty handling, validation/fallback)
- [ ] Add Endpoint:
  - [x] POST /api/move: accepts MoveRequest, calls OpenAiMoveService, validates against legalMoves, returns MoveResponse
  - [x] GET /health (optional health check)
- [x] Read OPENAI_API_KEY from environment variables
- [ ] Enable minimal CORS if needed (should not be necessary when serving same origin)

## Frontend (Pure JavaScript in wwwroot)
- [x] Create wwwroot/index.html
  - [x] Colorful UI/UX layout: header, controls (difficulty, new game, flip), status, move list
  - [x] Board container
  - [x] Load chess.js via CDN
  - [x] Load main.js and styles.css
- [x] Create wwwroot/styles.css
  - [x] Vivid gradient background
  - [x] Checkerboard with contrasting colors
  - [x] Highlights: selected square, legal targets, last move, check
  - [x] Smooth animations via CSS transitions/transforms
- [x] Create wwwroot/main.js
  - [x] Initialize Chess game
  - [x] Render 8x8 board and Unicode pieces
  - [x] Click-to-select and legal move highlighting
  - [x] Animate moves (ghost piece translate animation)
  - [x] On user move: update FEN, compute legalMoves for AI, call /api/move with difficulty
  - [x] Animate AI move and update state
  - [x] Detect game end (checkmate, stalemate, draw)
  - [x] Fallback: if API fails, pick random legal move client-side
  - [x] Flip board toggle

## Difficulty Strategy
- [x] Map difficulty to temperature and prompt guidance:
  - easy: temperature 0.8 (randomish or suboptimal allowed)
  - medium: temperature 0.3 (reasonable)
  - hard: temperature 0.0 (best move)
- [x] Strict prompt: model must return ONE legal UCI move from provided legalMoves only

## Configuration & Run
- [ ] Ensure .NET 8 SDK available
- [x] dotnet run from ChessAI.Api directory
- [ ] Set environment variable: OPENAI_API_KEY
- [ ] Open app in browser (http://localhost:5000 or shown port)

## Polish & Docs
- [ ] README with instructions and screenshots
- [ ] Fine-tune animations and color palette
- [ ] Basic error notifications in UI
