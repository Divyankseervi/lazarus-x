[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateScript({ -not [string]::IsNullOrWhiteSpace($_) })]
    [string]$Task,

    # Safe by default. A live agent run requires the explicit -Live switch.
    [switch]$Live,

    [ValidateRange(0, 3)]
    [int]$MaxRepairRounds = 2,

    [string]$AntigravityCommand = "agy",
    [string]$CodexCommand = "codex",

    [ValidateRange(1, 120)]
    [int]$AgentTimeoutMinutes = 20,

    [ValidateRange(1, 120)]
    [int]$VerificationTimeoutMinutes = 15,

    [string]$ProjectRoot,
    [string]$LogDirectory
)

$ErrorActionPreference = "Stop"

if ($Task.Length -gt 16000) {
    throw "Task text is limited to 16,000 characters so the Antigravity prompt stays within Windows command-line limits."
}

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
} else {
    $ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
}

if ([string]::IsNullOrWhiteSpace($LogDirectory)) {
    $LogDirectory = Join-Path $PSScriptRoot "logs"
}

New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
$runId = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$script:LogPath = Join-Path $LogDirectory "supervisor-$runId.log"
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($script:LogPath, "", $script:Utf8NoBom)
$script:CheckResults = [ordered]@{}
$script:RunStatus = "NOT RUN"
$script:CurrentStage = "Supervisor startup"

function Initialize-CheckReport {
    $fixedChecks = @(
        "Supervisor dry-run safety",
        "Permission detector: read_url denial",
        "Permission detector: command denial",
        "Antigravity retry classification",
        "Antigravity retry loop",
        "Antigravity CLI help",
        "Antigravity CLI syntax",
        "Codex CLI help",
        "Codex CLI syntax",
        "Initial Git status",
        "Antigravity implementation",
        "Codex initial read-only review",
        "Codex final read-only review",
        "Final review finding gate",
        "Verification script safety audit",
        "Backend TypeScript check",
        "Backend tests",
        "Frontend production build",
        "Frontend lint"
    )
    foreach ($name in $fixedChecks) {
        $null = ($script:CheckResults[$name] = [pscustomobject]@{
            Status = "NOT RUN"
            Detail = "not reached"
        })
    }
    for ($round = 1; $round -le 3; $round++) {
        $null = ($script:CheckResults["Antigravity repair round $round"] = [pscustomobject]@{
            Status = "NOT RUN"
            Detail = "not reached or not required"
        })
        $null = ($script:CheckResults["Codex post-repair review $round"] = [pscustomobject]@{
            Status = "NOT RUN"
            Detail = "not reached or not required"
        })
    }
}

function Set-CheckStatus([string]$Name, [string]$Status, [string]$Detail) {
    if ($Status -notin @("PASS", "FAIL", "BLOCKED", "NOT RUN")) {
        throw "Invalid check status '$Status'."
    }
    if (-not $script:CheckResults.Contains($Name)) {
        $script:CheckResults[$Name] = [pscustomobject]@{ Status = "NOT RUN"; Detail = "not reached" }
    }
    $null = ($script:CheckResults[$Name] = [pscustomobject]@{
        Status = $Status
        Detail = $Detail
    })
}

function Write-FinalReport {
    Write-Log "FINAL STATUS: $script:RunStatus"
    Write-Log "VERIFICATION REPORT (PASS / FAIL / BLOCKED / NOT RUN):"
    foreach ($name in $script:CheckResults.Keys) {
        $check = $script:CheckResults[$name]
        Write-Log ("{0}: {1} | {2}" -f $check.Status, $name, $check.Detail)
    }
    Write-Log "Full process logs: $script:LogPath"
}

function Complete-NotRunDetails([string]$StopDescription) {
    foreach ($name in @($script:CheckResults.Keys)) {
        $check = $script:CheckResults[$name]
        if ($check.Status -eq "NOT RUN" -and $check.Detail -in @("not reached", "not reached or not required")) {
            Set-CheckStatus $name "NOT RUN" "stopped before this check: $StopDescription"
        }
    }
}

function Write-Log([string]$Message) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"), $Message
    Write-Host $line
    [System.IO.File]::AppendAllText($script:LogPath, $line + "`r`n", $script:Utf8NoBom)
}

function Write-LogBlock([string]$Label, [string]$Content) {
    Write-Log $Label
    if ([string]::IsNullOrEmpty($Content)) {
        Write-Log "(empty)"
        return
    }

    [System.IO.File]::AppendAllText($script:LogPath, $Content, $script:Utf8NoBom)
    if (-not $Content.EndsWith("`n")) {
        [System.IO.File]::AppendAllText($script:LogPath, "`r`n", $script:Utf8NoBom)
    }
    Write-Host $Content.TrimEnd()
}

function Find-PermissionDenial([string]$Text) {
    if ([string]::IsNullOrEmpty($Text)) { return $null }

    $toolName = "(?:read[_ -]?url|command(?:[_ -]execution)?|run[_ -]?command|shell|terminal)"
    $denial = "(?:auto(?:matically)?[- ]?(?:denied|rejected)|soft[- ]?denied|denied|rejected|blocked|not allowed|not permitted|approval required|permission required)"
    $patterns = @(
        "(?is)\b$toolName\b.{0,200}\b$denial\b.{0,100}\b(?:headless|approval|permission|policy|sandbox)?\b",
        "(?is)\b$denial\b.{0,200}\b$toolName\b",
        "(?i)\b(?:permission|approval)(?:s)?\s+(?:request\s+)?(?:was\s+|has been\s+|is\s+)?(?:auto(?:matically)?[- ]?(?:denied|rejected)|soft[- ]?denied|denied|rejected|blocked|not granted|unavailable)\b",
        "(?i)\bapproval\s+(?:is\s+)?required\b",
        "(?i)\bpermission\s+(?:is\s+)?required\b",
        "(?i)\baccess\s+(?:is\s+)?denied\b",
        "(?i)\boperation\s+not\s+permitted\b",
        "(?i)\bnot\s+authorized\b",
        "(?i)\bunauthorized\b",
        "(?i)\bdenied\s+by\s+(?:the\s+)?(?:user|policy|approval|permission|sandbox)\b",
        "(?i)\bblocked\s+by\s+(?:the\s+)?sandbox\b",
        "(?i)\bsandbox\s+(?:denied|blocked|rejected)\b"
    )
    foreach ($pattern in $patterns) {
        $match = [System.Text.RegularExpressions.Regex]::Match($Text, $pattern)
        if ($match.Success) {
            $evidence = ($match.Value -replace "\s+", " ").Trim()
            if ($evidence.Length -gt 240) { $evidence = $evidence.Substring(0, 240) }
            return [pscustomobject]@{ Evidence = $evidence }
        }
    }
    return $null
}

function Test-PermissionDenial([string]$Text) {
    return ($null -ne (Find-PermissionDenial $Text))
}

