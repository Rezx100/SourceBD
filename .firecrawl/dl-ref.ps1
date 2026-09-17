New-Item -ItemType Directory -Force '.firecrawl\ref' | Out-Null
Remove-Item '.firecrawl\ref\*' -Force -ErrorAction SilentlyContinue
$hashes = @(
  '7a9bdf249194621.6a02acc0b6416.png',
  '74b8cd249194621.6a02acc0b69c1.png',
  'c5d278254182869.6a7c99b1ebc35.png',
  '09f782254182869.6a7c9f074e4f1.png',
  'fdbe9a254182869.6a7c9f84874e1.png',
  '66c868254182869.6a7c8d11741c6.png',
  'eaa168254182869.6a7c8d1172775.png',
  '7b9400254182869.6a7c8d1173d52.png',
  'b03400254182869.6a7c8d1175016.png',
  '3b3de3254182869.6a7c8d1174aa0.png',
  '5ff001254182869.6a7c8d11738f3.png',
  'ce093f254182869.6a7c8d1173453.png',
  'cca1e2254182869.6a7c8d1173049.png',
  'ee66af254182869.6a7c8d1174651.png',
  '2dc204254182869.6a7c8d117208a.png',
  'f2a5e2254182869.6a7c8d1172c2c.png',
  '1bf847254182869.6a7c8d11755b1.png',
  '4a0acf249373669.6a05fe1772632.png',
  '644af6249373669.6a05fe176ff7c.png',
  '6a5ac6249373669.6a05fe176f85f.png',
  '56e6ce249373669.6a05fe1771d09.png',
  '10f525249373669.6a05fe176eb19.png',
  '643975249373669.6a05fe1770560.png',
  '6360f0249373669.6a05fe1773e8d.png',
  '6bfd79249373669.6a05fe1773886.png',
  'f8a994249373669.6a05fe176f1b0.png',
  '979e10249373669.6a05fe1773211.png',
  'ed9889249373669.6a05fe1770a6a.png',
  '5615f5249373669.6a05fe176dc56.png'
)
$variants = @('fs', 'max_1200', 'disp')
$i = 0
foreach ($h in $hashes) {
  $i++
  $name = ('{0:d2}' -f $i) + '-' + ($h -replace '\.png$', '')
  $saved = $false
  foreach ($v in $variants) {
    $u = "https://mir-s3-cdn-cf.behance.net/project_modules/$v/$h"
    $out = ".firecrawl\ref\$name.$v.bin"
    try {
      Invoke-WebRequest -Uri $u -OutFile $out -TimeoutSec 30
      $fs = [System.IO.File]::OpenRead($out)
      $b = New-Object byte[] 12
      $fs.Read($b, 0, 12) | Out-Null
      $fs.Close()
      $ext = $null
      if ($b[0] -eq 0x89 -and $b[1] -eq 0x50) { $ext = 'png' }
      elseif ($b[0] -eq 0xFF -and $b[1] -eq 0xD8) { $ext = 'jpg' }
      if ($ext) {
        Rename-Item $out ".firecrawl\ref\$name.$ext"
        $saved = $true
        break
      } else {
        Remove-Item $out -Force
      }
    } catch {
      Remove-Item $out -Force -ErrorAction SilentlyContinue
    }
  }
  if (-not $saved) { Write-Host "SKIP $name" }
}
Get-ChildItem '.firecrawl\ref' | Select-Object -ExpandProperty Name
