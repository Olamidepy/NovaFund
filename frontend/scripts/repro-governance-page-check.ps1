if (Test-Path "src/app/governance/page.tsx") {
  Write-Output "PASS: governance page exists."
  exit 0
}

Write-Output "FAIL: governance page is missing."
exit 1