function Test-AntigravityTransportFailure($Result) {
    if ($null -eq $Result -or $Result.TimedOut -or [int]$Result.ExitCode -eq 0) {
        return $false
    }

    $combinedText = [string]$Result.StdOut + "`n" + [string]$Result.StdErr
    if ((Test-PermissionDenial $combinedText) -or $combinedText -match '(?i)\bdenied_actions\b') {
        return $false
    }
    if ($combinedText -match '(?i)"step_type"\s*:\s*"tool"|"(?:tool_info|tool_name|tool_call|tool_result|function_call|function_result)"\s*:|"(?:event|type)"\s*:\s*"(?:tool|tool_call|tool_result|function_call|function_result)"') {
        return $false
    }
    if ($combinedText -match '(?i)\b(?:timeout|timed out|deadline exceeded|ETIMEDOUT|WSAETIMEDOUT)\b') {
        return $false
    }

    $resultEvents = @()
    foreach ($line in ([string]$Result.StdOut -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try {
            $event = ConvertFrom-Json -InputObject $line -ErrorAction Stop
        } catch {
            return $false
        }

        if ($null -eq $event -or $event -isnot [System.Management.Automation.PSCustomObject]) {
            return $false
        }
        $eventNameProperty = $event.PSObject.Properties["event"]
        if ($null -eq $eventNameProperty -or $eventNameProperty.Value -isnot [string]) {
            return $false
        }

        switch -CaseSensitive ([string]$eventNameProperty.Value) {
            "step_update" {
                $stepUpdateProperty = $event.PSObject.Properties["step_update"]
                if ($null -eq $stepUpdateProperty -or
                    $null -eq $stepUpdateProperty.Value -or
                    $stepUpdateProperty.Value -isnot [System.Management.Automation.PSCustomObject]) {
                    return $false
                }
                $stepUpdate = $stepUpdateProperty.Value
                $stepTypeProperty = $stepUpdate.PSObject.Properties["step_type"]
                $stepIndexProperty = $stepUpdate.PSObject.Properties["step_index"]
                $stateProperty = $stepUpdate.PSObject.Properties["state"]
                $conversationIdProperty = $stepUpdate.PSObject.Properties["conversation_id"]
                if ($null -eq $stepTypeProperty -or $stepTypeProperty.Value -isnot [string] -or
                    $stepTypeProperty.Value -notin @("user_input", "agent_response", "tool") -or
                    $null -eq $stepIndexProperty -or
                    ($stepIndexProperty.Value -isnot [int] -and $stepIndexProperty.Value -isnot [long]) -or
                    [long]$stepIndexProperty.Value -lt 0 -or
                    $null -eq $stateProperty -or $stateProperty.Value -isnot [string] -or
                    $stateProperty.Value -notin @("ACTIVE", "DONE") -or
                    $null -eq $conversationIdProperty -or
                    $conversationIdProperty.Value -isnot [string] -or
                    [string]::IsNullOrWhiteSpace($conversationIdProperty.Value)) {
                    return $false
                }
                if ($stepTypeProperty.Value -eq "tool") {
                    return $false
                }
            }
            "result" {
                $resultProperty = $event.PSObject.Properties["result"]
                if ($null -eq $resultProperty -or
                    $null -eq $resultProperty.Value -or
                    $resultProperty.Value -isnot [System.Management.Automation.PSCustomObject]) {
                    return $false
                }
                $statusProperty = $resultProperty.Value.PSObject.Properties["status"]
                if ($null -eq $statusProperty -or $statusProperty.Value -isnot [string] -or
                    $statusProperty.Value -notin @("SUCCESS", "ERROR")) {
                    return $false
                }
                if ($statusProperty.Value -eq "ERROR") {
                    $errorProperty = $resultProperty.Value.PSObject.Properties["error"]
                    if ($null -eq $errorProperty -or $errorProperty.Value -isnot [string]) {
                        return $false
                    }
                }
                $resultEvents += $resultProperty.Value
            }
            default {
                return $false
            }
        }
    }

    if ($resultEvents.Count -ne 1 -or $null -eq $resultEvents[0] -or $resultEvents[0].status -ne "ERROR") {
        return $false
    }

    $errorText = [string]$resultEvents[0].error
    if ([string]::IsNullOrWhiteSpace($errorText) -or
        $errorText -match '(?i)\b(?:timeout|timed out|deadline exceeded|ETIMEDOUT|WSAETIMEDOUT)\b') {
        return $false
    }

    $isExplicitApiRequestFailure = $errorText -match '(?is)\bAPI error\s*\(attempt\s+\d+\):\s*request failed:\s*(?:get|post|put|patch|delete|head)\s+"?https://'
    $hasConcreteTransportFailure = $errorText -match '(?i)(?:\b(?:read|write|dial) tcp\b|\bwsarecv\b|\bwsasend\b|\bconnection (?:was )?(?:aborted|reset|refused)\b|\bnetwork is unreachable\b|\bno route to host\b|\bbroken pipe\b|\bunexpected EOF\b)'
    return ($isExplicitApiRequestFailure -and $hasConcreteTransportFailure)
}

function Invoke-AntigravityRetryLoop([string]$Name, [scriptblock]$AttemptAction) {
    for ($attempt = 1; $attempt -le 2; $attempt++) {
        $result = & $AttemptAction $attempt
        $retryableProperty = $null
        if ($null -ne $result) {
            $retryableProperty = $result.PSObject.Properties["RetryableAntigravityTransportFailure"]
        }
        $retryable = ($null -ne $retryableProperty -and [bool]$retryableProperty.Value)
        if ($retryable -and $attempt -eq 1) {
            Write-Log "Retrying '$Name' once after an outer API/network transport failure; no tool events occurred."
            continue
        }
        return [pscustomobject]@{
            Result = $result
            Attempts = $attempt
            RetryLimitReached = ($retryable -and $attempt -eq 2)
        }
    }
    throw "Antigravity retry loop exited without a result."
}

function Test-SupervisorStop([System.Exception]$Exception) {
    return ($null -ne $Exception -and $Exception.Data.Contains("SupervisorStatus"))
}

function Stop-Workflow(
    [ValidateSet("FAIL", "BLOCKED")][string]$Status,
    [string]$Agent,
    [string]$Stage,
    [string]$CheckName,
    [string]$Reason,
    [string]$NextAction,
    [AllowNull()][string]$DetectedDenial
) {
    $script:RunStatus = $Status
    $script:CurrentStage = $Stage
    Set-CheckStatus $CheckName $Status $Reason
    if (-not [string]::IsNullOrWhiteSpace($DetectedDenial)) {
        Write-Log ("STATUS: BLOCKED | agent={0} | stage={1} | detected denial: {2} | safe next action: {3}" -f $Agent, $Stage, $DetectedDenial, $NextAction)
    } elseif ($Status -eq "BLOCKED") {
        Write-Log ("STATUS: BLOCKED | agent={0} | stage={1} | reason: {2} | safe next action: {3}" -f $Agent, $Stage, $Reason, $NextAction)
    } else {
        Write-Log ("STATUS: FAIL | agent={0} | stage={1} | reason: {2}" -f $Agent, $Stage, $Reason)
    }
    $exception = New-Object System.Exception($Reason)
    $exception.Data["SupervisorStatus"] = $Status
    $exception.Data["SupervisorAgent"] = $Agent
    $exception.Data["SupervisorStage"] = $Stage
    $exception.Data["SupervisorCheck"] = $CheckName
    throw $exception
}

function Invoke-PermissionDetectorSelfTest {
    $readUrlText = 'tool request read_url automatically denied in headless mode; no URL was fetched.'
    $commandText = 'command request auto-denied in headless mode because permission was not granted.'
    $cleanText = 'The read_url and command checks completed successfully.'
    $readUrlDetected = Find-PermissionDenial $readUrlText
    if ($null -eq $readUrlDetected) {
        Stop-Workflow -Status FAIL -Agent "Supervisor" -Stage "Permission detector self-test" `
            -CheckName "Permission detector: read_url denial" -Reason "Synthetic read_url headless auto-denial was not detected." `
            -NextAction "Repair the detector and rerun validation; no live agent was started." -DetectedDenial $null
    }
    Set-CheckStatus "Permission detector: read_url denial" "PASS" ("Detected synthetic denial: {0}" -f $readUrlDetected.Evidence)

    $commandDetected = Find-PermissionDenial $commandText
    if ($null -eq $commandDetected) {
        Stop-Workflow -Status FAIL -Agent "Supervisor" -Stage "Permission detector self-test" `
            -CheckName "Permission detector: command denial" -Reason "Synthetic command headless auto-denial was not detected." `
            -NextAction "Repair the detector and rerun validation; no live agent was started." -DetectedDenial $null
    }
    Set-CheckStatus "Permission detector: command denial" "PASS" ("Detected synthetic denial: {0}" -f $commandDetected.Evidence)

    if (Test-PermissionDenial $cleanText) {
        Stop-Workflow -Status FAIL -Agent "Supervisor" -Stage "Permission detector self-test" `
            -CheckName "Supervisor dry-run safety" -Reason "Permission detector falsely classified a clean synthetic success message as a denial." `
            -NextAction "Repair the detector and rerun validation; no live agent was started." -DetectedDenial $null
    }
    Write-Log "Permission detector self-test passed for read_url denial, command denial, and clean output."
}

function Invoke-AntigravityTransportClassifierSelfTest {
    $networkError = 'API error (attempt 1): request failed: Post "https://example.invalid/v1/stream": read tcp [::1]:1234->[::1]:443: wsarecv: An established connection was aborted by the software in your host machine.'
    $resultEvent = @{ event = "result"; result = @{ status = "ERROR"; error = $networkError } } | ConvertTo-Json -Depth 8 -Compress
    $toolEvent = @{ event = "step_update"; step_update = @{ step_type = "tool"; step_index = 2; state = "DONE"; conversation_id = "synthetic-conversation"; tool_info = @{ name = "run_command" } } } | ConvertTo-Json -Depth 8 -Compress
    $toolErrorEvent = @{ event = "step_update"; step_update = @{ step_type = "tool"; step_index = 2; state = "DONE"; conversation_id = "synthetic-conversation"; tool_info = @{ error = @{ type = "TOOL_ERROR"; message = "synthetic tool failure" } } } } | ConvertTo-Json -Depth 8 -Compress
    $toolExitEvent = @{ event = "step_update"; step_update = @{ step_type = "tool"; step_index = 2; state = "DONE"; conversation_id = "synthetic-conversation"; tool_info = @{ exit_code = 7 } } } | ConvertTo-Json -Depth 8 -Compress
    $agentResponseEvent = @{ event = "step_update"; step_update = @{ conversation_id = "synthetic-conversation"; step_index = 1; state = "DONE"; step_type = "agent_response" } } | ConvertTo-Json -Depth 8 -Compress
    $deniedActionsEvent = @{ event = "result"; result = @{ status = "ERROR"; error = $networkError; denied_actions = @(@{ name = "run_command" }) } } | ConvertTo-Json -Depth 8 -Compress
    $permissionDeniedEvent = @{ event = "result"; result = @{ status = "ERROR"; error = "Permission denied while requesting a tool." } } | ConvertTo-Json -Depth 8 -Compress
    $genericFailureEvent = @{ event = "result"; result = @{ status = "ERROR"; error = "API error: request failed, but no transport failure was identified." } } | ConvertTo-Json -Depth 8 -Compress
    $timeoutEvent = @{ event = "result"; result = @{ status = "ERROR"; error = 'API error (attempt 1): request failed: Post "https://example.invalid": read tcp: i/o timeout' } } | ConvertTo-Json -Depth 8 -Compress
    $unknownEvent = '{"type":"tool_call"}'
    $emptyObjectEvent = '{}'
    $malformedStructureEvent = '{"event":"result"}'

    $cases = @(
        @{ Name = "explicit outer API/network transport failure"; Expected = $true; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = $resultEvent; StdErr = "" } },
        @{ Name = "explicit failure with valid agent response record"; Expected = $true; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$agentResponseEvent`n$resultEvent"; StdErr = "" } },
        @{ Name = "multiple outer result events"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$resultEvent`n$resultEvent"; StdErr = "" } },
        @{ Name = "permission denial"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = $permissionDeniedEvent; StdErr = "" } },
        @{ Name = "denied_actions"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = $deniedActionsEvent; StdErr = "" } },
        @{ Name = "tool event"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$toolEvent`n$resultEvent"; StdErr = "" } },
        @{ Name = "tool error"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$toolErrorEvent`n$resultEvent"; StdErr = "" } },
        @{ Name = "nonzero tool exit"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$toolExitEvent`n$resultEvent"; StdErr = "" } },
        @{ Name = "process timeout"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $true; StdOut = $resultEvent; StdErr = "" } },
        @{ Name = "transport timeout"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = $timeoutEvent; StdErr = "" } },
        @{ Name = "malformed stream output"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$resultEvent`nnot-json"; StdErr = "" } },
        @{ Name = "unknown type tool_call record"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$unknownEvent`n$resultEvent"; StdErr = "" } },
        @{ Name = "empty object record"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$emptyObjectEvent`n$resultEvent"; StdErr = "" } },
        @{ Name = "recognized event with malformed structure"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = "$malformedStructureEvent`n$resultEvent"; StdErr = "" } },
        @{ Name = "generic outer failure"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = $genericFailureEvent; StdErr = "" } },
        @{ Name = "zero process exit"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 0; TimedOut = $false; StdOut = $resultEvent; StdErr = "" } },
        @{ Name = "unstructured error output"; Expected = $false; Result = [pscustomobject]@{ ExitCode = 1; TimedOut = $false; StdOut = ""; StdErr = $networkError } }
    )

    foreach ($case in $cases) {
        $actual = Test-AntigravityTransportFailure $case.Result
        if ($actual -ne $case.Expected) {
            Stop-Workflow -Status FAIL -Agent "Supervisor" -Stage "Antigravity retry classifier self-test" `
                -CheckName "Antigravity retry classification" -Reason "Synthetic retry classification failed for '$($case.Name)' (expected $($case.Expected), got $actual)." `
                -NextAction "Repair the retry classifier and rerun the supervisor dry-run; no live agent was started." -DetectedDenial $null
        }
    }
    Set-CheckStatus "Antigravity retry classification" "PASS" ("Synthetic classifier cases passed: {0}." -f $cases.Count)
    Write-Log ("Antigravity retry classifier self-test passed all {0} synthetic cases." -f $cases.Count)
}

