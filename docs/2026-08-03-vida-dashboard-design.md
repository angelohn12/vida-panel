# Vida Dashboard — Diseño

**Fecha:** 2026-08-03
**Autor:** Anyelo Hidalgo Brenes (con Claude)
**Estado:** Draft para aprobación
**Nombre de trabajo:** `ANYELO.OS` (nombre real por confirmar)

---

## 1. Propósito

Un dashboard personal privado — el "centro de vida" de Anyelo — que reúne en un solo lugar:

- Sus negocios (JORISU S.R.L., Avellana Studio) con datos en vivo de sus dashboards existentes.
- Su participación en negocios familiares donde no es socio directo (Corona 1, Vaskonia).
- Su formación universitaria (ULACIT — dos carreras en curso).
- Su búsqueda de empleo (posterior al despido de Arbolus el 27/07/2026).
- Un vault de documentos importantes (cédula, personería, contratos, CV, escrituras).

**Lo que este dashboard NO es:** una herramienta de ventas, un CRM, ni una app operativa. Para operar (registrar una venta, agregar un gasto) se abre el dashboard específico (Costa Piña, Avellana Studio). Este es el mapa unificado y el archivo de referencia.

## 2. Principios de diseño

1. **Todo en un vistazo** — la home muestra el estado de cada área de vida sin scroll ni clicks. Cada módulo es una tarjeta de su color.
2. **Vibra HUD/JARVIS + calidez editorial** — bento asimétrico multicolor sobre fondo oscuro, tipografía mono para datos, sans para títulos. Animaciones sutiles de entrada, contadores que suben, barras que se llenan. Nada chillón.
3. **Búsqueda global antes que navegación profunda** — `Ctrl+K` (o toque del ícono de lupa) abre un command palette que busca al mismo tiempo en negocios, proyectos, personas, documentos, cursos, contactos externos.
4. **Una sola verdad de datos** — no duplicamos información que ya vive en Costa Piña o Avellana Studio. El vida dashboard lee en vivo de esos Sheets vía sus endpoints existentes.
5. **Privacidad por diseño** — Cloudflare Access delante de todo; nada del contenido carga sin autenticación previa. El código no contiene contraseñas.

## 3. Arquitectura

### 3.1 Stack

| Capa | Tecnología | Razón |
|---|---|---|
| **Frontend** | Un solo `index.html` (vanilla HTML/CSS/JS) | Mismo patrón que Costa Piña / Avellana — sin build, editable directo |
| **Hosting** | Cloudflare Pages (repo GitHub privado o público protegido por CF Access) | Gratis, CDN global, integración nativa con Access |
| **Autenticación** | Cloudflare Access — email OTP | Gratis (hasta 50 usuarios), login real sin credenciales en el código |
| **Backend propio** | Google Apps Script + Google Sheet "Vida Master" | Igual patrón que los otros dashboards, ya probado |
| **Lecturas externas** | GET al endpoint `/exec` de Costa Piña y Avellana (`accion=leer`) | Datos en vivo, sin sincronizar ni duplicar |
| **PWA** | `manifest.webmanifest` + `apple-touch-icon.png` + meta tags iOS | Acceso directo desde pantalla de inicio del iPhone |

### 3.2 Diagrama de flujo

```
                     ┌──────────────────────────────┐
                     │  iPhone / Mac de Anyelo      │
                     │  https://vida.anyelo.cr      │
                     └──────────────┬───────────────┘
                                    │
                    Login OTP por email (Cloudflare)
                                    │
                     ┌──────────────▼───────────────┐
                     │  Cloudflare Pages            │
                     │  index.html + assets         │
                     └──────────────┬───────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                │                   │                   │
        ┌───────▼──────┐    ┌───────▼──────┐    ┌───────▼──────┐
        │ Vida Master  │    │ Costa Piña   │    │ Belleza      │
        │ (Sheet+GAS)  │    │ (existente)  │    │ (existente)  │
        │ escritura    │    │ solo lectura │    │ solo lectura │
        └──────────────┘    └──────────────┘    └──────────────┘
```

### 3.3 Estructura del Sheet "Vida Master"

Nuevo Google Sheet, dueño Anyelo, sin compartir. Hojas:

