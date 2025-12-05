using ChessAI.Api.Models;
using ChessAI.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Services
builder.Services.AddHttpClient();
builder.Services.AddSingleton<OpenAiMoveService>();

var app = builder.Build();

// Serve static frontend from wwwroot (index.html will be default)
app.UseDefaultFiles();
app.UseStaticFiles();

// Health check
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// AI move endpoint
app.MapPost("/api/move", async (MoveRequest req, OpenAiMoveService ai, CancellationToken ct) =>
{
    req.LegalMoves ??= new List<string>();
    var result = await ai.GetMoveAsync(req, ct);
    return Results.Ok(result);
});

app.Run();
