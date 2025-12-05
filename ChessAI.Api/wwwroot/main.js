"use strict";

// Ensure chess.js is loaded
if (!window.Chess) {
  alert("Failed to load chess.js. Please check your internet connection.");
}

// Game state
const game = new window.Chess();
let orientation = "white"; // "white" | "black" (visual only)
let humanColor = "w"; // user plays white
let selectedSquare = null;
let legalTargets = [];
let lastMove = null;
let isThinking = false;

// UI elements
const $board = document.getElementById("board");
const $status = document.getElementById("status");
const $moveList = document.getElementById("moveList");
const $turnIndicator = document.getElementById("turnIndicator");
const $inCheck = document.getElementById("inCheck");
const $difficulty = document.getElementById("difficulty");
const $newGame = document.getElementById("newGame");
const $flipBoard = document.getElementById("flipBoard");

// Pieces (Unicode)
const PIECES = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

// Utilities
const files = ["a","b","c","d","e","f","g","h"];
const ranks = ["1","2","3","4","5","6","7","8"];

function squareColor(fileIndex, rankIndex) {
  // fileIndex [0..7], rankIndex [0..7] top-to-bottom
  return (fileIndex + rankIndex) % 2 === 0 ? "light" : "dark";
}

function coordToSquare(file, rank) {
  return `${file}${rank}`;
}

function getSquareOrder() {
  // Return an array of square names in the order they should be rendered
  const order = [];
  const fileOrder = orientation === "white" ? files : [...files].reverse();
  const rankOrder = orientation === "white" ? [...ranks].reverse() : ranks;

  for (const r of rankOrder) {
    for (const f of fileOrder) {
      order.push(`${f}${r}`);
    }
  }
  return order;
}

function pieceChar(piece) {
  if (!piece) return "";
  return PIECES[piece.color][piece.type] || "";
}

function clearSelection() {
  selectedSquare = null;
  legalTargets = [];
}

function uciFromVerboseMove(m) {
  return (m.from + m.to + (m.promotion ? m.promotion : "")).toLowerCase();
}

function getLegalUciMoves() {
  const verbose = game.moves({ verbose: true });
  return verbose.map(uciFromVerboseMove);
}

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Rendering
function renderBoard() {
  $board.innerHTML = "";

  const squares = getSquareOrder();
  squares.forEach((sq, i) => {
    const fIndex = i % 8; // 0..7 within row
    const rIndex = Math.floor(i / 8); // 0..7 rows from top
    const div = document.createElement("button");
    div.className = `square ${squareColor(fIndex, rIndex)}`;
    div.id = sq;
    div.setAttribute("role", "gridcell");
    div.setAttribute("aria-label", `Square ${sq}`);
    div.setAttribute("tabindex", "0");

    const p = game.get(sq);
    if (p) {
      const span = document.createElement("span");
      span.className = "piece";
      span.textContent = pieceChar(p);
      div.appendChild(span);
    }

    // last-move highlight
    if (lastMove && (sq === lastMove.from || sq === lastMove.to)) {
      div.classList.add("last-move");
    }

    // in-check highlight (king)
    if (game.in_check()) {
      const kingSquare = findKingSquare(game.turn());
      if (kingSquare === sq) {
        div.classList.add("in-check");
      }
    }

    // legal target hints (full-cell overlay)
    if (selectedSquare && legalTargets.includes(sq)) {
      div.classList.add("hint-target");
    }

    // selected square highlight
    if (selectedSquare === sq) {
      div.classList.add("selected");
    }

    // Click handler
    div.addEventListener("click", () => onSquareClick(sq));
    $board.appendChild(div);
  });
}

function findKingSquare(color) {
  for (const f of files) {
    for (const r of ranks) {
      const sq = f + r;
      const piece = game.get(sq);
      if (piece && piece.type === "k" && piece.color === color) {
        return sq;
      }
    }
  }
  return null;
}

function updateStatus() {
  if (game.game_over()) {
    let msg = "Game over: ";
    if (game.in_checkmate()) {
      msg += game.turn() === "w" ? "Black wins by checkmate." : "White wins by checkmate.";
    } else if (game.in_draw()) {
      msg += "Draw.";
    } else {
      msg += "Ended.";
    }
    $status.textContent = msg;
    $turnIndicator.textContent = "Game Over";
    $inCheck.classList.add("hidden");
    return;
  }

  if (game.turn() === humanColor) {
    $turnIndicator.textContent = "Your turn";
  } else {
    $turnIndicator.textContent = "AI thinking...";
  }

  if (game.in_check()) {
    $inCheck.classList.remove("hidden");
  } else {
    $inCheck.classList.add("hidden");
  }

  const desc = `Turn: ${game.turn() === "w" ? "White" : "Black"}${game.in_check() ? " (Check!)" : ""}`;
  $status.textContent = desc;
}

function updateMoveList() {
  const hist = game.history({ verbose: true });
  $moveList.innerHTML = "";
  // Render as an ordered list (already <ol>)
  hist.forEach((m) => {
    const li = document.createElement("li");
    li.textContent = m.san;
    $moveList.appendChild(li);
  });
}

