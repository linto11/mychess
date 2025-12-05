using System.Text.Json.Serialization;

namespace ChessAI.Api.Models;

public class MoveResponse
{
    // The selected move in UCI format, e.g. "e2e4" or "e7e8q"
    [JsonPropertyName("uci")]
    public string Uci { get; set; } = string.Empty;

    // From-square in algebraic coordinates, e.g. "e2"
    [JsonPropertyName("from")]
    public string From { get; set; } = string.Empty;

    // To-square in algebraic coordinates, e.g. "e4"
    [JsonPropertyName("to")]
    public string To { get; set; } = string.Empty;

    // Optional promotion piece in lowercase: q, r, b, or n
    [JsonPropertyName("promotion")]
    public string? Promotion { get; set; }
}