function Invoke-AntigravityRetryLoopSelfTest {
    $firstThenSuccessAttempts = New-Object 'System.Collections.Generic.List[int]'
    $firstThenSuccess = Invoke-AntigravityRetryLoop -Name "synthetic first-failure retry" -AttemptAction {
        param($attempt)
        $null = $firstThenSuccessAttempts.Add([int]$attempt)
        if ($attempt -eq 1) {
            return [pscustomobject]@{ Attempt = [int]$attempt; Outcome = "transport failure"; RetryableAntigravityTransportFailure = $true }
        }
        return [pscustomobject]@{ Attempt = [int]$attempt; Outcome = "success"; RetryableAntigravityTransportFailure = $false }
    }
    if ($firstThenSuccess.Attempts -ne 2 -or $firstThenSuccess.RetryLimitReached -or
        $firstThenSuccessAttempts.Count -ne 2 -or $firstThenSuccessAttempts[0] -ne 1 -or $firstThenSuccessAttempts[1] -ne 2 -or
        $firstThenSuccess.Result.Attempt -ne 2 -or $firstThenSuccess.Result.Outcome -ne "success") {
        Stop-Workflow -Status FAIL -Agent "Supervisor" -Stage "Antigravity retry loop self-test" `
            -CheckName "Antigravity retry loop" -Reason "A qualifying first failure did not lead to exactly one retry that returned the second attempt's success." `
            -NextAction "Repair the retry loop and rerun the supervisor dry-run; no live agent was started." -DetectedDenial $null
    }

    $nonretryableAttempts = New-Object 'System.Collections.Generic.List[int]'
    $nonretryable = Invoke-AntigravityRetryLoop -Name "synthetic non-retryable failure" -AttemptAction {
        param($attempt)
        $null = $nonretryableAttempts.Add([int]$attempt)
        return [pscustomobject]@{ Attempt = [int]$attempt; Outcome = "non-retryable failure"; RetryableAntigravityTransportFailure = $false }
    }
    if ($nonretryable.Attempts -ne 1 -or $nonretryable.RetryLimitReached -or
        $nonretryableAttempts.Count -ne 1 -or $nonretryableAttempts[0] -ne 1 -or
        $nonretryable.Result.Attempt -ne 1 -or $nonretryable.Result.Outcome -ne "non-retryable failure") {
        Stop-Workflow -Status FAIL -Agent "Supervisor" -Stage "Antigravity retry loop self-test" `
            -CheckName "Antigravity retry loop" -Reason "A non-retryable first attempt did not return immediately without retrying." `
            -NextAction "Repair the retry loop and rerun the supervisor dry-run; no live agent was started." -DetectedDenial $null
    }

    $repeatedFailureAttempts = New-Object 'System.Collections.Generic.List[int]'
    $repeatedFailure = Invoke-AntigravityRetryLoop -Name "synthetic repeated failure" -AttemptAction {
        param($attempt)
        $null = $repeatedFailureAttempts.Add([int]$attempt)
        return [pscustomobject]@{ Attempt = [int]$attempt; Outcome = "transport failure"; RetryableAntigravityTransportFailure = $true }
    }
    if ($repeatedFailure.Attempts -ne 2 -or -not $repeatedFailure.RetryLimitReached -or
        $repeatedFailureAttempts.Count -ne 2 -or $repeatedFailureAttempts[0] -ne 1 -or $repeatedFailureAttempts[1] -ne 2 -or
        $repeatedFailure.Result.Attempt -ne 2 -or $repeatedFailure.Result.Outcome -ne "transport failure") {
        Stop-Workflow -Status FAIL -Agent "Supervisor" -Stage "Antigravity retry loop self-test" `
            -CheckName "Antigravity retry loop" -Reason "A second qualifying failure did not return attempt two and stop after the single permitted retry." `
            -NextAction "Repair the retry loop and rerun the supervisor dry-run; no live agent was started." -DetectedDenial $null
    }

    Set-CheckStatus "Antigravity retry loop" "PASS" "Synthetic checks confirmed immediate stop for a non-retryable result, one retry maximum, and the returned result from the final attempt; no agent was launched."
    Write-Log "Antigravity retry loop self-test passed: non-retryable failure stopped at attempt one, a qualifying failure retried once, and a second qualifying failure stopped at attempt two."
}

