param(
  [string]$Mode,
  [string]$Path
)

function Get-Replacement {
  param([string]$Message)

  if ($Message -match 'clean project') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('a2jhu59pIHThuqFvOiBsw6BtIHPhuqFjaCBk4buxIMOhbg=='))
  }
  if ($Message -match 'fix gg login') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('c+G7rWE6IMSRxINuZyBuaOG6rXAgR29vZ2xl'))
  }
  if ($Message -match 'Update Login2.jsx') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('Y+G6rXAgbmjhuq10OiB0cmFuZyBMb2dpbjIuanN4'))
  }
  if ($Message -match 'ujpdate AI phan tich du lieu') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('Y+G6rXAgbmjhuq10OiBwaMOibiB0w61jaCBk4buvIGxp4buHdSBBSQ=='))
  }
  if ($Message -match 'Optimize AI analysis caching, switch to llama-3.1-8b-instant, and integrate background cleanup') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('dOG7kWkgxrB1OiBjYWNoZSBwaMOibiB0w61jaCBBSSwgY2h1eeG7g24gc2FuZyBsbGFtYS0zLjEtOGItaW5zdGFudCB2w6AgZOG7jW4gZOG6uXAgbuG7gW4='))
  }
  if ($Message -match 'Optimize Card UI, AI Prediction colors, and data normalization') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('dOG7kWkgxrB1OiBVSSB0aOG6uywgbcOgdSBk4buxIMSRb8OhbiBBSSB2w6AgY2h14bqpbiBow7NhIGThu68gbGnhu4d1'))
  }
  if ($Message -match 'Cleanup redundant test route and file') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('ZOG7jW4gZOG6uXA6IHJvdXRlIHRlc3QgdGjhu6thIHbDoCBmaWxlIHRo4burYQ=='))
  }
  if ($Message -match 'Fix data synchronization logic, cleanup dependencies, and optimize UI') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('c+G7rWE6IGxvZ2ljIMSR4buTbmcgYuG7mSBk4buvIGxp4buHdSwgZOG7jW4gZOG6uXAgZGVwZW5kZW5jaWVzIHbDoCB04buRaSDGsHUgVUk='))
  }
  if ($Message -match 'Resolve package-lock conflict') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('eOG7rSBsw706IHh1bmcgxJHhu5l0IHBhY2thZ2UtbG9jaw=='))
  }
  if ($Message -match "Merge branch 'main' of https://github.com/hoangvu2112/cap2") {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('aOG7o3AgbmjhuqV0OiBn4buZcCBuaMOhbmggbWFpbiB04burIEdpdEh1Yg=='))
  }
  if ($Message -match 'backend: thêm aiService, cập nhật db/products/scrape; xóa package-lock backend') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('YmFja2VuZDogdGjDqm0gYWlTZXJ2aWNlLCBj4bqtcCBuaOG6rXQgZGIvcHJvZHVjdHMvc2NyYXBlOyB4w7NhIHBhY2thZ2UtbG9jayBiYWNrZW5k'))
  }
  if ($Message -match 'feat: update backend and frontend') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('dMOtbmggbsSDbmc6IGPhuq1wIG5o4bqtdCBiYWNrZW5kIHbDoCBmcm9udGVuZA=='))
  }
  if ($Message -match 'Initial commit - current files') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('a2jhu59pIHThuqFvOiB0aMOqbSB0b8OgbiBi4buZIGNvZGUgYmFja2VuZCAmIGZyb250ZW5k'))
  }
  if ($Message -match 'Merge Quoc: keep current code as priority') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('aOG7o3AgbmjhuqV0OiBr4bq/dCBo4bujcCBuaMOhbmggUXVvYyBjxakgdsOgbyBwaGnDqm4gYuG6o24gaGnhu4duIHThuqFp'))
  }
  if ($Message -match 'docs: add detailed changelog of all updates') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('dMOgaSBsaeG7h3U6IGdoaSBjaMOpcCBjaGkgdGnhur90IGPDoWMgdMOtbmggbsSDbmcgxJHGsOG7o2MgY+G6rXAgbmjhuq10'))
  }
  if ($Message -match 'docs: add Branch & Team Collaboration guide with setup instructions') {
    return [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('dMOgaSBsaeG7h3U6IGjGsOG7m25nIGThuqtuIHPhu60gZOG7pW5nIG5ow6FuaCBRdW9jIGNobyB0ZWFt'))
  }

  return $null
}

if ($Mode -eq 'todo') {
  $lines = Get-Content $Path
  $updated = foreach ($line in $lines) {
    if ($line -match '^pick\s+') {
      $line -replace '^pick', 'reword'
    } elseif ($line -match '^merge\s+-C\s+') {
      $line -replace '^merge\s+-C', 'merge -c'
    } else {
      $line
    }
  }
  Set-Content -Path $Path -Value $updated
  exit 0
}

if ($Mode -eq 'message') {
  $msg = Get-Content $Path -Raw
  $replacement = Get-Replacement $msg

  if ($replacement) {
    Set-Content -Path $Path -Value $replacement -NoNewline
  }
}

if ($Mode -eq 'filter') {
  $msg = [Console]::In.ReadToEnd()
  $replacement = Get-Replacement $msg

  if ($replacement) {
    [Console]::Out.Write($replacement)
  } else {
    [Console]::Out.Write($msg)
  }
}
