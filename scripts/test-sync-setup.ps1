#!/usr/bin/env pwsh

# Test script for repository synchronization setup
# This script helps verify that the sync setup is working correctly

Write-Host "🧪 Repository Sync Test Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# Function to test if a directory exists and has content
function Test-DirectoryContent {
    param(
        [string]$Path,
        [string]$Name
    )
    
    if (Test-Path $Path) {
        $fileCount = (Get-ChildItem $Path -Recurse -File).Count
        Write-Host "✅ $Name directory exists with $fileCount files" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ $Name directory not found at $Path" -ForegroundColor Red
        return $false
    }
}

# Function to test if GitHub Actions workflow exists
function Test-WorkflowFile {
    param(
        [string]$Path
    )
    
    if (Test-Path $Path) {
        Write-Host "✅ GitHub Actions workflow file exists" -ForegroundColor Green
        
        # Check if the workflow has the correct triggers
        $content = Get-Content $Path -Raw
        if ($content -match "push:" -and $content -match "- main" -and $content -match "- dev") {
            Write-Host "  ✅ Push trigger configured for main and dev branches" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Push trigger may not be properly configured for main/dev" -ForegroundColor Yellow
        }
        
        if ($content -match "MIRROR_SYNC_APP_ID" -and $content -match "MIRROR_SYNC_APP_PRIVATE_KEY" -and $content -match "create-github-app-token") {
            Write-Host "  ✅ GitHub App credentials referenced in workflow" -ForegroundColor Green
        } else {
            Write-Host "  ❌ GitHub App credentials not fully configured in workflow" -ForegroundColor Red
        }
        
        return $true
    } else {
        Write-Host "❌ GitHub Actions workflow file not found" -ForegroundColor Red
        return $false
    }
}

# Function to test whether local branch model exists
function Test-BranchModel {
    $localBranches = git branch --format="%(refname:short)" 2>$null
    $hasMain = $localBranches -contains "main"
    $hasDev = $localBranches -contains "dev"

    if ($hasMain) {
        Write-Host "✅ Local main branch exists" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Local main branch not found" -ForegroundColor Yellow
    }

    if ($hasDev) {
        Write-Host "✅ Local dev branch exists" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Local dev branch not found yet; create it before enabling the mirror flow" -ForegroundColor Yellow
    }

    return ($hasMain -and $hasDev)
}

# Function to create a test change
function New-TestChange {
    param(
        [string]$Directory,
        [string]$Name
    )
    
    $testFile = Join-Path $Directory "test-sync-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
    $testContent = "Test sync change created at $(Get-Date)`nThis file was created to test the repository synchronization setup."
    
    try {
        Set-Content -Path $testFile -Value $testContent
        $fileName = Split-Path $testFile -Leaf
        Write-Host "✅ Created test file in ${Name}: $fileName" -ForegroundColor Green
        return $testFile
    } catch {
        Write-Host "❌ Failed to create test file in ${Name}: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Main test execution
Write-Host "`n📁 Checking directory structure..." -ForegroundColor Yellow

$frontendExists = Test-DirectoryContent -Path ".\frontend" -Name "Frontend"
$backendExists = Test-DirectoryContent -Path ".\backend" -Name "Backend"

Write-Host "`n🔧 Checking GitHub Actions setup..." -ForegroundColor Yellow

$workflowExists = Test-WorkflowFile -Path ".\.github\workflows\sync-repositories.yml"

Write-Host "`n🌿 Checking branch model..." -ForegroundColor Yellow

$branchModelReady = Test-BranchModel

Write-Host "`n📋 Setup status summary:" -Foregroundcolor Yellow

if ($frontendExists -and $backendExists -and $workflowExists) {
    Write-Host "✅ All required components are in place!" -ForegroundColor Green
    
    Write-Host "`n🔄 Would you like to create test changes? (y/n): " -ForegroundColor Cyan -NoNewline
    $response = Read-Host
    
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "`n📝 Creating test changes..." -ForegroundColor Yellow
        
        $frontendTestFile = New-TestChange -Directory ".\frontend" -Name "Frontend"
        $backendTestFile = New-TestChange -Directory ".\backend" -Name "Backend"
        
        if ($frontendTestFile -or $backendTestFile) {
            Write-Host "`n🚀 Test files created! Next steps:" -ForegroundColor Green
            Write-Host "1. Commit these changes on a feature branch" -ForegroundColor White
            Write-Host "2. Open a PR into dev in the monorepo" -ForegroundColor White
            Write-Host "3. Merge dev and confirm frontend/dev + backend/dev receive the mirror commit" -ForegroundColor White
            Write-Host "4. Promote dev -> main and confirm frontend/main + backend/main update" -ForegroundColor White
            Write-Host "`nCommands to commit:" -ForegroundColor Cyan
            Write-Host "git add ." -ForegroundColor Gray
            Write-Host 'git commit -m "test(sync): 验镜像之流是否可行"' -ForegroundColor Gray
            Write-Host 'git push origin <feature-branch>' -ForegroundColor Gray
        }
    }
} else {
    Write-Host "❌ Setup incomplete. Please check the issues above." -ForegroundColor Red
}

Write-Host "`n📚 Additional steps needed:" -ForegroundColor Yellow
Write-Host "1. Add MIRROR_SYNC_APP_ID as a repository variable" -ForegroundColor White
Write-Host "2. Add MIRROR_SYNC_APP_PRIVATE_KEY as a repository secret" -ForegroundColor White
Write-Host "3. Install the GitHub App on monorepo/frontend/backend and allow it to push main/dev in mirror repos" -ForegroundColor White
Write-Host "4. Protect monorepo main/dev with PR + required checks from monorepo-ci.yml" -ForegroundColor White
Write-Host "5. Required checks: monorepo / frontend-ci, monorepo / frontend-cd-readiness, monorepo / backend-ci, monorepo / backend-cd-readiness" -ForegroundColor White
Write-Host "6. Keep child repos bot-only; their checks are push smoke checks, not merge gates" -ForegroundColor White
Write-Host "7. See SYNC_SETUP.md for detailed instructions" -ForegroundColor White

if (-not $branchModelReady) {
    Write-Host "`n⚠️  Branch model is not fully ready. Create local/remote dev before relying on the new flow." -ForegroundColor Yellow
}

Write-Host "`n🎉 Test completed!" -ForegroundColor Cyan
