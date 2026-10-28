param()

$ErrorActionPreference = "Stop"

function Resolve-CommandPath {
    param([string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) {
        if ($cmd.Source) { return $cmd.Source }
        return $cmd.Name
    }
    return $null
}

foreach ($name in @("opencode2", "opencode")) {
    $resolved = Resolve-CommandPath $name
    if ($resolved) {
        Write-Output $resolved
        exit 0
    }
}

$candidates = New-Object System.Collections.Generic.List[string]

if ($env:OPENCODE_BIN -and (Test-Path -LiteralPath $env:OPENCODE_BIN -PathType Leaf)) {
    $candidates.Add($env:OPENCODE_BIN)
}

$patterns = @(
    "C:\ProgramData\chocolatey\bin\opencode*.exe",
    "C:\ProgramData\chocolatey\bin\opencode*.cmd",
    "C:\ProgramData\scoop\shims\opencode*.exe",
    "C:\ProgramData\scoop\shims\opencode*.cmd",
    "C:\Users\*\AppData\Roaming\npm\opencode*.cmd",
    "C:\Users\*\AppData\Roaming\npm\opencode*.exe",
    "C:\Users\*\.bun\bin\opencode*.exe",
    "C:\Users\*\.bun\bin\opencode*.cmd",
    "C:\Users\*\.opencode\bin\opencode*.exe",
    "C:\Users\*\.opencode\bin\opencode*.cmd",
    "C:\Users\*\.local\bin\opencode*.exe",
    "C:\Users\*\.local\bin\opencode*.cmd",
    "C:\Users\*\.local\share\mise\shims\opencode*.exe",
    "C:\Users\*\.local\share\mise\shims\opencode*.cmd",
    "C:\Users\*\AppData\Local\mise\shims\opencode*.exe",
    "C:\Users\*\AppData\Local\mise\shims\opencode*.cmd",
    "C:\Users\*\scoop\shims\opencode*.exe",
    "C:\Users\*\scoop\shims\opencode*.cmd"
)

foreach ($pattern in $patterns) {
    Get-ChildItem -Path $pattern -File -ErrorAction SilentlyContinue |
        ForEach-Object { $candidates.Add($_.FullName) }
}

$chosen = $candidates |
    Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
    Sort-Object -Unique |
    Select-Object -First 1

if (-not $chosen) {
    throw "OpenCode is installed on the machine but was not discoverable by the runner service. Configure OPENCODE_BIN for the runner service or install @opencode/cli in a machine-visible location."
}

Write-Output $chosen
