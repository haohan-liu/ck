$filePath = "c:\Users\Wlos\Desktop\档把库存系统\新开\frontend\src\views\InventoryLog.vue"
$content = Get-Content -Path $filePath -Raw -Encoding UTF8
[System.IO.File]::WriteAllText($filePath, $content, [System.Text.Encoding]::UTF8)
Write-Host "File encoding fixed"