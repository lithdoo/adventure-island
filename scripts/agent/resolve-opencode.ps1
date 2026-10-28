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

function Test-OpenCodeCandidate {
    param([string]$Candidate)

    if (-not $Candidate -or -not (Test-Path -LiteralPath $Candidate -PathType Leaf)) {
        return $false
    }

    try {
        & $Candidate --version *> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

foreach ($name in @("opencode2", "opencode")) {
    $resolved = Resolve-CommandPath $name
    if ($resolved -and (Test-OpenCodeCandidate $resolved)) {
        Write-Output $resolved
        exit 0
    }
}

$candidates = New-Object System.Collections.Generic.List[string]

if ($env:OPENCODE_BIN) {
    $candidates.Add($env:OPENCODE_BIN)
}

# The repository's existing glm-work/start-opencode.bat uses:
#   %USERPROFILE%\.opencode\bin\opencode2.cmd
# A Windows service may have a different USERPROFILE, so enumerate actual
# profile directories instead of assuming the runner service profile.
$profiles = New-Object System.Collections.Generic.List[string]

try {
    Get-ChildItem -LiteralPath "C:\Users" -Directory -Force -ErrorAction Stop |
        ForEach-Object { $profiles.Add($_.FullName) }
} catch {
    # Registry enumeration below is the fallback.
}

try {
    Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\*" -ErrorAction Stop |
        ForEach-Object {
            if ($_.ProfileImagePath) {
                $expanded = [Environment]::ExpandEnvironmentVariables([string]$_.ProfileImagePath)
                if ($expanded) { $profiles.Add($expanded) }
            }
        }
} catch {
    # Continue with whatever profile paths were discoverable.
}

foreach ($profile in ($profiles | Sort-Object -Unique)) {
    foreach ($relative in @(
        ".opencode\bin\opencode2.cmd",
        ".opencode\bin\opencode.cmd",
        ".opencode\bin\opencode2.exe",
        ".opencode\bin\opencode.exe",
        "AppData\Roaming\npm\opencode2.cmd",
        "AppData\Roaming\npm\opencode.cmd",
        ".bun\bin\opencode2.exe",
        ".bun\bin\opencode.exe",
        ".local\bin\opencode2.exe",
        ".local\bin\opencode.exe",
        ".local\share\mise\shims\opencode.exe",
        "AppData\Local\mise\shims\opencode.exe",
        "scoop\shims\opencode.exe"
    )) {
        $candidates.Add((Join-Path $profile $relative))
    }
}

foreach ($candidate in @(
    "C:\ProgramData\chocolatey\bin\opencode.exe",
    "C:\ProgramData\chocolatey\bin\opencode.cmd",
    "C:\ProgramData\scoop\shims\opencode.exe",
    "C:\ProgramData\scoop\shims\opencode.cmd"
)) {
    $candidates.Add($candidate)
}

foreach ($candidate in ($candidates | Sort-Object -Unique)) {
    if (Test-OpenCodeCandidate $candidate) {
        Write-Output $candidate
        exit 0
    }
}

throw "OpenCode is installed for an interactive Windows profile but is not executable by the runner service. Configure OPENCODE_BIN for the runner service or grant the runner account read/execute access to the existing .opencode installation."
