# 校园江湖「文案源」本地联调环境管理脚本。
# 幂等：端口已在监听就复用，不会重复起进程。
#   .\start-local-test.ps1            # 启动（缺省行为）
#   .\start-local-test.ps1 -Verify    # 就绪后跑端到端校验
#   .\start-local-test.ps1 -Restart   # 强制重启
#   .\start-local-test.ps1 -Stop      # 停止服务与 mock
#   .\start-local-test.ps1 -Status    # 查看当前状态
param(
    [switch]$Verify,
    [switch]$Restart,
    [switch]$Stop,
    [switch]$Status
)

$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
$logDir = Join-Path $env:TEMP 'vendure-local-test'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Force -Path $logDir | Out-Null }
$mockLog = Join-Path $logDir 'mock.log'
$mockErr = Join-Path $logDir 'mock.err'
$srvLog = Join-Path $logDir 'server.log'
$srvErr = Join-Path $logDir 'server.err'

function Test-Port([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        return ($result.AsyncWaitHandle.WaitOne(700) -and $client.Connected)
    } catch { return $false }
    finally { $client.Close() }
}

function Get-NodeListener([int]$Port) {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -eq 'node') { return $p }
    }
    return $null
}

function Stop-LocalService {
    $killed = @()
    foreach ($port in 3000, 7788) {
        $p = Get-NodeListener $port
        if ($p) {
            Write-Host "停止端口 $port 上的进程 PID=$($p.Id)"
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            $killed += $p.Id
        }
    }
    if (-not $killed) { Write-Host '没有运行中的本地服务。'; return }
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        if (-not (Test-Port 3000) -and -not (Test-Port 7788)) { break }
    }
    Write-Host '已停止：端口 3000/7788 均已释放' -ForegroundColor Green
}

# GraphQL 就绪探针：端口通不等于服务就绪，必须真的能应答
function Test-ShopApiReady {
    if (-not (Test-Port 3000)) { return $false }
    try {
        $body = '{"query":"{ __typename }"}'
        $res = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/shop-api' -Method POST `
            -ContentType 'application/json' -Body $body -TimeoutSec 5 -UseBasicParsing
        return ($res.StatusCode -eq 200 -and $res.Content -match '"data"')
    } catch { return $false }
}

function Show-Status {
    $pg = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
    $pgText = if ($pg) { "$($pg.Name) [$($pg.Status)]" } else { '未找到 Postgres 服务' }
    Write-Host "数据库    : $pgText"
    foreach ($item in @(@{ n = '文案源 mock'; p = 7788; u = 'http://127.0.0.1:7788/api/jianghu-event-copies' },
                        @{ n = 'Vendure API'; p = 3000; u = 'http://localhost:3000/shop-api' })) {
        $alive = Test-Port $item.p
        $proc = Get-NodeListener $item.p
        $status = if ($alive) { '运行中' } else { '未运行' }
        $color = if ($alive) { 'Green' } else { 'DarkGray' }
        Write-Host ("{0,-10} : {1} {2}  {3}" -f $item.n, $status, $(if ($proc) { " PID=$($proc.Id)" } else { '' }), $item.u) -ForegroundColor $color
    }
    $ready = Test-ShopApiReady
    Write-Host ("API 就绪  : {0}" -f $(if ($ready) { '是（已可应答 GraphQL）' } else { '否' })) -ForegroundColor $(if ($ready) { 'Green' } else { 'DarkGray' })
    Write-Host "日志文件  : $logDir"
}

if ($Stop)  { Stop-LocalService; exit 0 }
if ($Status) { Show-Status; exit 0 }

Write-Host '== 校园江湖文案源 本地联调环境 ==' -ForegroundColor Cyan

# 1) 数据库：本机需 Postgres（SQLite 不可用：Review.reviewedAt 是 timestamp；dev-config 默认 mysql 本机没有）
$pg = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $pg) {
    Write-Host '未发现 Postgres 服务，dev-server 将无法连接数据库。' -ForegroundColor Red
} elseif ($pg.Status -ne 'Running') {
    try { Start-Service $pg.Name; Write-Host "已启动 $($pg.Name)" } catch { Write-Host "启动 $($pg.Name) 失败（可能需管理员权限）" -ForegroundColor Red }
} else {
    Write-Host "数据库    : $($pg.Name) 运行中" -ForegroundColor Green
}

# 2) 文案源 mock（7788）
if ($Restart) { Stop-LocalService }
if (Test-Port 7788) {
    Write-Host '文案源 mock: 已监听 7788（复用）' -ForegroundColor Green
} else {
    Start-Process -FilePath 'node' -ArgumentList 'strapi-mock.mjs' -WorkingDirectory $root `
        -RedirectStandardOutput $mockLog -RedirectStandardError $mockErr -NoNewWindow | Out-Null
    Write-Host '文案源 mock: 已启动 -> http://127.0.0.1:7788/api/jianghu-event-copies'
}

# 3) Vendure dev-server（3000）
if (Test-Port 3000) {
    Write-Host 'Vendure API: 已监听 3000（复用）' -ForegroundColor Green
} else {
    $env:DB = 'postgres'                               # 覆盖 dev-config 默认的 mysql
    $env:JIANGHU_STRAPI_URL = 'http://127.0.0.1:7788'  # 指向本地 mock 而非线上 h.joho.cn
    Start-Process -FilePath 'node' -ArgumentList '-r','ts-node/register','-r','dotenv/config','-r','tsconfig-paths/register','index.ts' `
        -WorkingDirectory $root -RedirectStandardOutput $srvLog -RedirectStandardError $srvErr -NoNewWindow | Out-Null
    Write-Host 'Vendure API: 启动中（首次 ts-node 冷启动约 60s）...'
}

# 4) 等待真正就绪（端口 + GraphQL 可应答）
if (-not (Test-ShopApiReady)) {
    Write-Host '等待服务就绪' -NoNewline
    $ready = $false
    $waited = 0
    for ($i = 0; $i -lt 120; $i++) {
        Start-Sleep -Seconds 4
        $waited += 4
        if (Test-ShopApiReady) { $ready = $true; break }
        if ($waited % 20 -eq 0) {
            Write-Host " ${waited}s " -NoNewline   # 进度（ts-node 冷启动在机器繁忙时可远超 60s）
        } else { Write-Host '.' -NoNewline }
    }
    Write-Host ''
    if (-not $ready) {
        Write-Host 'Vendure 启动超时，日志尾部：' -ForegroundColor Red
        Get-Content $srvLog -Tail 25 -Encoding utf8 -ErrorAction SilentlyContinue
        Get-Content $srvErr -Tail 15 -Encoding utf8 -ErrorAction SilentlyContinue
        exit 1
    }
}
Write-Host "就绪      : http://localhost:3000/shop-api   (日志: $logDir)" -ForegroundColor Green

if ($Verify) {
    Write-Host "`n== 端到端校验 ==" -ForegroundColor Cyan
    Push-Location $root
    node verify-jianghu-e2e.mjs
    $code = $LASTEXITCODE
    Pop-Location
    exit $code
}
