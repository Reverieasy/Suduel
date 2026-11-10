# Credentials exist only in this process and are restored/cleared after the test.
$ErrorActionPreference = 'Stop'
$names = @('SUDUEL_QA_EMAIL_A', 'SUDUEL_QA_PASSWORD_A', 'SUDUEL_QA_EMAIL_B', 'SUDUEL_QA_PASSWORD_B')
$previous = @{}
$testExitCode = 1
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
    foreach ($player in @('A', 'B')) {
        $email = (Read-Host "Player $player verified email").Trim()
        if ([string]::IsNullOrWhiteSpace($email)) { throw 'Both verified emails are required; no tests were run.' }
        [Environment]::SetEnvironmentVariable("SUDUEL_QA_EMAIL_$player", $email, 'Process')
        $password = Read-Host "Player $player password" -AsSecureString
        try {
            if ($password.Length -eq 0) { throw 'Both passwords are required; no tests were run.' }
            [Environment]::SetEnvironmentVariable("SUDUEL_QA_PASSWORD_$player", [System.Net.NetworkCredential]::new('', $password).Password, 'Process')
        } finally { $password.Dispose() }
    }
    & npm.cmd run test:multiplayer -- --workers=1
    $testExitCode = $LASTEXITCODE
} finally {
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
exit $testExitCode
