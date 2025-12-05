using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ChessAI.Api.Models;

namespace ChessAI.Api.Services;

public class OpenAiMoveService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly string? _apiKey;
    private static readonly Regex UciRegex = new(@"^[a-h][1-8][a-h][1-8][qrbn]?$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public OpenAiMoveService(IHttpClientFactory httpClientFactory, IConfiguration config)
    {
        _httpClientFactory = httpClientFactory;
        // Prefer environment variable; fallback to configuration (e.g., appsettings)
        _apiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY") ?? config["OpenAI:ApiKey"];
    }

    public async Task<MoveResponse> GetMoveAsync(MoveRequest request, CancellationToken ct = default)
    {
        var legalMoves = (request.LegalMoves ?? new List<string>())
            .Where(m => !string.IsNullOrWhiteSpace(m))
            .Select(m => m.Trim().ToLowerInvariant())
            .Where(m => UciRegex.IsMatch(m))
            .Distinct()
            .ToList();

        if (legalMoves.Count == 0)
        {
            // No valid legal moves provided -> return empty (caller should handle game over)
            return new MoveResponse { Uci = string.Empty, From = string.Empty, To = string.Empty, Promotion = null };
        }

        // If no API key configured, immediately fallback to random legal move
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            var fallback = ChooseRandom(legalMoves);
            return ToMoveResponse(fallback);
        }

        var temperature = DifficultyToTemperature(request.Difficulty);
        var systemPrompt =
            "You are a chess assistant. You are given a chess position (FEN) and an explicit list of LEGAL UCI moves. " +
            "Select exactly ONE move that is present in the provided list. Output ONLY the UCI string, with no commentary. " +
            "If any information is inconsistent, still pick a move strictly from the provided legal moves list.";

        var userPrompt = BuildUserPrompt(request.Fen, legalMoves, request.Difficulty);

        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(20);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

            var payload = new
            {
                model = "gpt-4o-mini",
                temperature = temperature,
                max_tokens = 10,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            var json = JsonSerializer.Serialize(payload);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            using var response = await client.PostAsync("https://api.openai.com/v1/chat/completions", content, ct);
            if (!response.IsSuccessStatusCode)
            {
                // Fallback on any non-success status
                var fb = ChooseRandom(legalMoves);
                return ToMoveResponse(fb);
            }

            var respString = await response.Content.ReadAsStringAsync(ct);
            var uci = ExtractUciFromChatResponse(respString, legalMoves);
            if (uci is null)
            {
                var fb = ChooseRandom(legalMoves);
                return ToMoveResponse(fb);
            }

            return ToMoveResponse(uci);
        }
        catch
        {
            // Network/timeout/parse error -> fallback
            var fb = ChooseRandom(legalMoves);
            return ToMoveResponse(fb);
        }
    }

    private static string BuildUserPrompt(string fen, List<string> legalMoves, string difficulty)
    {
        var difficultyNote = difficulty?.Trim().ToLowerInvariant() switch
        {
            "easy" => "Choose a random or non-optimal move from the list.",
            "hard" => "Choose the strongest move you can from the list.",
            _ => "Choose a reasonable move from the list."
        };

        var sb = new StringBuilder();
        sb.AppendLine("FEN:");
        sb.AppendLine(fen ?? string.Empty);
        sb.AppendLine();
        sb.AppendLine("LEGAL MOVES (UCI):");
        sb.AppendLine(string.Join(", ", legalMoves));
        sb.AppendLine();
        sb.AppendLine("DIFFICULTY:");
        sb.AppendLine(difficulty ?? "medium");
        sb.AppendLine();
        sb.AppendLine("INSTRUCTIONS:");
        sb.AppendLine(difficultyNote);
        sb.AppendLine("Return ONLY one UCI string (e.g., e2e4 or e7e8q). No extra text.");

        return sb.ToString();
    }

    private static double DifficultyToTemperature(string? difficulty)
    {
        switch ((difficulty ?? "medium").Trim().ToLowerInvariant())
        {
            case "easy":
                return 0.8;
            case "hard":
                return 0.0;
            default:
                return 0.3;
        }
    }

    private static string? ExtractUciFromChatResponse(string json, List<string> legalMoves)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Expected shape: { choices: [ { message: { content: "e2e4" } } ] }
            if (root.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0)
            {
                var first = choices[0];

                if (first.TryGetProperty("message", out var message) &&
                    message.TryGetProperty("content", out var contentEl) &&
                    contentEl.ValueKind == JsonValueKind.String)
                {
                    var content = contentEl.GetString()?.Trim()?.ToLowerInvariant() ?? string.Empty;

                    // If the model added extra text, try to find a UCI pattern inside.
                    var match = Regex.Match(content, @"[a-h][1-8][a-h][1-8][qrbn]?", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        var uci = match.Value.ToLowerInvariant();
                        // Ensure the move is in provided legal moves
                        if (legalMoves.Contains(uci))
                        {
                            return uci;
                        }
                    }

                    // If content itself matches and is legal
                    if (UciRegex.IsMatch(content) && legalMoves.Contains(content))
                    {
                        return content;
                    }
                }
            }
        }
        catch
        {
            // Ignore parse errors; handled by caller fallback
        }

        return null;
    }

    private static string ChooseRandom(List<string> legalMoves)
    {
        var rng = Random.Shared;
        var idx = rng.Next(0, legalMoves.Count);
        return legalMoves[idx];
    }

    private static MoveResponse ToMoveResponse(string uci)
    {
        var from = uci[..2];
        var to = uci.Substring(2, 2);
        string? promo = uci.Length == 5 ? uci.Substring(4, 1) : null;

        return new MoveResponse
        {
            Uci = uci,
            From = from,
            To = to,
            Promotion = promo
        };
    }
}
