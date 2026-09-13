// Corre las pruebas de navegador contra la API sirviendo la PWA compilada, con PGlite en memoria.
// Uso: npm run e2e   (requiere Chromium; indica CHROME_PATH si no está en el PATH de Playwright)
import { spawn } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { setTimeout as dormir } from 'node:timers/promises'

const puerto = 3001
const api = spawn('node', ['--experimental-strip-types', 'apps/api/src/index.ts'], {
  env: { ...process.env, PORT: String(puerto), PGLITE_DIR: 'memoria', SERVIR_WEB: 'true' },
  stdio: 'ignore',
})
try {
  for (let i = 0; i < 30; i++) {
    await dormir(1000)
    const ok = await fetch(`http://localhost:${puerto}/api/salud`).then((r) => r.ok).catch(() => false)
    if (ok) break
    if (i === 29) throw new Error('La API no arrancó')
  }
  const pruebas = readdirSync('apps/web/e2e').filter((f) => /^\d+-.*\.mjs$/.test(f)).sort()
  let fallos = 0
  for (const p of pruebas) {
    console.log(`\n▶ ${p}`)
    const codigo = await new Promise((res) => {
      const hijo = spawn('node', [`apps/web/e2e/${p}`], { stdio: 'inherit', env: { ...process.env, E2E_URL: `http://localhost:${puerto}` } })
      hijo.on('exit', res)
    })
    if (codigo !== 0) fallos++
  }
  console.log(fallos ? `\n✗ ${fallos} prueba(s) fallaron` : '\n✓ Todas las pruebas de navegador pasaron')
  process.exitCode = fallos ? 1 : 0
} finally {
  api.kill()
}