function Quote-WindowsArgument([string]$Argument) {
    if ($Argument.Length -eq 0) { return '""' }
    if ($Argument -notmatch '[\s"]') { return $Argument }

    $builder = New-Object System.Text.StringBuilder
    $slash = [string][char]92
    $quote = [string][char]34
    [void]$builder.Append('"')
    $backslashes = 0
    foreach ($character in $Argument.ToCharArray()) {
        if ($character -eq [char]92) {
            $backslashes++
            continue
        }
        if ($character -eq [char]34) {
            if ($backslashes -gt 0) {
                [void]$builder.Append(($slash * (2 * $backslashes)))
            }
            [void]$builder.Append($slash + $quote)
            $backslashes = 0
            continue
        }
        if ($backslashes -gt 0) {
            [void]$builder.Append(($slash * $backslashes))
            $backslashes = 0
        }
        [void]$builder.Append($character)
    }
    if ($backslashes -gt 0) {
        [void]$builder.Append(($slash * (2 * $backslashes)))
    }
    [void]$builder.Append('"')
    return $builder.ToString()
}

function Get-LaunchSpec([string]$CommandName, [string[]]$Arguments) {
    $command = Get-Command -Name $CommandName -ErrorAction Stop
    if ($command.CommandType -eq "Application") {
        $extension = [System.IO.Path]::GetExtension($command.Source).ToLowerInvariant()
        if ($extension -in @(".cmd", ".bat")) {
            throw "Command '$CommandName' resolves to a batch file. Use its executable or PowerShell entry point so process output and exit codes can be captured reliably."
        }
        return [pscustomobject]@{
            FileName = $command.Source
            Arguments = @($Arguments)
            Label = $CommandName
        }
    }

    if ($command.CommandType -eq "ExternalScript" -and $command.Source -match '\.ps1$') {
        $hostPath = Join-Path $PSHOME "powershell.exe"
        if (-not (Test-Path -LiteralPath $hostPath)) {
            $hostPath = (Get-Command -Name powershell.exe -ErrorAction Stop).Source
        }
        return [pscustomobject]@{
            FileName = $hostPath
            Arguments = @("-NoLogo", "-NoProfile", "-NonInteractive", "-File", $command.Source) + @($Arguments)
            Label = $CommandName
        }
    }

    throw "Command '$CommandName' must resolve to an executable or a .ps1 command shim."
}

function Invoke-CapturedProcess(
    [string]$CommandName,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [int]$TimeoutSeconds,
    [AllowNull()][string]$InputText
) {
    $launch = Get-LaunchSpec -CommandName $CommandName -Arguments $Arguments
    $argumentText = (@($launch.Arguments | ForEach-Object { Quote-WindowsArgument ([string]$_) }) -join " ")
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $launch.FileName
    $startInfo.Arguments = $argumentText
    $startInfo.WorkingDirectory = $WorkingDirectory
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    try {
        $started = $process.Start()
        if (-not $started) { throw "The process did not start." }

        $stdoutTask = $process.StandardOutput.ReadToEndAsync()
        $stderrTask = $process.StandardError.ReadToEndAsync()
        if ($null -ne $InputText) {
            $process.StandardInput.Write($InputText)
        }
        $process.StandardInput.Close()

        $finished = $process.WaitForExit($TimeoutSeconds * 1000)
        if (-not $finished) {
            try {
                $killTree = [System.Diagnostics.Process].GetMethod("Kill", [type[]]@([bool]))
                if ($null -ne $killTree) {
                    $killTree.Invoke($process, @($true)) | Out-Null
                } else {
                    $taskkill = Join-Path $env:SystemRoot "System32\taskkill.exe"
                    if (Test-Path -LiteralPath $taskkill) {
                        $null = & $taskkill /PID $process.Id /T /F 2>&1
                    } else {
                        $process.Kill()
                    }
                }
            } catch {
                try { $process.Kill() } catch { }
            }
            $process.WaitForExit()
        } else {
            $process.WaitForExit()
        }

        $stdout = $stdoutTask.GetAwaiter().GetResult()
        $stderr = $stderrTask.GetAwaiter().GetResult()
        return [pscustomobject]@{
            ExitCode = $process.ExitCode
            TimedOut = (-not $finished)
            StdOut = $stdout
            StdErr = $stderr
        }
    } finally {
        $process.Dispose()
    }
}