| Hoja | Contenido | Nota |
|---|---|---|
| `Perfil` | Datos personales (cédula, email, tel, dirección) | Solo lectura desde la UI en modo normal; edición requiere confirmación |
| `Negocios` | Filas: JORISU, Avellana, Corona1, Vaskonia, etc. Columnas: nombre, tipo (propio/familiar/inversión), rol, % participación, sociedad, estado, endpoint (URL del dashboard existente si aplica) | Fuente de verdad para el módulo "mis negocios" |
| `Organigrama` | Nodos y aristas para JORISU (socios, cargos, %) y proyectos con sus participantes | Renderiza el organigrama animado |
| `Estudios` | Carreras, cursos actuales, avance %, notas, semestre | ULACIT — 2 carreras |
| `Empleo` | Aplicaciones activas (empresa, puesto, fecha, estado, notas) | Post-Arbolus |
| `Vault` | Metadata de documentos: nombre, tipo, fecha, tags, drive_link, tamaño | Los archivos viven en el Sheet como adjuntos o en carpeta Drive específica |
| `Contactos` | Personas relevantes: JAXI (contador), notaria, BCR, Kenny, Kendall, Johan | Búsqueda global los indexa |
| `Actividad` | Log timestamped de qué se actualizó — alimenta la mini-gráfica "últimos 7 días" | Auto-generado por el backend en cada escritura |
| `Config` | Colores por módulo, permisos, versión | Igual patrón que Costa Piña |

### 3.4 Backend Apps Script (`Code.gs`)

Mismo patrón `ensureSetup()` + acciones que Avellana:

- `GET  ?accion=leer` — devuelve todas las hojas
- `POST accion=login` — valida usuario/clave (redundante con CF Access, defensa en profundidad)
- `POST accion=agregar_fila` — insertar fila en hoja
- `POST accion=editar_fila` — editar
- `POST accion=eliminar_fila` — borrar
- `POST accion=subir_documento` — sube archivo a Drive en carpeta "Vault Anyelo" y guarda link en hoja `Vault`
- `POST accion=leer_dashboard_externo` — proxy autenticado para leer los endpoints de Costa Piña / Avellana (evita CORS y oculta las URLs)

### 3.5 Integración con dashboards existentes (lectura en vivo)

- Al cargar cada módulo (JORISU, Avellana), el frontend llama `accion=leer_dashboard_externo` con `id=costa_pina` o `id=avellana`.
- El backend hace el `UrlFetchApp.fetch()` al endpoint real (URLs guardadas en `Config`, no en el frontend), y devuelve solo los campos necesarios (proyectos activos, ganancia proyectada, últimas ventas).
- **Los datos siguen viviendo en sus Sheets originales.** Este dashboard es solo un lector.

## 4. Módulos de la UI (home)

Bento asimétrico. Grid principal `2.2fr 1fr 1fr` con filas variables.

| Módulo | Tamaño | Color | Contenido |
|---|---|---|---|
| **JORISU (hero)** | Grande (2×2) | Teal | Sociedad, % Anyelo, proyectos activos, ganancia proyectada más próxima, barra de avance del ciclo, mini-gráfica de aportes/gastos, botón "Abrir Costa Piña ↗" |
| **Avellana Studio** | Chico | Rosa | Rol, estado, botón "Abrir Avellana ↗" |
| **ULACIT** | Chico | Azul | 2 carreras, cursos actuales, avance |
| **Empleo** | Chico | Ámbar | Nº aplicaciones activas, próxima entrevista |
| **Vault** | Chico | Púrpura | Nº documentos, últimos subidos |
| **Actividad 7 días** | Ancho (2 col) | Coral | Barras por día |
| **Buscador Ctrl+K** | Overlay | — | Command palette flotante |
| **Organigrama JORISU** | Página propia | Multi | SVG animado — socios, proyectos, inversionistas externos |

Cada módulo puede expandirse a página completa con `sendPrompt` o click; en la vista completa aparecen tablas, gráficos y formularios de edición.

## 5. Buscador global (Ctrl+K)

- Trigger: `Ctrl+K` (o `Cmd+K` en Mac), o botón lupa en la barra superior, o tap del ícono en móvil.
- Índice: se construye en cliente al cargar, unificando `Negocios`, `Organigrama`, `Estudios`, `Empleo`, `Vault`, `Contactos`.
- Resultados agrupados por categoría (persona, proyecto, documento, curso, etc.) con etiqueta de color según ramp.
- Match fuzzy (contiene, no exact) para escribir rápido en móvil.
- Enter en un resultado → navega al módulo/documento; Shift+Enter → abre en nueva pestaña (para links a Costa Piña / Avellana / documentos en Drive).

## 6. Organigrama animado (JORISU)

SVG interactivo. Al abrir la página:

1. Aparece el nodo raíz "INVERSIONES JORISU" (fade+scale).
2. Se dibujan líneas hacia los 3 socios (stroke-dasharray → dashoffset 0).
3. Aparecen los nodos de socios (Anyelo, Jonathan, Karla) con delay escalonado.
4. Se dibujan líneas hacia los proyectos (Corona 2, 3, 4, futuros).
5. Aparecen los nodos de proyectos, resaltando en color más fuerte los que tienen a Anyelo activo.
6. Kenny (inversionista externo) aparece aparte, conectado a Corona 3 con línea punteada ámbar (contractual, no societaria).

Cada nodo es clickeable: muestra popover con datos del socio o proyecto y links a la sección detallada.

## 7. Vault (documentos)

