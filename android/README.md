# Sencillo en Play Store (Trusted Web Activity)

La app de Play Store **es la misma PWA**, empaquetada con Bubblewrap como Trusted Web Activity (TWA).
No hay código nativo que mantener: cada `npm run build` desplegado en `app.sencillo.pe` actualiza la app instalada.

## Requisitos (una sola vez)
- Java 17 y Android SDK (Bubblewrap los descarga si no están).
- `npm i -g @bubblewrap/cli`
- La PWA publicada en HTTPS en el dominio de `twa-manifest.json` (`host`).
- Cuenta de Google Play Console (pago único de USD 25).

## Pasos
```bash
cd android
bubblewrap init --manifest https://app.sencillo.pe/manifest.webmanifest   # solo la primera vez; ya existe twa-manifest.json
bubblewrap build        # genera app-release-bundle.aab y app-release-signed.apk
```

1. Sube el `.aab` a Play Console (Producción o Prueba interna).
2. En Play Console → Configuración → Integridad de la app, copia la **huella SHA-256** del certificado de firma.
3. Pégala en `apps/web/public/.well-known/assetlinks.json` y vuelve a desplegar la PWA.
   Sin este paso la app abre con barra de navegador en vez de pantalla completa.
4. Prueba en un celular: `bubblewrap install`.

## Actualizar
- Cambios en la web: solo desplegar. La app se actualiza sola.
- Cambios de ícono, nombre o permisos: subir `appVersionCode` en `twa-manifest.json`, `bubblewrap update && bubblewrap build`, subir el nuevo `.aab`.

## Cuándo pasar a Capacitor
Solo si hace falta algo que el navegador Android no da: impresión Bluetooth a ticketera, lector de barras por hardware,
notificaciones push locales complejas. La estructura del proyecto ya lo permite (`apps/web` sigue siendo la fuente).