function Invoke-LoggedProcess(
    [string]$Name,
    [string]$CommandName,
    [string[]]$Arguments,
    [string]$WorkingDirectory,
    [int]$TimeoutSeconds,
    [AllowNull()][string]$InputText,
    [string]$Agent = "Supervisor",
    [string]$CheckName,
    [ValidateSet("FAIL", "BLOCKED")][string]$FailureStatus = "FAIL",
    [switch]$AllowAntigravityTransportRetry
) {
    if ([string]::IsNullOrWhiteSpace($CheckName)) { $CheckName = $Name }
    $script:CurrentStage = $Name
    Write-Log "Starting process: $Name"
    try {
        $result = Invoke-CapturedProcess -CommandName $CommandName -Arguments $Arguments `
            -WorkingDirectory $WorkingDirectory -TimeoutSeconds $TimeoutSeconds -InputText $InputText
    } catch {
        if (Test-SupervisorStop $_.Exception) { throw }
        $reason = "Process launch failed for '$Name'; no process exit code is available. $($_.Exception.Message)"
        Write-Log $reason
        Stop-Workflow -Status $FailureStatus -Agent $Agent -Stage $Name -CheckName $CheckName `
            -Reason $reason -NextAction "Check that the required command is installed and callable, then rerun only after the prerequisite is resolved." -DetectedDenial $null
    }

    Write-Log "Process exit code ($Name): $($result.ExitCode)"
    if ($result.TimedOut) { Write-Log "Process timed out ($Name) after $TimeoutSeconds seconds." }
    Write-LogBlock "$Name stdout:" $result.StdOut
    Write-LogBlock "$Name stderr:" $result.StdErr

    $denial = Find-PermissionDenial ($result.StdOut + "`n" + $result.StdErr)
    if ($null -ne $denial) {
        Stop-Workflow -Status BLOCKED -Agent $Agent -Stage $Name -CheckName $CheckName `
            -Reason "Permission or approval denial detected in '$Name' output, even if the process exit code was zero." `
            -NextAction "Stop here; inspect this specific request in the normal authorized UI and have an operator decide manually. The supervisor will not retry it or change permissions." `
            -DetectedDenial $denial.Evidence
    }
    if ($result.TimedOut) {
        Stop-Workflow -Status $FailureStatus -Agent $Agent -Stage $Name -CheckName $CheckName `
            -Reason "Process '$Name' exceeded its timeout of $TimeoutSeconds seconds." `
            -NextAction "Inspect the timeout and rerun only after determining that the check can complete safely." -DetectedDenial $null
    }
    if ($result.ExitCode -ne 0) {
        if ($AllowAntigravityTransportRetry -and (Test-AntigravityTransportFailure $result)) {
            $null = Add-Member -InputObject $result -MemberType NoteProperty `
                -Name "RetryableAntigravityTransportFailure" -Value $true -Force
            Write-Log "Classified a clear outer Antigravity API/network transport failure with no tool events; one retry is eligible."
            return $result
        }
        Stop-Workflow -Status $FailureStatus -Agent $Agent -Stage $Name -CheckName $CheckName `
            -Reason "Process '$Name' exited with code $($result.ExitCode)." `
            -NextAction "Inspect the captured output and resolve the reported failure before continuing." -DetectedDenial $null
    }
    return $result
}

function Assert-HelpContains([string]$Name, [string]$HelpText, [string[]]$Patterns, [string]$Agent, [string]$CheckName) {
    foreach ($pattern in $Patterns) {
        if ($HelpText -notmatch $pattern) {
            Stop-Workflow -Status BLOCKED -Agent $Agent -Stage "$Name syntax preflight" -CheckName $CheckName `
                -Reason "$Name help output does not advertise required syntax matching '$pattern'." `
                -NextAction "Check the installed CLI version and its documented flags, then update the invocation intentionally before running a live workflow." -DetectedDenial $null
        }
    }
}

function Assert-CliSyntax {
    # These are help-only invocations. No agent prompt is sent during preflight.
    $script:CurrentStage = "Antigravity CLI help"
    $agyHelp = Invoke-LoggedProcess -Name "Antigravity CLI help" -CommandName $AntigravityCommand `
        -Arguments @("--help") -WorkingDirectory $ProjectRoot -TimeoutSeconds 30 -InputText $null `
        -Agent "Antigravity CLI" -CheckName "Antigravity CLI help" -FailureStatus BLOCKED
    Set-CheckStatus "Antigravity CLI help" "PASS" "Help command exited zero with no permission denial."
    $agyText = $agyHelp.StdOut + "`n" + $agyHelp.StdErr
    Assert-HelpContains "Antigravity" $agyText @("--print|--prompt", "--output-format", "--json-schema", "--sandbox", "--mode", "accept-edits", "--print-timeout") `
        "Antigravity CLI" "Antigravity CLI syntax"
    Set-CheckStatus "Antigravity CLI syntax" "PASS" "All required Antigravity invocation flags appear in help."

    $script:CurrentStage = "Codex CLI help"
    $codexHelp = Invoke-LoggedProcess -Name "Codex exec help" -CommandName $CodexCommand `
        -Arguments @("exec", "--help") -WorkingDirectory $ProjectRoot -TimeoutSeconds 30 -InputText $null `
        -Agent "Codex CLI" -CheckName "Codex CLI help" -FailureStatus BLOCKED
    Set-CheckStatus "Codex CLI help" "PASS" "Help command exited zero with no permission denial."
    $codexText = $codexHelp.StdOut + "`n" + $codexHelp.StdErr
    Assert-HelpContains "Codex exec" $codexText @(
        "(?m)--sandbox",
        "(?m)--cd|-C",
        "(?m)--output-schema",
        "(?m)--output-last-message",
        "(?m)--json",
        "(?i)stdin"
    ) "Codex CLI" "Codex CLI syntax"
    Set-CheckStatus "Codex CLI syntax" "PASS" "All required Codex invocation flags appear in help."
    Write-Log "CLI syntax preflight passed using both installed commands' help output."
}

