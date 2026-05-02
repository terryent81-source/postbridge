[CmdletBinding()]
param(
  [string]$BaseUrl = $(if ($env:POSTBRIDGE_BASE_URL) { $env:POSTBRIDGE_BASE_URL } else { "http://localhost:3000" }),
  [string]$Secret = $env:CLEANUP_SECRET
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Secret) -or $Secret -eq "REPLACE_WITH_CLEANUP_SECRET") {
  throw "Set CLEANUP_SECRET in the environment or pass -Secret before running this script."
}

$uri = "$($BaseUrl.TrimEnd('/'))/api/cleanup/media"

$response = Invoke-RestMethod `
  -Method Post `
  -Uri $uri `
  -Headers @{ "x-cleanup-secret" = $Secret } `
  -ContentType "application/json"

$response | ConvertTo-Json -Depth 8
