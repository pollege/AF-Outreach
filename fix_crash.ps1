Write-Host "Inizio procedura di ripristino..." -ForegroundColor Cyan

# 1. Kill Node Processes
Write-Host "Chiusura processi Node.js..."
Stop-Process -Name "node" -ErrorAction SilentlyContinue

# 2. Add tailwind config file standard
Write-Host "Creazione tailwind.config.ts standard..."
Set-Content -Path "tailwind.config.ts" -Value 'import type { Config } from "tailwindcss"; export default { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: {}, }, plugins: [], } satisfies Config;'

# 3. Clean Install
Write-Host "Pulizia cartelle..."
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue

Write-Host "Reinstallazione pulita..."
npm install

Write-Host "Tutto pronto! Avvia con 'npm run dev'" -ForegroundColor Green
Write-Host "Premi INVIO per chiudere..."
Read-Host
