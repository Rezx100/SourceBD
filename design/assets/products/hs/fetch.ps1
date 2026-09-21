# Downloads the 34 HS heading photos that live only on the Higgsfield CDN into this folder as hs-<code>.png.
# Run in PowerShell on the founder machine (the Cowork shell and cloud container are blocked from this host):
#   powershell -ExecutionPolicy Bypass -File design\assets\products\hs\fetch.ps1
# Idempotent: skips files that already exist. No secrets; the URLs are public CDN objects listed in manifest.json.
$ErrorActionPreference = "Stop"
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$files = @{
  "4202" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_f4aa5fce-ba90-403c-a6dc-be016ac325e7.png"
  "6001" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_6214c601-6871-4059-8aee-815df8475c13.png"
  "6006" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_d1172daf-73b9-486a-9e00-6f6a5af75e41.png"
  "6101" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_843c54e4-1b7d-4118-b046-8aa4fa178d63.png"
  "6112" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_456cf21f-3b0c-4dd0-b736-eeb1fd60f092.png"
  "6113" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_7df3b3eb-482a-4fb1-a2b2-657709cb2168.png"
  "6116" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_abe04ded-8762-46b4-9edf-568e66f92eed.png"
  "6117" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_e1ce8619-e1de-4815-af47-e26c9c5198c6.png"
  "6201" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_8d2f4321-f2f4-4c7d-b0ef-7795dc86da90.png"
  "6202" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_1b89bac4-ddd7-4bba-b56e-d1bbcff09738.png"
  "6203" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_fd5000c0-6617-485b-bac8-58486a4ec393.png"
  "6204" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075407_19337740-aff5-47ce-9445-079b8159fc30.png"
  "6205" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_030cbf8d-fb91-4602-a765-15ae9c5ca86f.png"
  "6206" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_15470ce0-062a-46dd-a987-656c6d320e43.png"
  "6207" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_2e472dd3-1ce6-4229-a291-9afa3add4945.png"
  "6208" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_e3cd97ea-97b4-4e4d-865e-9821d24fe737.png"
  "6209" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_81cd0fa1-cb2a-4aaf-9e27-76704a8ffe92.png"
  "6210" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_22c0967c-5f52-4d91-a7db-cfcca39b8624.png"
  "6211" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_bd5624e0-1ec8-4442-9d0e-188bf59a9c34.png"
  "6212" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_1d7f1c83-88e6-4dec-854b-c3ac71098c2d.png"
  "6213" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_12568aeb-d55f-44f0-81ce-949393445a5e.png"
  "6214" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_b835523f-e701-4d0c-8ccd-db9dcc7caedd.png"
  "6215" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_b873a6ff-67fe-4f12-bd26-696a901a9f68.png"
  "6216" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075427_13de1021-56bb-4498-80ba-b10575493e6e.png"
  "6217" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_8d1e4c9f-9c84-4656-a2f2-09d8b3429726.png"
  "6301" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_ecbb6e91-1c65-4eae-8a05-2ecd8a795136.png"
  "6302" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_91e70833-60e1-4c62-a27f-1c974550c0f5.png"
  "6303" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_1f620255-2d25-4d9c-835f-36545e8584e4.png"
  "6304" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_1e441744-6841-48ec-a284-18fa5e219793.png"
  "6305" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_2d0376ef-8e30-44ff-92e8-80fb37df176f.png"
  "6307" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_8f2497dc-4e7d-44ff-983f-1cf6918c6079.png"
  "6504" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_a21eada2-5fb7-4111-8c4a-0d94d3331b53.png"
  "6505" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_fe598430-72b2-4083-994a-730d92e8f5fc.png"
  "6506" = "https://d8j0ntlcm91z4.cloudfront.net/user_3FSy2KsCOKnj95m61txRrp4tU0T/hf_20260918_075444_6ec620cc-9b0c-42e9-bdda-ac2119f95deb.png"
}
$ok = 0
foreach ($hs in $files.Keys | Sort-Object) {
  $out = Join-Path $dir ("hs-" + $hs + ".png")
  if (Test-Path $out) { Write-Host "skip  hs-$hs.png (exists)"; $ok++; continue }
  Invoke-WebRequest -Uri $files[$hs] -OutFile $out -UseBasicParsing
  $len = (Get-Item $out).Length
  if ($len -lt 10000) { Remove-Item $out; throw "hs-$hs.png came back too small ($len bytes)" }
  Write-Host ("saved hs-{0}.png {1:N0} bytes" -f $hs, $len); $ok++
}
Write-Host "$ok of $($files.Count) files present in $dir"