function getSquareCenter(el) {
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

async function animateMove(fromSq, toSq, pieceSymbol) {
  const fromEl = document.getElementById(fromSq);
  const toEl = document.getElementById(toSq);
  if (!fromEl || !toEl) return;

  const fromCenter = getSquareCenter(fromEl);
  const toCenter = getSquareCenter(toEl);

  const ghost = document.createElement("div");
  ghost.className = "ghost-piece";
  ghost.style.left = `${fromCenter.x}px`;
  ghost.style.top = `${fromCenter.y}px`;
  ghost.textContent = pieceSymbol;

  document.body.appendChild(ghost);

  // Move after a frame so CSS transition applies
  await sleep(10);
  ghost.style.left = `${toCenter.x}px`;
  ghost.style.top = `${toCenter.y}px`;

  await sleep(200);
  ghost.style.opacity = "0";
  await sleep(80);
  ghost.remove();
}

// Interactions
function isUsersTurn() {
  return game.turn() === humanColor && !isThinking && !game.game_over();
}

function isOwnPiece(square) {
  const piece = game.get(square);
  return piece && piece.color === humanColor;
}

function highlightLegalMoves(square) {
  const moves = game.moves({ square, verbose: true });
  legalTargets = moves.map((m) => m.to);
}

function clearHighlights() {
  legalTargets = [];
}

async function onSquareClick(square) {
  if (!isUsersTurn()) return;

  if (!selectedSquare) {
    // No selection yet
    if (!isOwnPiece(square)) {
      return;
    }
    selectedSquare = square;
    highlightLegalMoves(square);
    renderBoard();
    return;
  }

  // If clicking same square -> unselect
  if (selectedSquare === square) {
    clearSelection();
    renderBoard();
    return;
  }

  // If user clicked a target square -> attempt move
  if (legalTargets.includes(square)) {
    let move = { from: selectedSquare, to: square, promotion: undefined };

    // Check if promotion is needed (pawn reaching last rank)
    const piece = game.get(selectedSquare);
    if (piece && piece.type === "p") {
      const toRank = square[1];
      if ((piece.color === "w" && toRank === "8") || (piece.color === "b" && toRank === "1")) {
        // Ask for promotion piece
        move.promotion = await promptPromotion(piece.color);
      }
    }

    // Animate using the symbol from the starting square
    const symbol = pieceChar(piece);

    // Apply the move in the game
    const result = game.move(move);
    if (!result) {
      // Illegal (should not happen given hints)
      clearSelection();
      renderBoard();
      return;
    }

    lastMove = { from: result.from, to: result.to };
    clearSelection();

    // Animate
    await animateMove(result.from, result.to, symbol);

    // Update UI
    renderBoard();
    updateMoveList();
    updateStatus();

    // Trigger AI move if game not over
    if (!game.game_over()) {
      await aiMove();
    }
  } else {
    // If clicking another piece of ours -> switch selection
    if (isOwnPiece(square)) {
      selectedSquare = square;
      highlightLegalMoves(square);
      renderBoard();
      return;
    }
    // Otherwise ignore
  }
}

function promptPromotion(color) {
  // Simple modal-like prompt using window UI
  // For colorful UX, you might replace this with a custom overlay; here we keep it simple.
  return new Promise((resolve) => {
    const choices = ["q", "r", "b", "n"];
    // For quick UX, we can default to 'q' if user cancels or closes
    const piece = prompt("Promote to (q,r,b,n)?", "q");
    const v = (piece || "q").toLowerCase();
    resolve(choices.includes(v) ? v : "q");
  });
}

async function aiMove() {
  if (game.game_over()) return;

  isThinking = true;
  updateStatus();

  try {
    const legalUci = getLegalUciMoves();
    const payload = {
      fen: game.fen(),
      legalMoves: legalUci,
      difficulty: $difficulty.value || "medium",
    };

    const resp = await fetch("/api/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      // Fallback
      await aiFallbackMove();
    } else {
      const data = await resp.json();
      let { from, to, promotion } = data;

      // Validate client-side
      const mv = game.move({ from, to, promotion: promotion || undefined });
      if (!mv) {
        // If server responded with something odd, fallback
        await aiFallbackMove();
      } else {
        const symbol = pieceChar({ color: mv.color, type: mv.piece });
        lastMove = { from: mv.from, to: mv.to };
        await animateMove(mv.from, mv.to, symbol);
      }
    }
  } catch (err) {
    // Network or parsing failure
    await aiFallbackMove();
  } finally {
    isThinking = false;
    renderBoard();
    updateMoveList();
    updateStatus();
  }
}

async function aiFallbackMove() {
  // Pick a random legal move
  const legal = game.moves({ verbose: true });
  if (legal.length === 0) return;
  const pick = legal[Math.floor(Math.random() * legal.length)];
  const symbol = pieceChar({ color: game.turn(), type: pick.piece });
  const mv = game.move(pick);
  if (mv) {
    lastMove = { from: mv.from, to: mv.to };
    await animateMove(mv.from, mv.to, symbol);
  }
}

// Controls
$newGame.addEventListener("click", async () => {
  game.reset();
  clearSelection();
  lastMove = null;
  isThinking = false;
  renderBoard();
  updateMoveList();
  updateStatus();
});

$flipBoard.addEventListener("click", () => {
  orientation = orientation === "white" ? "black" : "white";
  renderBoard();
});

// Initial render
function init() {
  renderBoard();
  updateMoveList();
  updateStatus();
}

init();