function Invoke-Antigravity([string]$Name, [string]$Prompt) {
    $script:CurrentStage = $Name
    $arguments = @(
        "--print", $Prompt,
        "--output-format", "stream-json",
        "--json-schema", $script:ImplementationSchema,
        "--sandbox",
        "--mode", "accept-edits",
        "--print-timeout", ("{0}m" -f $AgentTimeoutMinutes)
    )
    $attemptOutcome = Invoke-AntigravityRetryLoop -Name $Name -AttemptAction {
        param($attempt)
        $attemptName = "$Name (attempt $attempt)"
        Invoke-LoggedProcess -Name $attemptName -CommandName $AntigravityCommand -Arguments $arguments `
            -WorkingDirectory $ProjectRoot -TimeoutSeconds ($AgentTimeoutMinutes * 60) -InputText $null `
            -Agent "Antigravity" -CheckName $Name -AllowAntigravityTransportRetry
    }
    $run = $attemptOutcome.Result
    if ($attemptOutcome.RetryLimitReached) {
        Stop-Workflow -Status FAIL -Agent "Antigravity" -Stage $Name -CheckName $Name `
            -Reason "Antigravity's outer API/network transport failure persisted after its single permitted retry; no tool events occurred." `
            -NextAction "Inspect the captured API/network error and rerun manually after the transport issue is resolved." -DetectedDenial $null
    }

    $resultEvent = $null
    foreach ($line in ($run.StdOut -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try {
            $event = ConvertFrom-Json -InputObject $line -ErrorAction Stop
        } catch {
            Stop-Workflow -Status FAIL -Agent "Antigravity" -Stage $Name -CheckName $Name `
                -Reason "Antigravity emitted an invalid stream-json event; the agent output is incomplete." `
                -NextAction "Inspect the captured event stream and correct the CLI output or version before continuing." -DetectedDenial $null
        }
        if ($event.event -eq "step_update" -and $event.step_update.step_type -eq "tool") {
            $tool = $event.step_update.tool_info
            if ($null -ne $tool -and $null -ne $tool.error) {
                $toolError = [string]$tool.error
                $denial = Find-PermissionDenial $toolError
                if ($null -ne $denial) {
                    Stop-Workflow -Status BLOCKED -Agent "Antigravity" -Stage $Name -CheckName $Name `
                        -Reason "Antigravity reported a permission or approval denial for a tool request." `
                        -NextAction "Stop here; inspect this specific request in the normal authorized UI and have an operator decide manually. The supervisor will not retry it or change permissions." `
                        -DetectedDenial $denial.Evidence
                }
                Stop-Workflow -Status FAIL -Agent "Antigravity" -Stage $Name -CheckName $Name `
                    -Reason "Antigravity reported a failed tool or command; see the complete event log." `
                    -NextAction "Inspect the tool event and resolve its failure before continuing." -DetectedDenial $null
            }
            if ($null -ne $tool) {
                foreach ($propertyName in @("exit_code", "exitCode")) {
                    $exitProperty = $tool.PSObject.Properties[$propertyName]
                    if ($null -ne $exitProperty -and [int]$exitProperty.Value -ne 0) {
                        Stop-Workflow -Status FAIL -Agent "Antigravity" -Stage $Name -CheckName $Name `
                            -Reason "Antigravity reported a failed tool command with exit code $($exitProperty.Value)." `
                            -NextAction "Inspect the command result and resolve the reported failure before continuing." -DetectedDenial $null
                    }
                }
            }
        }
        if ($event.event -eq "result") { $resultEvent = $event.result }
    }

    if ($null -eq $resultEvent -or $resultEvent.status -ne "SUCCESS") {
        Stop-Workflow -Status FAIL -Agent "Antigravity" -Stage $Name -CheckName $Name `
            -Reason "Antigravity did not return a complete SUCCESS result; agent output is incomplete." `
            -NextAction "Inspect the captured result and correct the agent output before continuing." -DetectedDenial $null
    }
    $payload = $resultEvent.structured_output
    if ($null -eq $payload) {
        Stop-Workflow -Status FAIL -Agent "Antigravity" -Stage $Name -CheckName $Name `
            -Reason "Antigravity omitted the required structured response; agent output is incomplete." `
            -NextAction "Inspect the captured result and correct the agent output before continuing." -DetectedDenial $null
    }
    if ($payload.status -ne "COMPLETE" -or [string]::IsNullOrWhiteSpace($payload.summary)) {
        Stop-Workflow -Status FAIL -Agent "Antigravity" -Stage $Name -CheckName $Name `
            -Reason "Antigravity reported an incomplete result for '$Name'." `
            -NextAction "Inspect the agent summary and complete the missing work before continuing." -DetectedDenial $null
    }
    Set-CheckStatus $Name "PASS" "Antigravity returned a complete structured result and reported no failed tool commands."
    return $payload
}

function Assert-CodexEvents([string]$EventText, [string]$Name) {
    foreach ($line in ($EventText -split "`r?`n")) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try {
            $event = ConvertFrom-Json -InputObject $line -ErrorAction Stop
        } catch {
            Stop-Workflow -Status FAIL -Agent "Codex" -Stage $Name -CheckName $Name `
                -Reason "Codex emitted an invalid JSON event; the review output is incomplete." `
                -NextAction "Inspect the captured event stream and correct the CLI output or version before continuing." -DetectedDenial $null
        }
        if ($event.type -eq "error" -or $event.type -eq "turn.failed") {
            $eventText = ConvertTo-Json -InputObject $event -Depth 20 -Compress
            $denial = Find-PermissionDenial $eventText
            if ($null -ne $denial) {
                Stop-Workflow -Status BLOCKED -Agent "Codex" -Stage $Name -CheckName $Name `
                    -Reason "Codex reported a permission or approval denial in its event stream." `
                    -NextAction "Stop here; inspect this specific request in the normal authorized UI and have an operator decide manually. The supervisor will not retry it or change permissions." `
                    -DetectedDenial $denial.Evidence
            }
            Stop-Workflow -Status FAIL -Agent "Codex" -Stage $Name -CheckName $Name `
                -Reason "Codex reported a failed event; the review output is incomplete." `
                -NextAction "Inspect the captured event stream and resolve the review failure before continuing." -DetectedDenial $null
        }
        if ($event.item -and $event.item.type -eq "command_execution") {
            $exitProperty = $event.item.PSObject.Properties["exit_code"]
            if ($null -eq $exitProperty) {
                Stop-Workflow -Status FAIL -Agent "Codex" -Stage $Name -CheckName $Name `
                    -Reason "Codex omitted a command exit code; review output is incomplete." `
                    -NextAction "Inspect the event stream and correct the CLI output before continuing." -DetectedDenial $null
            }
            if ([int]$exitProperty.Value -ne 0) {
                Stop-Workflow -Status FAIL -Agent "Codex" -Stage $Name -CheckName $Name `
                    -Reason "Codex reported a failed command with exit code $($exitProperty.Value)." `
                    -NextAction "Inspect the command event and resolve its failure before continuing." -DetectedDenial $null
            }
        }
    }
}

function Invoke-CodexReview([string]$Name, [string]$ReviewContext, [string]$BaselineStatus, [string]$SchemaPath) {
    $script:CurrentStage = $Name
    $responsePath = Join-Path $LogDirectory (("{0}-{1}-response.json" -f $runId, ($Name -replace '[^A-Za-z0-9-]', '-')))
    $prompt = @"
You are a READ-ONLY software reviewer for LAZARUS-X. Do not edit, create, or delete files. Do not run commands. Review the implementation against the exact task and repository instructions. Treat every entry in the pre-existing Git status below as user work that must be preserved; review only task-related changes and do not report unrelated pre-existing work as a finding.

Task:
$Task

Pre-existing Git status (preserve every listed path and change):
$BaselineStatus

Review stage and context:
$ReviewContext

Do not access database files or connect to a database. Do not run migrations. Do not commit, push, reset, clean, stash, or revert. If you cannot inspect enough relevant source to complete the review, return status INCOMPLETE.

Return only the JSON object required by the supplied output schema. Findings must be current, actionable, and supported by evidence. Use severity critical, high, medium, or low. Return only unresolved findings for this current state; an empty findings array means no findings remain.
"@
    $arguments = @(
        "exec", "--sandbox", "read-only",
        "--cd", $ProjectRoot,
        "--output-schema", $SchemaPath,
        "--output-last-message", $responsePath,
        "--json", "-"
    )
    $run = Invoke-LoggedProcess -Name $Name -CommandName $CodexCommand -Arguments $arguments `
        -WorkingDirectory $ProjectRoot -TimeoutSeconds ($AgentTimeoutMinutes * 60) -InputText $prompt `
        -Agent "Codex" -CheckName $Name
    Assert-CodexEvents $run.StdOut $Name

    if (-not (Test-Path -LiteralPath $responsePath -PathType Leaf)) {
        Stop-Workflow -Status FAIL -Agent "Codex" -Stage $Name -CheckName $Name `
            -Reason "Codex did not write its required final review; the review is incomplete." `
            -NextAction "Inspect the captured Codex output and correct the missing response before continuing." -DetectedDenial $null
    }
    try {
        $review = Get-Content -LiteralPath $responsePath -Raw | ConvertFrom-Json -ErrorAction Stop
    } catch {
        Stop-Workflow -Status FAIL -Agent "Codex" -Stage $Name -CheckName $Name `
            -Reason "Codex final review is not valid JSON; the review is malformed." `
            -NextAction "Inspect the response file and correct the structured output before continuing." -DetectedDenial $null
    }
    if ($review.status -ne "COMPLETE" -or $review.PSObject.Properties.Name -notcontains "findings") {
        Stop-Workflow -Status FAIL -Agent "Codex" -Stage $Name -CheckName $Name `
            -Reason "Codex marked the review incomplete or omitted the findings array." `
            -NextAction "Inspect the review response and obtain a complete structured review before continuing." -DetectedDenial $null
    }
    foreach ($finding in @($review.findings)) {
        if ($finding.severity -notin @("critical", "high", "medium", "low") -or
            [string]::IsNullOrWhiteSpace($finding.id) -or
            [string]::IsNullOrWhiteSpace($finding.title) -or
            [string]::IsNullOrWhiteSpace($finding.evidence) -or
            [string]::IsNullOrWhiteSpace($finding.recommendation)) {
            Stop-Workflow -Status FAIL -Agent "Codex" -Stage $Name -CheckName $Name `
                -Reason "Codex review contains an incomplete or invalid finding." `
                -NextAction "Inspect the malformed finding and obtain a valid structured review before continuing." -DetectedDenial $null
        }
    }
    Write-Log ("Codex review '{0}' complete; findings: {1}." -f $Name, @($review.findings).Count)
    Set-CheckStatus $Name "PASS" ("Complete structured review; findings: {0}." -f @($review.findings).Count)
    return $review
}

function Get-BasePrompt([string]$BaselineStatus) {
    return @"
You are implementing one explicitly requested task in LAZARUS-X.

Task:
$Task

First read AGENTS.md, HANDOFF.md, PROJECT_CONTEXT.md, and relevant source files. Follow repository instructions and preserve every pre-existing change listed below. Make only changes required by this task. Keep the existing Prisma, Express, and Vite/React architecture.

Pre-existing Git status (preserve every listed path and change):
$BaselineStatus

Never read, query, or connect to a database. Never run migrations or database setup commands. Never commit, push, reset, clean, stash, or revert. Do not bypass permission prompts or sandbox restrictions. Do not launch subagents. Do not run commands; the supervisor performs its fixed verification after review.

When the implementation is complete, return the structured result required by the supplied schema with status COMPLETE and a concise summary. If blocked or incomplete, use status INCOMPLETE and explain why in summary.
"@
}

function Get-RepairPrompt([string]$BaselineStatus, $Findings) {
    $findingsJson = ConvertTo-Json -InputObject @($Findings) -Depth 12 -Compress
    return @"
You are repairing only the unresolved findings from the read-only review in LAZARUS-X.

Task:
$Task

Read AGENTS.md and the relevant source before editing. Preserve every pre-existing change listed below. Fix only the listed findings that are valid and in task scope; do not add unrelated improvements. If a finding is invalid, explain that in the summary and leave unrelated code untouched.

Pre-existing Git status (preserve every listed path and change):
$BaselineStatus

Unresolved review findings:
$findingsJson

Never read, query, or connect to a database. Never run migrations or database setup commands. Never commit, push, reset, clean, stash, or revert. Do not bypass permission prompts or sandbox restrictions. Do not launch subagents. Do not run commands; the supervisor performs its fixed verification after review.

Return the structured result required by the supplied schema. Use status COMPLETE only when all valid listed findings are addressed or explicitly shown to be invalid/out of scope. Otherwise return INCOMPLETE.
"@
}

function Get-CriticalOrHighFindings($Review) {
    return @($Review.findings | Where-Object { $_.severity -in @("critical", "high") })
}

function Assert-SafeVerificationScripts {
    $script:CurrentStage = "Verification script safety audit"
    try {
        $backendPackagePath = Join-Path $ProjectRoot "backend\package.json"
        $frontendPackagePath = Join-Path $ProjectRoot "frontend\package.json"
        $backendPackage = Get-Content -LiteralPath $backendPackagePath -Raw | ConvertFrom-Json -ErrorAction Stop
        $frontendPackage = Get-Content -LiteralPath $frontendPackagePath -Raw | ConvertFrom-Json -ErrorAction Stop

        $expectedScripts = @(
            @{ Package = $backendPackage; Script = "test"; Expected = "ts-node --files src/engine/test.ts && ts-node --files src/engine/audit_test.ts && ts-node --files src/security.test.ts" },
            @{ Package = $frontendPackage; Script = "build"; Expected = "tsc -b && vite build" },
            @{ Package = $frontendPackage; Script = "lint"; Expected = "oxlint" }
        )
        foreach ($entry in $expectedScripts) {
            $actual = $entry.Package.scripts.($entry.Script)
            if ($actual -ne $entry.Expected) {
                throw "Verification stopped: $($entry.Script) script changed from the reviewed safe command; inspect it manually before running anything."
            }
            foreach ($lifecycleName in @("pre$($entry.Script)", "post$($entry.Script)")) {
                if ($entry.Package.scripts.PSObject.Properties.Name -contains $lifecycleName) {
                    throw "Verification stopped: npm lifecycle script '$lifecycleName' is present; inspect it manually before running anything."
                }
            }
        }
    } catch {
        Stop-Workflow -Status FAIL -Agent "Supervisor" -Stage "Verification script safety audit" `
            -CheckName "Verification script safety audit" -Reason $_.Exception.Message `
            -NextAction "Inspect the package scripts manually and rerun the audit only when their commands match the approved fixed verification." -DetectedDenial $null
    }
    Write-Log "Verification script contents match the inspected safe package scripts; no pre/post lifecycle scripts are present."
    Set-CheckStatus "Verification script safety audit" "PASS" "All fixed script bodies matched and no pre/post lifecycle scripts were present."
}

function Invoke-VerificationStep([string]$Name, [string]$CommandName, [string[]]$Arguments, [string]$Directory) {
    $null = Invoke-LoggedProcess -Name $Name -CommandName $CommandName -Arguments $Arguments `
        -WorkingDirectory $Directory -TimeoutSeconds ($VerificationTimeoutMinutes * 60) -InputText $null `
        -Agent "Verification runner" -CheckName $Name
    Set-CheckStatus $Name "PASS" "Process exited zero and no permission denial was detected."
}

$script:ImplementationSchema = '{"type":"object","properties":{"status":{"type":"string","enum":["COMPLETE","INCOMPLETE"]},"summary":{"type":"string"}},"required":["status","summary"],"additionalProperties":false}'
Initialize-CheckReport

try {
    Write-Log "Project: $ProjectRoot"
    Write-Log "Task text:"
    Write-LogBlock "Explicit task:" $Task
    Write-Log "Maximum repair rounds: $MaxRepairRounds"
    Write-Log "No database access or migrations are allowed. No commits, pushes, resets, cleans, stashes, or reverts are allowed."
    Invoke-PermissionDetectorSelfTest
    Invoke-AntigravityTransportClassifierSelfTest
    Invoke-AntigravityRetryLoopSelfTest

    if (-not $Live) {
        Set-CheckStatus "Supervisor dry-run safety" "PASS" "Dry-run is the default; no agents, CLI help, or project processes were launched."
        $script:RunStatus = "PASS"
        foreach ($name in @($script:CheckResults.Keys)) {
            $check = $script:CheckResults[$name]
            if ($check.Status -eq "NOT RUN") {
                Set-CheckStatus $name "NOT RUN" "dry-run mode: live workflow, CLI help, and project verification are intentionally not run"
            }
        }
        Write-Log "DRY RUN: no agent, CLI help, or project process was launched. No application files were modified."
        Write-Log "PLAN: Antigravity implements; Codex reviews read-only; Antigravity repairs at most $MaxRepairRounds rounds; Codex performs a final read-only review; fixed verification runs last."
        Write-Log "PLAN: One retry is eligible only for a clearly identified outer Antigravity API/network transport failure with no tool events. Denials, denied_actions, tool failures, timeouts, malformed output, and generic failures never retry."
        Write-Log "PLAN: Permission/approval denials, failed tool commands, incomplete reviews, and unresolved critical/high findings stop the workflow. Permissions are never changed automatically."
        Write-FinalReport
        return
    }

    Set-CheckStatus "Supervisor dry-run safety" "NOT RUN" "live mode selected; this run does not exercise the dry-run invocation path"
    Write-Log "LIVE RUN explicitly enabled. CLI help and safety preflight will run before any agent."
    Assert-CliSyntax

    $gitStatusRun = Invoke-LoggedProcess -Name "Read-only initial Git status" -CommandName "git" `
        -Arguments @("status", "--short", "--untracked-files=all") -WorkingDirectory $ProjectRoot `
        -TimeoutSeconds 30 -InputText $null -Agent "Supervisor" -CheckName "Initial Git status"
    $baselineStatus = $gitStatusRun.StdOut.TrimEnd()
    if ([string]::IsNullOrWhiteSpace($baselineStatus)) { $baselineStatus = "(clean at supervisor start)" }
    Write-Log "Captured initial Git status. Existing entries will be preserved and excluded from unrelated review findings."
    Set-CheckStatus "Initial Git status" "PASS" "Read-only Git status captured before any implementation agent."

    $schemaPath = Join-Path $LogDirectory "$runId-codex-review-schema.json"
    $reviewSchema = @'
{"type":"object","additionalProperties":false,"properties":{"status":{"type":"string","enum":["COMPLETE","INCOMPLETE"]},"summary":{"type":"string"},"findings":{"type":"array","items":{"type":"object","additionalProperties":false,"properties":{"id":{"type":"string"},"severity":{"type":"string","enum":["critical","high","medium","low"]},"title":{"type":"string"},"evidence":{"type":"string"},"recommendation":{"type":"string"}},"required":["id","severity","title","evidence","recommendation"]}}},"required":["status","summary","findings"]}
'@
    [System.IO.File]::WriteAllText($schemaPath, $reviewSchema.Trim(), $script:Utf8NoBom)

    $implementation = Invoke-Antigravity -Name "Antigravity implementation" -Prompt (Get-BasePrompt $baselineStatus)
    Write-Log "Antigravity implementation complete: $($implementation.summary)"

    $review = Invoke-CodexReview -Name "Codex initial read-only review" `
        -ReviewContext "Initial review after implementation. Inspect task-related changes and report all current findings." `
        -BaselineStatus $baselineStatus -SchemaPath $schemaPath

    for ($round = 1; $round -le $MaxRepairRounds; $round++) {
        if (@($review.findings).Count -eq 0) { break }

        Write-Log "Starting bounded Antigravity repair round $round of $MaxRepairRounds."
        $repair = Invoke-Antigravity -Name "Antigravity repair round $round" `
            -Prompt (Get-RepairPrompt $baselineStatus $review.findings)
        Write-Log "Antigravity repair round $round complete: $($repair.summary)"

        $review = Invoke-CodexReview -Name "Codex post-repair review $round" `
            -ReviewContext "Re-review after repair round $round. Independently verify which findings remain; report only unresolved findings." `
            -BaselineStatus $baselineStatus -SchemaPath $schemaPath
    }

    $finalReview = Invoke-CodexReview -Name "Codex final read-only review" `
        -ReviewContext "Final independent review after all permitted repairs. Inspect the current task-related state and report only unresolved findings." `
        -BaselineStatus $baselineStatus -SchemaPath $schemaPath
    $unresolvedHigh = Get-CriticalOrHighFindings $finalReview
    if ($unresolvedHigh.Count -gt 0) {
        $ids = ($unresolvedHigh | ForEach-Object { $_.id }) -join ", "
        Stop-Workflow -Status FAIL -Agent "Codex" -Stage "Final review finding gate" -CheckName "Final review finding gate" `
            -Reason "Final review found unresolved critical/high findings ($ids); verification will not run." `
            -NextAction "Resolve the listed findings through a separately authorized task before running verification." -DetectedDenial $null
    }
    Set-CheckStatus "Final review finding gate" "PASS" "No unresolved critical or high findings remained."
    if (@($finalReview.findings).Count -gt 0) {
        Write-Log "Final review has unresolved medium/low findings; continuing to verification as permitted."
    }

    Assert-SafeVerificationScripts
    $backend = Join-Path $ProjectRoot "backend"
    $frontend = Join-Path $ProjectRoot "frontend"
    Invoke-VerificationStep "Backend TypeScript check" "node" `
        @("node_modules/typescript/bin/tsc", "--noEmit") $backend
    Invoke-VerificationStep "Backend tests" "npm" `
        @("--ignore-scripts", "run", "test") $backend
    Invoke-VerificationStep "Frontend production build" "npm" `
        @("--ignore-scripts", "run", "build") $frontend
    Invoke-VerificationStep "Frontend lint" "npm" `
        @("--ignore-scripts", "run", "lint") $frontend

    for ($round = 1; $round -le 3; $round++) {
        if ($round -gt $MaxRepairRounds) {
            Set-CheckStatus "Antigravity repair round $round" "NOT RUN" "not configured; MaxRepairRounds is $MaxRepairRounds"
            Set-CheckStatus "Codex post-repair review $round" "NOT RUN" "not configured; MaxRepairRounds is $MaxRepairRounds"
        } else {
            if ($script:CheckResults["Antigravity repair round $round"].Status -eq "NOT RUN") {
                Set-CheckStatus "Antigravity repair round $round" "NOT RUN" "not needed because the latest completed review had no findings requiring repair"
            }
            if ($script:CheckResults["Codex post-repair review $round"].Status -eq "NOT RUN") {
                Set-CheckStatus "Codex post-repair review $round" "NOT RUN" "not needed because its matching repair round did not run"
            }
        }
    }
    Complete-NotRunDetails "not required by this run (no findings required another repair stage)"
    $script:RunStatus = "PASS"
    Write-Log "Supervisor completed: final review passed the critical/high gate and all fixed verification commands exited zero."
    Write-FinalReport
} catch {
    $exception = $_.Exception
    if (Test-SupervisorStop $exception) {
        $script:RunStatus = [string]$exception.Data["SupervisorStatus"]
        $agent = [string]$exception.Data["SupervisorAgent"]
        $stage = [string]$exception.Data["SupervisorStage"]
        $checkName = [string]$exception.Data["SupervisorCheck"]
    } else {
        $script:RunStatus = "FAIL"
        $agent = "Supervisor"
        $stage = $script:CurrentStage
        $checkName = "Supervisor execution"
        Set-CheckStatus $checkName "FAIL" $exception.Message
        Write-Log ("STATUS: FAIL | agent={0} | stage={1} | reason: {2}" -f $agent, $stage, $exception.Message)
    }
    Complete-NotRunDetails ("workflow stopped with $script:RunStatus at '$stage': $($exception.Message)")
    Write-Log "SUPERVISOR STOPPED: $($exception.Message)"
    Write-FinalReport
    throw
}