Requisito: **subir copias al mismo sistema** (no solo enlaces a Drive), confirmado por Anyelo.

- Al subir: el `POST accion=subir_documento` toma el archivo (base64), lo guarda en Drive en carpeta "Vault Anyelo" (permisos: solo el owner), y registra en la hoja `Vault`: nombre, tipo, fecha, tags, `drive_id`, tamaño.
- Al mostrar: la UI pide el link firmado temporalmente (Drive genera preview link con expiración corta) y lo abre inline en el dashboard o en una nueva pestaña.
- **Nunca se sirven los archivos desde el frontend directamente.** Van siempre via Apps Script con validación de sesión.
- Los archivos nunca están en el repo público de GitHub.

## 8. Seguridad

Este dashboard tiene la información más sensible de Anyelo. Capas:

| Capa | Qué protege | Cómo |
|---|---|---|
| **Cloudflare Access (frontera)** | Que nadie que no seas vos vea siquiera la pantalla | Login OTP por email; solo `angelohn12@gmail.com` autorizado (más los que agregues) |
| **Sin secretos en el repo público** | Que aunque alguien clone el código no pueda hablar con el backend | Endpoint del Apps Script y clave API se inyectan al build via variables de entorno de CF Pages (Functions/Middleware) y nunca aparecen en el `index.html` commitado. El frontend los recibe dinámicamente cuando el usuario ya pasó CF Access. |
| **Login secundario en el backend** | Defensa en profundidad si CF Access falla | El Apps Script sigue exigiendo `key` en cada request (igual que Avellana) |
| **Drive permisos nativos** | Los archivos del Vault no son accesibles por link directo | Solo el owner (Anyelo) puede leerlos; el backend genera links temporales |
| **Log de actividad** | Detectar acceso raro | Hoja `Actividad` guarda cada login y escritura con timestamp; alerta por email si hay login desde IP nueva |
| **HTTPS + HSTS** | Interceptación en red | Cloudflare lo da automático |

**Lo que NO hacemos** (a propósito): almacenar contraseñas de servicios externos (bancos, etc.), procesar pagos, permitir inicio de sesión sin OTP, exponer el endpoint del Sheet en el HTML.

## 9. PWA — acceso directo desde iPhone

Tres archivos + meta tags:

1. `manifest.webmanifest` — nombre corto ("Vida"), color de tema, ícono 512×512, `display: standalone`.
2. `apple-touch-icon.png` (180×180) — ícono redondeado para iOS.
3. Meta en el `<head>`:
   ```html
   <link rel="manifest" href="/manifest.webmanifest">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   <meta name="apple-mobile-web-app-capable" content="yes">
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
   <meta name="apple-mobile-web-app-title" content="Vida">
   ```

Anyelo abre la URL en Safari → Compartir → "Añadir a pantalla de inicio" → queda como app nativa.

**Mismo tratamiento para Costa Piña y Avellana Studio** (íconos propios: pieza verde piña, gotita coral avellana). Es un cambio de 4 líneas en cada `index.html` existente.

## 10. Deploy y actualizaciones

- **Repo:** `angelohn12/vida-panel` — **público** (decidido con Anyelo 03/08/2026 para no pagar GitHub Pro). Sin datos ni secretos en el código; endpoint del Apps Script y clave API viven en variables de entorno de Cloudflare Pages (no en el HTML commitado). El HTML público es solo la "cáscara": aunque alguien lo lea, no puede hablar con el backend porque no tiene las llaves ni pasa el login de CF Access.
- **Deploy:** push a `main` → Cloudflare Pages redespliega automático (no hace falta GitHub Desktop manual como en los otros).
- **Backend:** cambios en `Code.gs` se re-implementan manualmente en el editor de Apps Script (Anyelo, como con Avellana — yo no puedo tocar Apps Script directamente).
- **Formularios in-app** para agregar/editar contenido (curso, aplicación de empleo, documento, contacto). Sin necesidad de que yo edite nada.

## 11. Alcance intencionalmente fuera

- Salud/hábitos (Anyelo pidió excluirlo).
- Recordatorios/calendario propio (usa Google Calendar; el dashboard puede mostrar próximos eventos leyendo la API si se agrega más tarde).
- Chat/mensajería.
- Multi-usuario colaborativo (solo Anyelo, con posibilidad de agregar a Belén más adelante para vistas específicas).

## 12. Éxito

Se considera exitoso si:

1. Anyelo abre el ícono en el iPhone y en <3 segundos ve el estado de sus 3 negocios y sus estudios sin scroll.
2. Puede buscar "personería" o "kenny" y llegar al documento/dato en 1 tap.
3. Cuando actualiza algo en Costa Piña o Avellana, el vida dashboard lo refleja al recargar (sin sincronización manual).
4. Ningún dato del dashboard es visible sin login vía Cloudflare Access — verificable abriendo la URL en incógnito.
