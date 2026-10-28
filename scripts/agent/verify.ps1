param(
    [Parameter(Mandatory = $true)]
    [string]$SpecPath
)

$ErrorActionPreference = "Stop"

function Get-PythonCommand {
    foreach ($candidate in @("python3", "python")) {
        $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($cmd) {
            return @{
                Exe = if ($cmd.Source) { $cmd.Source } else { $cmd.Name }
                Prefix = @()
            }
        }
    }

    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) {
        return @{
            Exe = if ($py.Source) { $py.Source } else { $py.Name }
            Prefix = @("-3")
        }
    }

    throw "Python 3 is required on the self-hosted runner."
}

$python = Get-PythonCommand

function Invoke-Python {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $allArgs = @()
    $allArgs += @($python.Prefix)
    $allArgs += @($Arguments)

    & $python.Exe @allArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

Invoke-Python -Arguments @(
    (Join-Path $PSScriptRoot "verify_diff.py"),
    "--spec",
    $SpecPath
)

& git diff --check HEAD --
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$changed = @()
$changed += @(& git diff --name-only HEAD --)
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
$changed += @(& git ls-files --others --exclude-standard)
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
$changed = @($changed | Where-Object { $_ } | Sort-Object -Unique)

foreach ($path in $changed) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        continue
    }

    switch -Regex ($path) {
        '\.py$' {
            Invoke-Python -Arguments @("-m", "py_compile", $path)
            break
        }
        '\.(js|mjs|cjs)$' {
            if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
                throw "Node.js is required to syntax-check changed JavaScript: $path"
            }
            & node --check $path
            if ($LASTEXITCODE -ne 0) {
                exit $LASTEXITCODE
            }
            break
        }
    }
}

if ($changed | Where-Object { $_ -match '^(components/cms-actor/|components/README\.md$)' }) {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required for cms-actor tests."
    }
    & node --test "components/cms-actor/test/avatar-model.test.mjs"
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

if ($changed | Where-Object { $_ -match '^(scripts/wz_fsdb/|tests/wz_fsdb/)' }) {
    Invoke-Python -Arguments @("-m", "unittest", "discover", "-s", "tests/wz_fsdb", "-v")
}

Write-Host "deterministic verification passed"
