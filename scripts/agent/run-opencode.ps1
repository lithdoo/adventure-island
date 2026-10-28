param(
    [Parameter(Mandatory = $true)]
    [string]$SpecPath,

    [Parameter(Mandatory = $true)]
    [int]$DesignPr
)

$ErrorActionPreference = "Stop"

$bin = $null
if ($env:OPENCODE_BIN) {
    $bin = $env:OPENCODE_BIN
} else {
    $command = Get-Command opencode2 -ErrorAction SilentlyContinue
    if ($command) {
        $bin = if ($command.Source) { $command.Source } else { $command.Name }
    }
}

if (-not $bin) {
    throw "opencode2 is not available in the self-hosted runner environment."
}

$versionOutput = @(& $bin --version 2>&1)
$versionExitCode = $LASTEXITCODE
$version = ($versionOutput | Select-Object -First 1 | Out-String).Trim()
if ($versionExitCode -ne 0) {
    $preview = ($versionOutput | Select-Object -First 5 | Out-String).Trim()
    throw "OpenCode failed its --version check with exit code $versionExitCode. Output: $preview"
}
Write-Host "Using OpenCode: $version"

if (-not $env:CMS079_ROOT) {
    $env:CMS079_ROOT = "F:\CMS079"
}

try {
    $cms079Root = (Resolve-Path -LiteralPath $env:CMS079_ROOT -ErrorAction Stop).ProviderPath
} catch {
    throw "CMS079 reference directory is not accessible: $($env:CMS079_ROOT)"
}

if (-not (Test-Path -LiteralPath $cms079Root -PathType Container)) {
    throw "CMS079 reference input must be a directory."
}

$cms079Canonical = (($cms079Root -replace '\\', '/').TrimEnd('/'))
$cms079Pattern = "$cms079Canonical/*"

# Inline config is a runtime override layer. It intentionally does not set a
# provider or model: the runner's locally configured opencode2 owns those.
# This layer only constrains agent capabilities for CI execution.
$runtimeConfig = @{
    '$schema' = "https://opencode.ai/config.json"
    update = "disable"
    permissions = @(
        @{ action = "external_directory"; resource = "*"; effect = "deny" },
        @{ action = "external_directory"; resource = $cms079Pattern; effect = "allow" },
        @{ action = "read"; resource = $cms079Pattern; effect = "allow" },
        @{ action = "edit"; resource = $cms079Pattern; effect = "deny" },
        @{ action = "webfetch"; resource = "*"; effect = "deny" },
        @{ action = "websearch"; resource = "*"; effect = "deny" },
        @{ action = "question"; resource = "*"; effect = "deny" },
        @{ action = "shell"; resource = "*"; effect = "deny" },
        @{ action = "shell"; resource = "git status *"; effect = "allow" },
        @{ action = "shell"; resource = "git diff *"; effect = "allow" },
        @{ action = "shell"; resource = "git ls-files *"; effect = "allow" },
        @{ action = "shell"; resource = "git grep *"; effect = "allow" },
        @{ action = "shell"; resource = "node *"; effect = "allow" },
        @{ action = "shell"; resource = "npm test *"; effect = "allow" },
        @{ action = "shell"; resource = "npm run *"; effect = "allow" },
        @{ action = "shell"; resource = "python *"; effect = "allow" },
        @{ action = "shell"; resource = "python3 *"; effect = "allow" },
        @{ action = "shell"; resource = "py *"; effect = "allow" }
    )
    policies = @(
        @{ action = "tool.use"; resource = "read:*.env*"; effect = "deny" },
        @{ action = "tool.use"; resource = "read:*/.ssh/*"; effect = "deny" },
        @{ action = "tool.use"; resource = "shell:git push *"; effect = "deny" },
        @{ action = "tool.use"; resource = "shell:git commit *"; effect = "deny" },
        @{ action = "tool.use"; resource = "shell:gh *"; effect = "deny" },
        @{ action = "tool.use"; resource = "shell:curl *"; effect = "deny" },
        @{ action = "tool.use"; resource = "shell:wget *"; effect = "deny" },
        @{ action = "tool.use"; resource = "shell:Invoke-WebRequest *"; effect = "deny" }
    )
}
$env:OPENCODE_CONFIG_CONTENT = ($runtimeConfig | ConvertTo-Json -Depth 10 -Compress)

$spec = Get-Content -LiteralPath $SpecPath -Raw -Encoding UTF8

$prompt = @"
You are implementing an approved design task for the adventure-island repository.

Design PR: #$DesignPr

Local CMS079 reference input:
- Root directory: $cms079Root
- This directory contains the locally supplied CMS 079 client/reference files.
- Use it when the task needs evidence from the real client or WZ/resource inputs.
- Treat everything under this directory as read-only source material.
- Never edit, rename, delete, patch, or replace files under this directory.
- Never copy original client binaries, WZ files, archives, or bulk extracted assets into the repository.
- Repository output may contain only derived code, metadata, tests, or documentation explicitly allowed by the task.

Repository rules:
- Treat the current directory as the trusted code baseline.
- Follow DESIGN.md and relevant component/library design documents.
- Implement only what the task requests.
- Do not modify .github/**.
- Do not modify loom-realm/**.
- Do not modify task/dev/**.
- Do not modify scripts/agent/**.
- Do not add WZ files, client binaries, archives, dumps, credentials, or secrets.
- Do not run git push, git commit, gh, curl, wget, or any command intended to publish or exfiltrate changes.
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

& $bin run --standalone --auto $prompt
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
