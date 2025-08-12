# Chatbot del Pueblo — PWA Demo (offline-first)

Este es un _starter_ mínimo para una PWA que funcione **sin conexión** con un paquete de contenido local
(FAQ, eventos, artículos y contactos) y un **modo taller** con plantillas.

## Cómo probar en local (sin bundlers)

1. Sirve los archivos con un servidor estático (recomendado `npx serve .`).
2. Abre `http://localhost:3000` (o el puerto que indique) y acepta instalar el Service Worker.
3. En Android/Chrome verás el botón **Instalar app**; en iOS usa Safari → Compartir → “Añadir a pantalla de inicio”.
4. Abre `content/kb-pack.json` y edita el contenido. Sube `content/version.json` cambiando el campo `version` (p.ej. `2025.08.13-demo`) para que la app detecte la actualización.

## Despliegue

- **GitHub Pages / Netlify**: subir el contenido tal cual. Asegúrate de que la app esté en la raíz (o ajusta rutas del SW).
- Genera un **QR** al dominio final (p.ej., `https://tupueblo.netlify.app`) y compártelo días antes para que la gente precargue el contenido.

### Notas para GitHub Pages (subcarpeta)

- El `manifest.webmanifest` usa `start_url: "./"` y el SW detecta `/content/` aunque el sitio esté bajo `/usuario/repositorio/`.
- Si cambias el nombre del repo o mueves la carpeta, limpia caches desde el enlace “Borrar datos locales” o con recarga dura.

## Notas técnicas

- Caché App Shell y `content/` con estrategia _stale-while-revalidate_.
- Bot (sin IA): búsqueda por palabras clave en la base local, para garantizar uso **offline**.
- Botón **Buscar actualizaciones** comprueba `content/version.json` para avisar de nuevas versiones.
- Para limpiar almacenamiento: enlace _Borrar datos locales_ elimina caches y `localStorage`.

## Advertencias

- iOS necesita “Añadir a pantalla de inicio” manualmente (no hay prompt automático).
- La API de Background Sync no está disponible en todos los navegadores. Ten un botón **Intentar sincronizar** cuando haga falta.

## Problemas comunes

- Tras actualizar archivos, puede quedar una versión antigua en caché. Usa el enlace “Borrar datos locales” en el pie y recarga.
- Si `content/kb-pack.json` no aparece actualizado, comprueba `content/version.json` y pulsa “Buscar actualizaciones”.
