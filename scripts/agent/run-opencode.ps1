param(
    [Parameter(Mandatory = $true)]
    [string]$SpecPath,

    [Parameter(Mandatory = $true)]
    [int]$DesignPr
)

$ErrorActionPreference = "Stop"

$command = Get-Command opencode2 -ErrorAction SilentlyContinue
if (-not $command) {
    $command = Get-Command opencode -ErrorAction SilentlyContinue
}
if (-not $command) {
    throw "Neither opencode2 nor opencode is available on this runner."
}

$bin = if ($command.Source) { $command.Source } else { $command.Name }
$version = (& $bin --version 2>&1 | Select-Object -First 1 | Out-String).Trim()
Write-Host "Using $($command.Name): $version"

$spec = Get-Content -LiteralPath $SpecPath -Raw -Encoding UTF8

$prompt = @"
You are implementing an approved design task for the adventure-island repository.

Design PR: #$DesignPr

Repository rules:
- Treat the current directory as the trusted code baseline.
- Follow DESIGN.md and relevant component/library design documents.
- Implement only what the task requests.
- Do not modify .github/**.
- Do not modify loom-realm/**.
- Do not modify task/dev/**.
- Do not modify scripts/agent/**.
- Do not add WZ files, client binaries, archives, dumps, credentials, or secrets.
- Do not run git push, gh, curl-to-GitHub, or any command intended to publish changes.
- Do not commit changes. The surrounding automation owns Git publication.
- Add or update tests when appropriate.
- Run useful local tests while working.
- Keep all repository changes inside the task's Allowed Paths.

Approved task document:

--- BEGIN DESIGN TASK ---
$spec
--- END DESIGN TASK ---

Implement the task now. Before finishing, inspect your diff and run relevant tests. Leave the working tree with the implementation changes uncommitted.
"@

foreach ($name in @("GITHUB_TOKEN", "GH_TOKEN", "AGENT_GITHUB_TOKEN")) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
}

& $bin run $prompt
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
