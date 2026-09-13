# 06 · Despliegue

## Un solo contenedor para todo

La imagen de `Dockerfile` sirve la PWA (`apps/web/dist`) y la API bajo `/api` desde el mismo origen.
Sin Postgres externo, la API usa **PGlite**, un Postgres embebido que guarda en `/app/data`.
Para una bodega, o para cien, alcanza con una máquina de 512 MB.

```bash
docker build -t kiosco-pe .
docker run -p 3000:3000 -v kiosco_datos:/app/data kiosco-pe
# → http://localhost:3000        la app
# → http://localhost:3000/api/salud
```

## Fly.io (recomendado para empezar)

```bash
fly launch --no-deploy          # usa fly.toml; crea la app
fly volumes create kiosco_datos --size 1 --region gru
fly deploy
fly certs add app.kiosco.pe     # HTTPS obligatorio para PWA y TWA
```

## Con Postgres administrado (Neon, Supabase, Railway)

Cuando haya miles de bodegas o se quiera panel web y reportes cruzados:

```bash
fly secrets set DATABASE_URL=postgres://...
fly deploy
```

Las migraciones se aplican solas al arrancar (`drizzle/*.sql`). Para generar una nueva tras cambiar `schema.ts`:

```bash
npm run db:generate -w @kiosco/api
```

## Variables de entorno

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DATABASE_URL` | vacío | Postgres externo. Si está vacío se usa PGlite. |
| `PGLITE_DIR` | `./data/kiosco` | Carpeta de datos de PGlite |
| `CORS_ORIGENES` | todos | Orígenes permitidos, separados por coma. En producción con la PWA servida por la API no hace falta. |
| `SERVIR_WEB` | `true` | Servir `apps/web/dist` desde la API |

## Frontend separado (opcional)

Si se prefiere la PWA en Cloudflare Pages o Netlify y la API aparte:

1. Compilar con `VITE_API_URL=https://api.kiosco.pe/api npm run build`.
2. Publicar `apps/web/dist`.
3. En la API, `CORS_ORIGENES=https://app.kiosco.pe` y `SERVIR_WEB=false`.

## Mantenimiento

```bash
npm run compactar -w @kiosco/api     # conserva el último cambio por registro y borra códigos vencidos
```
Programarlo una vez por noche (cron del hosting o `fly machine run`). Es seguro en caliente.

## Respaldo de la nube

Con PGlite: copiar la carpeta del volumen (`fly ssh console` → `tar` de `/app/data`). Con Postgres: el respaldo del proveedor.
El bodeguero, además, siempre puede exportar sus datos desde la app.

## Play Store

Ver `android/README.md`. Requiere la app publicada en HTTPS con su dominio definitivo.
