using System.Text.Json.Serialization;

namespace ChessAI.Api.Models;

public class MoveRequest
{
    // Current FEN of the board for the side to move (AI will move for the side to move).
    [JsonPropertyName("fen")]
    public string Fen { get; set; } = string.Empty;

    // Legal moves for the side to move, expressed as UCI strings (e.g., "e2e4", "e7e8q").
    [JsonPropertyName("legalMoves")]
    public List<string> LegalMoves { get; set; } = new();

    // Difficulty: "easy" | "medium" | "hard"
    [JsonPropertyName("difficulty")]
    public string Difficulty { get; set; } = "medium";
}
