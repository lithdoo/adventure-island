param(
    [Parameter(Mandatory = $true)]
    [string]$SpecPath,

    [Parameter(Mandatory = $true)]
    [int]$DesignPr
)

$ErrorActionPreference = "Stop"

function Read-RegistryEnvironmentValue {
    param([string]$Name)

    foreach ($path in @(
        "HKCU:\Environment",
        "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
    )) {
        try {
            $value = (Get-ItemProperty -Path $path -Name $Name -ErrorAction Stop).$Name
            if ($value) { return [string]$value }
        } catch {
            # Try the next registry scope.
        }
    }

    # The runner service can have a different HKCU than the interactive user
    # that installed/configured OpenCode. Check already-loaded user hives
    # without printing SIDs, profile names, or credential values.
    try {
        foreach ($hive in (Get-ChildItem "Registry::HKEY_USERS" -ErrorAction Stop)) {
            $leaf = $hive.PSChildName
            if (-not $leaf -or $leaf.EndsWith("_Classes")) { continue }
            try {
                $path = "Registry::HKEY_USERS\$leaf\Environment"
                $value = (Get-ItemProperty -Path $path -Name $Name -ErrorAction Stop).$Name
                if ($value) { return [string]$value }
            } catch {
                continue
            }
        }
    } catch {
        # No loaded user hive with the value.
    }

    return $null
}

$bin = $null
if ($env:OPENCODE_BIN -and (Test-Path -LiteralPath $env:OPENCODE_BIN -PathType Leaf)) {
    $bin = $env:OPENCODE_BIN
} else {
    $command = Get-Command opencode2 -ErrorAction SilentlyContinue
    if (-not $command) {
        $command = Get-Command opencode -ErrorAction SilentlyContinue
    }
    if ($command) {
        $bin = if ($command.Source) { $command.Source } else { $command.Name }
    }
}

if (-not $bin) {
    throw "OpenCode executable was not supplied or discoverable."
}

$version = (& $bin --version 2>&1 | Select-Object -First 1 | Out-String).Trim()
Write-Host "Using OpenCode: $version"

# Mirror the existing glm-work/start-opencode.bat credential convention without
# ever logging the key. Prefer an already-provided environment variable.
if (-not $env:GLM_API_KEY) {
    $env:GLM_API_KEY = Read-RegistryEnvironmentValue "GLM_API_KEY"
}
if ($env:GLM_API_KEY) {
    if (-not $env:ZAI_API_KEY) { $env:ZAI_API_KEY = $env:GLM_API_KEY }
    if (-not $env:ZHIPU_API_KEY) { $env:ZHIPU_API_KEY = $env:GLM_API_KEY }
} elseif (-not $env:ZAI_API_KEY -and -not $env:ZHIPU_API_KEY) {
    throw "No GLM/Z.AI credential is available to the runner service. Configure GLM_API_KEY at machine scope or for the runner service account."
}

# OpenCode V2 supports an inline runtime config. Keep the existing local model
# choice, but do not reuse glm-work/opencode.json because its edit permission is
# intentionally scoped only to glm-work/.
$runtimeConfig = @{
    '$schema' = "https://opencode.ai/config.json"
    model = "zai-coding-plan/glm-5.3"
    update = "disable"
    permissions = @(
        @{ action = "external_directory"; resource = "*"; effect = "deny" },
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
        @{ action = "tool.use"; resource = "external_directory:*"; effect = "deny" },
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
