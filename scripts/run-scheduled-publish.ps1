[CmdletBinding()]
param(
  [string]$BaseUrl = $(if ($env:POSTBRIDGE_BASE_URL) { $env:POSTBRIDGE_BASE_URL } else { "http://localhost:3000" }),
  [string]$Secret = $env:SCHEDULED_PUBLISH_SECRET
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Secret) -or $Secret -eq "REPLACE_WITH_SCHEDULED_PUBLISH_SECRET") {
  throw "Set SCHEDULED_PUBLISH_SECRET in the environment or pass -Secret before running this script."
}

$uri = "$($BaseUrl.TrimEnd('/'))/api/scheduled/publish"

$response = Invoke-RestMethod `
  -Method Post `
  -Uri $uri `
  -Headers @{ "x-scheduled-publish-secret" = $Secret } `
  -ContentType "application/json"

$response | ConvertTo-Json -Depth 8
