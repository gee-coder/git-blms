[CmdletBinding()]
param(
    [string]$Token,
    [string]$VsixPath,
    [string]$Namespace,
    [switch]$CreateNamespace,
    [switch]$PackageOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-CommandChecked {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

function Get-NpxCommand {
    if ($env:OS -eq "Windows_NT") {
        return "npx.cmd"
    }

    return "npx"
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$npxCommand = Get-NpxCommand

$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content $packageJsonPath -Raw -Encoding utf8 | ConvertFrom-Json

if (-not $Namespace) {
    $Namespace = [string]$packageJson.publisher
}

if (-not $Token) {
    $Token = $env:OPENVSX_TOKEN
}

if (-not $Token) {
    $Token = $env:OVSX_PAT
}

if ($VsixPath) {
    $resolvedVsixPath = Resolve-Path $VsixPath
    $vsixFile = $resolvedVsixPath.Path
} else {
    $vsixFile = Join-Path $projectRoot ("{0}-{1}.vsix" -f $packageJson.name, $packageJson.version)
    Invoke-CommandChecked -FilePath $npxCommand -Arguments @("@vscode/vsce", "package")
}

if (-not (Test-Path $vsixFile)) {
    throw "VSIX package not found: $vsixFile"
}

Write-Output "VSIX package ready: $vsixFile"

if ($PackageOnly) {
    return
}

if (-not $Token) {
    throw "Open VSX token not found. Pass -Token or set OPENVSX_TOKEN / OVSX_PAT."
}

if ($CreateNamespace) {
    Invoke-CommandChecked -FilePath $npxCommand -Arguments @("ovsx", "create-namespace", $Namespace, "-p", $Token)
}

Invoke-CommandChecked -FilePath $npxCommand -Arguments @("ovsx", "publish", $vsixFile, "-p", $Token)
Write-Output "Published to Open VSX as $Namespace/$($packageJson.name)"
