# Vida Dashboard — Plan de Implementación

> **Nota especial de contexto:** Este plan lo va a ejecutar Claude en sesiones futuras junto con Anyelo. Anyelo no programa, así que las tareas están redactadas para que Claude escriba el código y Anyelo solo tenga que hacer las acciones que Claude no puede hacer desde afuera (crear cuentas, pegar el `Code.gs` en Apps Script y redesplegar, autorizar apps de Google/Cloudflare, hacer push desde GitHub Desktop). Cada tarea marca claramente qué pasos son de Claude y cuáles son de Anyelo.

**Goal:** Construir "ANYELO.OS", el dashboard personal privado de Anyelo — centro de vida con negocios, estudios, empleo y vault de documentos — con login por email, integración en vivo con Costa Piña y Avellana Studio, y acceso directo desde iPhone.

**Architecture:** Un solo `index.html` vanilla servido por Cloudflare Pages, protegido por Cloudflare Access (login OTP por email). Los secretos (endpoint del Apps Script + clave API) viven en una Cloudflare Pages Function que hace de proxy. El backend propio es un Google Sheet "Vida Master" con Apps Script — mismo patrón que Costa Piña y Avellana. Los datos de esos dashboards se leen en vivo vía sus endpoints existentes, sin duplicación.

**Tech Stack:** HTML/CSS/JS vanilla · Google Sheets · Google Apps Script (V8) · Cloudflare Pages · Cloudflare Access · Cloudflare Pages Functions (JS) · Web App Manifest (PWA).

## Global Constraints

- **Idioma UI:** español, oración capital ("Mis negocios", no "MIS NEGOCIOS", no "Mis Negocios").
- **Sin secretos en el `index.html` commitado.** El endpoint del Apps Script (`WEB_APP_URL`) y la clave (`API_KEY`) viven solo en variables de entorno de Cloudflare Pages.
- **Un solo dueño:** `angelohn12@gmail.com` es el único email autorizado en Cloudflare Access al lanzar. Belén se agrega solo con confirmación explícita de Anyelo.
- **Sin dependencias externas de terceros más allá de:** Cloudflare (hosting + access), Google (Sheets + Apps Script + Drive), GitHub (repo). Nada de trackers, analytics, o CDNs de fuentes/librerías — todo self-contained en el HTML.
- **Estilo visual:** bento asimétrico + HUD multicolor sobre fondo `#0B0F14`. Paleta por módulo: JORISU teal (`#5DCAA5`), Avellana rosa (`#ED93B1`), ULACIT azul (`#85B7EB`), Empleo ámbar (`#EF9F27`), Vault púrpura (`#AFA9EC`), Actividad coral (`#F0997B`). Tipografía: sans para títulos, mono para datos técnicos.
- **Repo público** `angelohn12/vida-panel`. Público y sin secretos — se puede ver el código, no operar.
- **Cada `POST` al backend debe incluir la `key`.** El Apps Script rechaza sin ella (defensa en profundidad tras CF Access).
- **Cada acción de escritura queda registrada** en la hoja `Actividad` con timestamp, usuario y qué se cambió.

---

## Mapa de archivos

```
C:\Users\Angelo\Documents\GitHub\vida-panel\
├── docs\
│   ├── 2026-08-03-vida-dashboard-design.md    (spec — YA existe)
│   └── 2026-08-03-vida-dashboard-plan.md      (este plan)
├── index.html                                  (frontend completo, un archivo)
├── manifest.webmanifest                        (PWA)
├── apple-touch-icon.png                        (ícono iOS 180×180)
├── icon-192.png                                (ícono PWA 192×192)
├── icon-512.png                                (ícono PWA 512×512)
├── favicon.ico                                 (favicon browser tab)
├── Code.gs                                     (copia local del backend Apps Script)
└── functions\
    └── api\
        └── proxy.js                            (CF Pages Function — inyecta secretos, hace fetch al Apps Script)
```

Repo en GitHub: `angelohn12/vida-panel` (público). A diferencia de Costa Piña y Avellana (que tienen copia de trabajo en Downloads y copia publicada aparte), acá **hay una sola copia** en `C:\Users\Angelo\Documents\GitHub\vida-panel\` — es la que edita Claude y la misma que GitHub Desktop publica. Cloudflare Pages hace auto-deploy al hacer push, sin paso manual.

## Requisitos previos (una sola vez, antes de la Tarea 1)

Cosas que solo Anyelo puede hacer, una única vez:

1. **Crear cuenta Cloudflare** (gratis) en cloudflare.com con `angelohn12@gmail.com` si aún no tiene. Verificar el correo.
2. **Comprar o apuntar un dominio.** Opciones: (a) usar un subdominio de un dominio que ya tenga; (b) comprar uno nuevo en Cloudflare (~$10/año — dominio `.com` o `.cr`); (c) empezar sin dominio propio, usando el subdominio gratis `<nombre>.pages.dev` que da Cloudflare (perfectamente válido para iniciar). Claude sugiere (c) para empezar y migrar a dominio propio después si se quiere.
3. **Confirmar acceso a GitHub Desktop** y que puede publicar repos (ya sabe hacerlo con Costa Piña y Avellana).

---

### Task 1: Google Sheet "Vida Master" + backend Apps Script inicial

**Files:**
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\Code.gs` (copia local del backend — la fuente de verdad está en Apps Script, esta es la referencia editable)

**Interfaces:**
- Consumes: nada (primera tarea).
- Produces:
  - Un Sheet "Vida Master" con 9 hojas creadas (Perfil, Negocios, Organigrama, Estudios, Empleo, Vault, Contactos, Actividad, Config).
  - Un Apps Script Web App con URL `/exec` que responde a:
    - `GET  ?accion=leer&key=<clave>` → `{ok:true, perfil, negocios, organigrama, estudios, empleo, vault, contactos, actividad, config}`
    - `POST accion=agregar_fila` → `{ok:true, id}`
    - `POST accion=editar_fila` → `{ok:true}`
    - `POST accion=eliminar_fila` → `{ok:true}`
    - `POST accion=subir_documento` → `{ok:true, drive_id, drive_link}`
    - `POST accion=leer_dashboard_externo` con `id ∈ {costa_pina, avellana}` → devuelve JSON crudo del dashboard externo
  - Clave API compartida (`VIDA_KEY_2026!`) que se usará también en la Tarea 3 (proxy).
  - Nombre corto para referirse a la URL: `WEB_APP_URL_VIDA`.

- [ ] **Step 1 (Anyelo): Crear el Sheet vacío**
  - Ir a drive.google.com → Nuevo → Hoja de cálculo de Google → renombrar a `Vida Master`.
  - Copiar el ID del Sheet de la URL (la parte entre `/d/` y `/edit`) y compartirlo con Claude en el chat.

- [ ] **Step 2 (Claude): Escribir `Code.gs` completo**
  - Crear `C:\Users\Angelo\Documents\GitHub\vida-panel\Code.gs` con el contenido siguiente. Reemplazar `PONER_ID_DEL_SHEET_AQUI` con el ID real que dio Anyelo en el Step 1.
  - El script incluye `ensureSetup()` que auto-crea las 9 hojas + encabezados + fila inicial de `Config` en el primer request (mismo patrón que Avellana Studio para no tener que poblar el Sheet a mano).

```javascript
const SHEET_ID = 'PONER_ID_DEL_SHEET_AQUI';
const CLAVE = 'VIDA_KEY_2026!';

const HOJAS = {
  Perfil:      ['campo','valor','actualizado'],
  Negocios:    ['id','nombre','tipo','rol','participacion','sociedad','estado','endpoint','color','notas'],
  Organigrama: ['id','tipo','nombre','padre_id','participacion','notas'],
  Estudios:    ['id','carrera','curso','avance','semestre','estado','notas'],
  Empleo:      ['id','empresa','puesto','fecha_aplicacion','estado','fuente','notas'],
  Vault:       ['id','nombre','tipo','fecha','tags','drive_id','drive_link','tamano_kb'],
  Contactos:   ['id','nombre','organizacion','rol','email','telefono','notas'],
  Actividad:   ['timestamp','usuario','accion','hoja','detalle'],
  Config:      ['clave','valor']
};

function ensureSetup() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  Object.keys(HOJAS).forEach(nombre => {
    let hoja = ss.getSheetByName(nombre);
    if (!hoja) {
      hoja = ss.insertSheet(nombre);
      hoja.appendRow(HOJAS[nombre]);
    }
  });
  const cfg = ss.getSheetByName('Config');
  if (cfg.getLastRow() < 2) {
    cfg.appendRow(['costa_pina_url','https://script.google.com/macros/s/AKfycbwXcifOIRXjC3AHXnSNCQUfX6qveSUh_PXnWQbEuBiC3Y80eEb10Ulu7-b5FiSckpNg/exec']);
    cfg.appendRow(['costa_pina_key','Jorisu123@']);
    cfg.appendRow(['avellana_url','https://script.google.com/macros/s/AKfycbxQVdDsH_Qgg9MnRgb0rDyzYPkvRESEi2FGD-ENHeT9L7CMbZl_xTaVxDs0wfNe3tflMg/exec']);
    cfg.appendRow(['avellana_key','Belleza2026!']);
    cfg.appendRow(['vault_folder_id','']);
  }
}

function doGet(e) {
  ensureSetup();
  if (!e.parameter || e.parameter.key !== CLAVE) return json({ok:false,error:'unauthorized'});
  if (e.parameter.accion === 'leer') return json({ok:true, ...leerTodo()});
  return json({ok:false,error:'accion desconocida'});
}

function doPost(e) {
  ensureSetup();
  const body = JSON.parse(e.postData.contents);
  if (body.key !== CLAVE) return json({ok:false,error:'unauthorized'});
  try {
    switch(body.accion) {
      case 'agregar_fila':           return json({ok:true, id: agregarFila(body.hoja, body.datos)});
      case 'editar_fila':            editarFila(body.hoja, body.id, body.datos); return json({ok:true});
      case 'eliminar_fila':          eliminarFila(body.hoja, body.id); return json({ok:true});
      case 'subir_documento':        return json({ok:true, ...subirDocumento(body.datos)});
      case 'leer_dashboard_externo': return json({ok:true, data: leerExterno(body.id)});
    }
    return json({ok:false,error:'accion desconocida'});
  } catch(err) {
    return json({ok:false,error:String(err)});
  }
}

function leerTodo() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const res = {};
  Object.keys(HOJAS).forEach(nombre => {
    const hoja = ss.getSheetByName(nombre);
    const filas = hoja.getDataRange().getValues();
    const cab = filas.shift();
    res[nombre.toLowerCase()] = filas.map(f => Object.fromEntries(cab.map((c,i) => [c, f[i]])));
  });
  return res;
}

function siguienteId(hoja) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja);
  if (h.getLastRow() < 2) return 1;
  const ids = h.getRange(2,1,h.getLastRow()-1,1).getValues().flat().filter(x=>!isNaN(x));
  return ids.length ? Math.max(...ids)+1 : 1;
}

function agregarFila(hoja, datos) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja);
  const cab = HOJAS[hoja];
  const id = siguienteId(hoja);
  const fila = cab.map(c => c==='id' ? id : (datos[c] ?? ''));
  h.appendRow(fila);
  registrarActividad('agregar_fila', hoja, JSON.stringify(datos));
  return id;
}

function editarFila(hoja, id, datos) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja);
  const cab = HOJAS[hoja];
  const filas = h.getDataRange().getValues();
  for (let i=1; i<filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      const nueva = cab.map((c,idx) => c==='id' ? id : (datos[c] !== undefined ? datos[c] : filas[i][idx]));
      h.getRange(i+1,1,1,cab.length).setValues([nueva]);
      registrarActividad('editar_fila', hoja, JSON.stringify(datos));
      return;
    }
  }
  throw new Error('id no encontrado');
}

function eliminarFila(hoja, id) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja);
  const filas = h.getDataRange().getValues();
  for (let i=1; i<filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      h.deleteRow(i+1);
      registrarActividad('eliminar_fila', hoja, `id ${id}`);
      return;
    }
  }
  throw new Error('id no encontrado');
}

function subirDocumento(datos) {
  const cfg = leerConfig();
  let folderId = cfg.vault_folder_id;
  if (!folderId) {
    const f = DriveApp.createFolder('Vault Anyelo');
    folderId = f.getId();
    setConfig('vault_folder_id', folderId);
  }
  const carpeta = DriveApp.getFolderById(folderId);
  const blob = Utilities.newBlob(Utilities.base64Decode(datos.base64), datos.mime, datos.nombre);
  const archivo = carpeta.createFile(blob);
  const id = agregarFila('Vault', {
    nombre: datos.nombre,
    tipo: datos.tipo,
    fecha: new Date().toISOString().slice(0,10),
    tags: datos.tags || '',
    drive_id: archivo.getId(),
    drive_link: archivo.getUrl(),
    tamano_kb: Math.round(blob.getBytes().length/1024)
  });
  return { id, drive_id: archivo.getId(), drive_link: archivo.getUrl() };
}

function leerExterno(id) {
  const cfg = leerConfig();
  const url = cfg[id+'_url'];
  const key = cfg[id+'_key'];
  if (!url) throw new Error('id externo desconocido: '+id);
  const resp = UrlFetchApp.fetch(url+'?accion=leer&key='+encodeURIComponent(key), {muteHttpExceptions:true, followRedirects:true});
  return JSON.parse(resp.getContentText());
}

function leerConfig() {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Config');
  const filas = h.getDataRange().getValues();
  filas.shift();
  return Object.fromEntries(filas.map(f => [f[0], f[1]]));
}

function setConfig(clave, valor) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Config');
  const filas = h.getDataRange().getValues();
  for (let i=1; i<filas.length; i++) if (filas[i][0]===clave) { h.getRange(i+1,2).setValue(valor); return; }
  h.appendRow([clave, valor]);
}

function registrarActividad(accion, hoja, detalle) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Actividad');
  h.appendRow([new Date().toISOString(), Session.getActiveUser().getEmail() || 'system', accion, hoja, detalle]);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 3 (Anyelo): Pegar `Code.gs` en Apps Script y desplegar**
  - Con el Sheet abierto: menú Extensiones → Apps Script.
  - Borrar el `myFunction()` de ejemplo, pegar todo el contenido del `Code.gs` del Step 2.
  - Guardar (💾) — nombre del proyecto: `Vida Master`.
  - Botón "Implementar" (arriba a la derecha) → Nueva implementación → Tipo: **Aplicación web**.
    - Descripción: `v1`
    - Ejecutar como: **Yo (angelohn12@gmail.com)**
    - Quién tiene acceso: **Cualquiera** (necesario para que responda a llamadas HTTP; la seguridad la da la `key`).
  - Implementar → autorizar la app cuando pida permisos (advertirá "sin verificar", clic en "Configuración avanzada" → "Ir a Vida Master (no seguro)" → Permitir).
  - Copiar la URL `/exec` resultante y pasarla a Claude.

- [ ] **Step 4 (Claude): Verificar que responde**
  - Ejecutar: `curl -s -L "<URL /exec>?accion=leer&key=VIDA_KEY_2026%21"`
  - Esperado: JSON con `ok:true` y las 9 secciones (todas vacías excepto `config`). Confirma que `ensureSetup()` creó las hojas.
  - Verificar en el Sheet que las 9 pestañas aparecieron con sus encabezados.

- [ ] **Step 5 (Claude): Guardar la URL en memoria** (`.claude/projects/.../memory/vida_dashboard.md`) para referencia futura. Commit no aplica todavía porque el repo aún no existe (se crea en Task 2).

---

### Task 2: Cascarón HTML + PWA + Cloudflare Pages + Cloudflare Access

**Files:**
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (cascarón mínimo — barra superior, mensaje "Cargando…", meta tags PWA)
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\manifest.webmanifest`
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\apple-touch-icon.png` (generado)
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\icon-192.png` (generado)
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\icon-512.png` (generado)
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\favicon.ico` (generado)
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\.gitignore` (excluir `.claude/`, `*.local.*`)
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\README.md` (breve — qué es, quién, no operar sin permiso)

**Interfaces:**
- Consumes: nada específico de Task 1 (el frontend aún no llama al backend).
- Produces:
  - URL viva `<algo>.pages.dev` protegida por CF Access — al abrirla en incógnito pide OTP a `angelohn12@gmail.com`.
  - Ícono en la pantalla de inicio del iPhone de Anyelo cuando use "Añadir a pantalla de inicio".

- [ ] **Step 1 (Claude): Escribir `index.html` cascarón**
  - Un solo archivo HTML, `<head>` con todos los meta PWA y iOS, `<body>` con la barra superior HUD (reloj vivo + pulso + label "ANYELO.OS") y un div central `#app` con texto "Cargando…". Sin lógica de backend todavía.
  - Meta tags incluidos:
    ```html
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="icon" href="/favicon.ico">
    <meta name="theme-color" content="#0B0F14">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="Vida">
    <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
    ```

- [ ] **Step 2 (Claude): Escribir `manifest.webmanifest`**
  ```json
  {
    "name": "ANYELO.OS",
    "short_name": "Vida",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0B0F14",
    "theme_color": "#0B0F14",
    "icons": [
      { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
      { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
  }
  ```

- [ ] **Step 3 (Claude): Generar los 4 íconos**
  - Escribir un pequeño script Python (o usar ImageMagick si está disponible en la máquina) para generar los 4 archivos PNG/ICO con el logo del proyecto: fondo `#0B0F14`, en el centro las iniciales `A.OS` en verde teal `#5DCAA5` tipografía mono.
  - Colocar los archivos en `C:\Users\Angelo\Documents\GitHub\vida-panel\`.
  - Verificar dimensiones: `file *.png *.ico`.

- [ ] **Step 4 (Claude): Escribir `.gitignore` y `README.md`**
  - `.gitignore`:
    ```
    .DS_Store
    Thumbs.db
    .claude/
    *.local.*
    node_modules/
    ```
  - `README.md`:
    ```markdown
    # vida-panel

    Dashboard personal privado de Anyelo Hidalgo. Protegido por Cloudflare Access — sin login autorizado no responde.

    Este repo es público. No contiene datos, credenciales, ni endpoints operativos.
    ```

- [ ] **Step 5 (Anyelo): Crear repo GitHub y publicar con GitHub Desktop**
  - Abrir GitHub Desktop → File → Add local repository → seleccionar `C:\Users\Angelo\Documents\GitHub\vida-panel\`.
  - Publish repository → nombre `vida-panel` → **desmarcar** "Keep this code private" → Publish.
  - Verificar que aparezca en https://github.com/angelohn12/vida-panel

- [ ] **Step 6 (Anyelo): Conectar el repo a Cloudflare Pages**
  - Ir a dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git.
  - Autorizar GitHub, elegir el repo `vida-panel`.
  - Build settings: framework preset **None**, build command **vacío**, output directory `/` (raíz — es HTML estático).
  - Save and Deploy.
  - Esperar 1-2 minutos, copiar la URL `<algo>.pages.dev` (ej. `vida-panel-abc.pages.dev`) y pasarla a Claude.

- [ ] **Step 7 (Anyelo): Activar Cloudflare Access**
  - En dash.cloudflare.com → Zero Trust → Access → Applications → Add an application → Self-hosted.
  - Application name: `Vida Anyelo`, Session duration: 24 horas, Application domain: la URL de Pages del Step 6.
  - Identity providers: dejar "One-time PIN" activado (envía código al correo).
  - Policies → Add policy → Name: `Solo Anyelo`, Action: Allow, Include: **Emails** → `angelohn12@gmail.com`.
  - Save application.

- [ ] **Step 8 (Anyelo + Claude): Verificar login**
  - Anyelo abre la URL de Pages en incógnito → debe pedir email → mete `angelohn12@gmail.com` → llega código al correo → mete el código → ve la página con "Cargando…".
  - En otro incógnito, prueba con otro correo (`ejemplo@test.com`) → debe bloquear.
  - Claude verifica con `curl -I <URL>` que la respuesta es un redirect a Cloudflare Access (no HTTP 200 directo).

- [ ] **Step 9 (Anyelo, iPhone): Agregar a pantalla de inicio y verificar ícono**
  - Abrir la URL en Safari → autenticar con OTP.
  - Botón Compartir → "Añadir a pantalla de inicio" → confirmar nombre "Vida".
  - Verificar que el ícono aparece redondeado con las iniciales, y que al tocarlo abre en pantalla completa (sin barra Safari).

- [ ] **Step 10 (Anyelo): Push inicial**
  - En GitHub Desktop: commit "chore: cascarón inicial + PWA" → Push origin.
  - Verificar en Cloudflare Pages que dispara un redespliegue automático.

---

### Task 3: Cloudflare Pages Function proxy — inyectar secretos

**Files:**
- Create: `C:\Users\Angelo\Documents\GitHub\vida-panel\functions\api\proxy.js`

**Interfaces:**
- Consumes: `WEB_APP_URL_VIDA` y `VIDA_KEY_2026!` como variables de entorno de Cloudflare Pages.
- Produces:
  - Endpoint `/api/proxy` que acepta `GET` y `POST` desde el frontend.
  - Sirve como intermediario: el frontend nunca ve la URL del Apps Script ni la clave. Le pega a `/api/proxy?accion=...` (o POST) y el proxy re-lanza al Apps Script agregando la clave.
  - Formato de request desde el frontend: mismos parámetros que iría al Apps Script, sin `key`.
  - Formato de response: el JSON crudo que devuelve el Apps Script.

- [ ] **Step 1 (Claude): Escribir la Function**
  ```javascript
  export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const upstream = new URL(env.WEB_APP_URL_VIDA);

    if (request.method === 'GET') {
      url.searchParams.forEach((v,k) => upstream.searchParams.set(k,v));
      upstream.searchParams.set('key', env.VIDA_KEY);
      const r = await fetch(upstream.toString(), { redirect: 'follow' });
      return new Response(await r.text(), { status: r.status, headers: {'content-type':'application/json'} });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      body.key = env.VIDA_KEY;
      const r = await fetch(upstream.toString(), {
        method: 'POST',
        headers: {'content-type':'application/json'},
        body: JSON.stringify(body),
        redirect: 'follow'
      });
      return new Response(await r.text(), { status: r.status, headers: {'content-type':'application/json'} });
    }

    return new Response('method not allowed', { status: 405 });
  }
  ```

- [ ] **Step 2 (Anyelo): Configurar variables de entorno en CF Pages**
  - dash.cloudflare.com → Workers & Pages → `vida-panel` → Settings → Environment variables → Production.
  - Add variable:
    - `WEB_APP_URL_VIDA` = URL del Apps Script del Task 1 Step 3 (termina en `/exec`)
    - `VIDA_KEY` = `VIDA_KEY_2026!`
  - Save. Redesplegar (Deployments → último deployment → Retry deployment).

- [ ] **Step 3 (Anyelo + Claude): Verificar el proxy**
  - Anyelo abre `<URL>.pages.dev/api/proxy?accion=leer` en el navegador (ya está logueado por CF Access).
  - Debe devolver el JSON del Apps Script (mismo que el `curl` directo del Task 1 Step 4).
  - Claude verifica: `curl <URL>.pages.dev/api/proxy?accion=leer` → debe fallar con redirect a CF Access (no responde sin login). ✓ prueba que solo Anyelo puede llamarlo.

- [ ] **Step 4 (Claude + Anyelo): Commit y push**
  - Claude commit local; Anyelo push desde GitHub Desktop con mensaje: `feat: proxy CF Function inyecta secretos del backend`.

---

### Task 4: Home con módulos base (bento HUD + reloj vivo + animaciones de entrada)

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (reemplaza el "Cargando…" del cascarón con la grilla real)

**Interfaces:**
- Consumes: `GET /api/proxy?accion=leer` del Task 3.
- Produces:
  - Función global JS `App.data` con el JSON completo del backend cargado en memoria.
  - Función `App.render()` que dibuja los 6 módulos: JORISU (hero), Avellana, ULACIT, Empleo, Vault, Actividad. Todos con datos placeholder ("cargando…" o el dato real si ya está en el Sheet).
  - Barra superior con reloj vivo (`setInterval` cada segundo, formato `DD.MM.YYYY · HH:MM:SS`), pulso animado, estado `SEC · CF-ACCESS ●`.
  - Animaciones de entrada: cada módulo aparece con delay escalonado (`@keyframes fi`), contadores animados, barras que se llenan.
  - Nombres de funciones expuestas para tareas siguientes: `App.data`, `App.render()`, `App.recargar()`, `App.abrirModulo(nombre)`, `App.mostrarError(msg)`.

- [ ] **Step 1 (Claude): Escribir el CSS del sistema visual**
  - Reemplazar la sección `<style>` del cascarón con: reset, tipografía sans (system-ui/Inter) + mono (SFMono, Consolas), grid del fondo (`background-image` con líneas de 24×24), keyframes de las animaciones (`fi`, `fh`, `fb`, `cu`, `pl`, `rot`), clases de los módulos (`.mod`, `.mod-hero`, `.mod-lbl`, `.mod-title`, `.mod-sub`, `.big-num`, `.pb`, `.chart-bars`), variantes de color por módulo (`.c-teal`, `.c-pink`, `.c-blue`, `.c-amber`, `.c-purple`, `.c-coral`) copiadas del mockup Stark multicolor aprobado.

- [ ] **Step 2 (Claude): Escribir el HTML del layout**
  - Reemplazar el div "Cargando…" con:
    - Barra superior HUD con pulso, label, y `<span id="clock"></span>`.
    - Div `#app` con `class="grid"` con 6 divs `.mod` (uno por módulo), cada uno con su clase de color y `data-modulo="jorisu|avellana|ulacit|empleo|vault|actividad"`.
    - Footer HUD con `MÓDULOS · UPLINK · SEC`.

- [ ] **Step 3 (Claude): Escribir el JS base**
  - Objeto global `App` con métodos:
    ```javascript
    const App = {
      data: null,
      async cargar() {
        const r = await fetch('/api/proxy?accion=leer');
        const j = await r.json();
        if (!j.ok) return this.mostrarError(j.error || 'error de carga');
        this.data = j;
        this.render();
      },
      render() {
        this.renderReloj();
        this.renderJorisu();
        this.renderAvellana();
        this.renderUlacit();
        this.renderEmpleo();
        this.renderVault();
        this.renderActividad();
      },
      renderReloj() {
        const el = document.getElementById('clock');
        const tick = () => {
          const d = new Date(), p = n => String(n).padStart(2,'0');
          el.textContent = `${p(d.getDate())}.${p(d.getMonth()+1)}.${d.getFullYear()} · ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
        };
        tick(); setInterval(tick, 1000);
      },
      // placeholders — se llenan en Tasks 5-10
      renderJorisu()   { document.querySelector('[data-modulo=jorisu]').innerHTML   = '<div class="mod-lbl">JORISU</div><div class="mod-title">cargando…</div>'; },
      renderAvellana() { document.querySelector('[data-modulo=avellana]').innerHTML = '<div class="mod-lbl">AVELLANA</div><div class="mod-title">cargando…</div>'; },
      renderUlacit()   { document.querySelector('[data-modulo=ulacit]').innerHTML   = '<div class="mod-lbl">ULACIT</div><div class="mod-title">cargando…</div>'; },
      renderEmpleo()   { document.querySelector('[data-modulo=empleo]').innerHTML   = '<div class="mod-lbl">EMPLEO</div><div class="mod-title">cargando…</div>'; },
      renderVault()    { document.querySelector('[data-modulo=vault]').innerHTML    = '<div class="mod-lbl">VAULT</div><div class="mod-title">cargando…</div>'; },
      renderActividad(){ document.querySelector('[data-modulo=actividad]').innerHTML= '<div class="mod-lbl">ACTIVIDAD</div><div class="mod-title">cargando…</div>'; },
      recargar() { return this.cargar(); },
      abrirModulo(nombre) { /* implementado en Task 11 (nav) */ },
      mostrarError(msg) {
        document.getElementById('app').innerHTML = `<div style="padding:2rem;color:#F09595">Error: ${msg}</div>`;
      }
    };
    window.addEventListener('DOMContentLoaded', () => App.cargar());
    ```

- [ ] **Step 4 (Claude + Anyelo): Verificar en desktop**
  - Push (Anyelo GitHub Desktop), esperar redespliegue de Pages.
  - Abrir la URL: debe cargarse el grid con 6 módulos placeholder, el reloj vivo funcionando, y animaciones de entrada escalonadas.
  - Verificar en DevTools → Network que el request a `/api/proxy?accion=leer` devuelve 200 y JSON válido.
  - Verificar en móvil que el grid se ve bien (probablemente necesita `grid-template-columns` responsive con `@media (max-width: 640px)` → 1 columna).

- [ ] **Step 5 (Claude): Ajustar responsive si hace falta**
  - Si en móvil se ve apretado, agregar:
    ```css
    @media (max-width: 640px) {
      .grid { grid-template-columns: 1fr; }
      .mod-hero { grid-column: auto; grid-row: auto; }
    }
    ```

- [ ] **Step 6 (Anyelo): Commit y push**
  - Mensaje: `feat: home HUD con 6 módulos placeholder y reloj vivo`.

---

### Task 5: Módulo JORISU (hero) con datos en vivo de Costa Piña

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (reemplazar `renderJorisu()` placeholder)

**Interfaces:**
- Consumes: `App.data.negocios` (fila donde `nombre='JORISU S.R.L.'`), y llamada `POST /api/proxy` con `{accion:'leer_dashboard_externo', id:'costa_pina'}`.
- Produces: `App.datosCostaPina` — cache de la última respuesta del proxy externo (para no re-fetchear en cada render).

- [ ] **Step 1 (Claude): Agregar la fila JORISU al Sheet vía backend**
  - Usar el proxy: `POST /api/proxy` con `{accion:'agregar_fila', hoja:'Negocios', datos:{nombre:'JORISU S.R.L.', tipo:'propio', rol:'Gerente + cuotista', participacion:'50%', sociedad:'JORISU S.R.L.', estado:'activo', endpoint:'https://angelohn12.github.io/finca-panel/', color:'teal', notas:'Sociedad principal — Corona 2, 3, 4'}}`.
  - Verificar en el Sheet que la fila apareció.

- [ ] **Step 2 (Claude): Escribir la función `renderJorisu()` real**
  ```javascript
  async renderJorisu() {
    const el = document.querySelector('[data-modulo=jorisu]');
    const negocio = (this.data.negocios || []).find(n => n.nombre === 'JORISU S.R.L.');
    if (!negocio) { el.innerHTML = '<div class="mod-lbl">JORISU</div><div class="mod-title">no configurado</div>'; return; }

    el.innerHTML = `
      <div class="mod-lbl">MÓDULO PRIMARIO</div>
      <div class="mod-title">${negocio.nombre}</div>
      <div class="mod-sub">${negocio.rol} · ${negocio.participacion}</div>
      <div id="jorisu-live" class="mod-sub" style="margin-top:12px;opacity:0.7">Cargando datos en vivo…</div>
      <div style="margin-top:12px"><a href="${negocio.endpoint}" target="_blank" class="btn-abrir">Abrir Costa Piña ↗</a></div>
    `;

    try {
      const r = await fetch('/api/proxy', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({accion:'leer_dashboard_externo', id:'costa_pina'})});
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      this.datosCostaPina = j.data;
      const proyectos = j.data.proyectos || [];
      const activos = proyectos.filter(p => p.estado !== 'cerrado').length;
      document.getElementById('jorisu-live').innerHTML = `${activos} proyectos activos · ${proyectos.length} en total`;
    } catch(e) {
      document.getElementById('jorisu-live').textContent = 'no se pudo leer Costa Piña';
    }
  }
  ```

- [ ] **Step 3 (Claude): Agregar CSS para el botón "Abrir Costa Piña"**
  ```css
  .btn-abrir { display:inline-block; padding:6px 12px; border:1px solid #5DCAA5; color:#5DCAA5; text-decoration:none; border-radius:6px; font-family:var(--font-mono); font-size:11px; letter-spacing:1px; }
  .btn-abrir:hover { background:#0E1F1D; }
  ```

- [ ] **Step 4 (Claude + Anyelo): Verificar**
  - Push, abrir la URL, ver que el módulo JORISU muestra el nombre, rol, y en unos segundos aparece "X proyectos activos" leído en vivo del dashboard Costa Piña.
  - Verificar que el botón "Abrir Costa Piña ↗" lleva al dashboard existente.

- [ ] **Step 5 (Anyelo): Commit y push**
  - Mensaje: `feat: módulo JORISU con lectura en vivo de Costa Piña`.

---

### Task 6: Módulo Avellana Studio con datos en vivo

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (reemplazar `renderAvellana()` placeholder)

**Interfaces:**
- Consumes: `App.data.negocios` (fila con `nombre='Avellana Studio'`), y `POST /api/proxy` con `{accion:'leer_dashboard_externo', id:'avellana'}`.
- Produces: `App.datosAvellana` cache.

- [ ] **Step 1 (Claude): Agregar la fila Avellana al Sheet**
  - `POST /api/proxy` con `{accion:'agregar_fila', hoja:'Negocios', datos:{nombre:'Avellana Studio', tipo:'propio', rol:'Co-fundador', participacion:'50%', sociedad:'—', estado:'activo', endpoint:'https://angelohn12.github.io/belleza-panel/', color:'pink', notas:'Negocio con Belén — maquillaje online'}}`.

- [ ] **Step 2 (Claude): Escribir `renderAvellana()`**
  ```javascript
  async renderAvellana() {
    const el = document.querySelector('[data-modulo=avellana]');
    const negocio = (this.data.negocios || []).find(n => n.nombre === 'Avellana Studio');
    if (!negocio) { el.innerHTML = '<div class="mod-lbl">AVELLANA</div><div class="mod-title">no configurado</div>'; return; }
    el.innerHTML = `
      <div class="mod-lbl">AVELLANA</div>
      <div class="mod-title">Studio</div>
      <div class="mod-sub">${negocio.participacion} · en vivo</div>
      <div id="avellana-live" class="mod-sub" style="margin-top:8px;opacity:0.7;font-size:10px">cargando…</div>
    `;
    try {
      const r = await fetch('/api/proxy', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({accion:'leer_dashboard_externo', id:'avellana'})});
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      this.datosAvellana = j.data;
      const productos = (j.data.productos || []).length;
      const ventas = (j.data.ventas || []).length;
      document.getElementById('avellana-live').textContent = `${productos} productos · ${ventas} ventas`;
    } catch(e) {
      document.getElementById('avellana-live').textContent = 'sin conexión';
    }
  }
  ```

- [ ] **Step 3 (Claude + Anyelo): Verificar + commit**
  - Push, verificar que el módulo muestra productos/ventas en vivo.
  - Mensaje: `feat: módulo Avellana con lectura en vivo`.

---

### Task 7: Módulo ULACIT + formulario para carreras/cursos

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (`renderUlacit()` + panel modal `#modal-ulacit`)

**Interfaces:**
- Consumes: `App.data.estudios` (todas las filas de la hoja `Estudios`).
- Produces:
  - Módulo home muestra: nº carreras, nº cursos activos, avance promedio.
  - Click en el módulo abre modal con listado editable de cursos.
  - Método `App.guardarCurso(datos)` que llama `POST /api/proxy` con `agregar_fila` o `editar_fila`.
  - Método `App.cerrarModal()` reutilizable en tasks siguientes.

- [ ] **Step 1 (Claude): Escribir `renderUlacit()` con datos agregados**
  ```javascript
  renderUlacit() {
    const el = document.querySelector('[data-modulo=ulacit]');
    const estudios = this.data.estudios || [];
    const carreras = [...new Set(estudios.map(e => e.carrera))].filter(Boolean);
    const activos = estudios.filter(e => e.estado === 'en curso').length;
    const avance = estudios.length ? Math.round(estudios.reduce((s,e) => s + (Number(e.avance)||0), 0) / estudios.length) : 0;
    el.innerHTML = `
      <div class="mod-lbl">ULACIT</div>
      <div class="mod-title">${carreras.length} carrera${carreras.length===1?'':'s'}</div>
      <div class="mod-sub">${activos} cursos activos · ${avance}% avance</div>
    `;
    el.style.cursor = 'pointer';
    el.onclick = () => this.abrirModalUlacit();
  }
  ```

- [ ] **Step 2 (Claude): Escribir el modal genérico y la variante ULACIT**
  - Agregar al HTML: `<div id="modal-backdrop"></div>`.
  - Agregar CSS para el modal (fondo semitransparente, panel centrado, animación de entrada).
  - Función `App.cerrarModal()` que limpia `#modal-backdrop`.
  - Función `App.abrirModalUlacit()` que renderiza:
    - Título "Universidad — ULACIT"
    - Tabla con los cursos actuales (`estudios` filtrados por `estado='en curso'`), cada fila con carrera, nombre del curso, semestre, avance con barra, notas.
    - Botón "Agregar curso" que abre subformulario.
    - Cada fila con lápiz para editar y × para eliminar (llaman `App.guardarCurso` y `App.eliminarCurso`).

- [ ] **Step 3 (Claude): Implementar `guardarCurso` y `eliminarCurso`**
  ```javascript
  async guardarCurso(datos) {
    const accion = datos.id ? 'editar_fila' : 'agregar_fila';
    const r = await fetch('/api/proxy', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({accion, hoja:'Estudios', id: datos.id, datos})});
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    await this.recargar();
    this.abrirModalUlacit();
  },
  async eliminarCurso(id) {
    if (!confirm('¿Eliminar este curso?')) return;
    await fetch('/api/proxy', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({accion:'eliminar_fila', hoja:'Estudios', id})});
    await this.recargar();
    this.abrirModalUlacit();
  }
  ```

- [ ] **Step 4 (Claude + Anyelo): Verificar**
  - Push, abrir la URL, click en el módulo ULACIT → modal abre con tabla vacía.
  - Agregar 2 cursos de prueba (uno de Administración, uno de Contaduría), verificar que persisten en el Sheet y que al recargar la página siguen ahí.
  - Editar un curso, cambiar el avance de 30 a 60, verificar.
  - Eliminar el curso de prueba, verificar.

- [ ] **Step 5 (Anyelo): Commit y push**
  - Mensaje: `feat: módulo ULACIT con CRUD de cursos`.

---

### Task 8: Módulo Empleo + formulario para aplicaciones

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (`renderEmpleo()` + modal `#modal-empleo`)

**Interfaces:**
- Consumes: `App.data.empleo` (hoja `Empleo`).
- Produces: mismo patrón que Task 7 (`abrirModalEmpleo`, `guardarAplicacion`, `eliminarAplicacion`).

- [ ] **Step 1 (Claude): Escribir `renderEmpleo()`**
  ```javascript
  renderEmpleo() {
    const el = document.querySelector('[data-modulo=empleo]');
    const emp = this.data.empleo || [];
    const activas = emp.filter(e => ['aplicado','entrevista','pendiente'].includes(e.estado)).length;
    const proxima = emp.find(e => e.estado === 'entrevista');
    el.innerHTML = `
      <div class="mod-lbl">EMPLEO</div>
      <div class="mod-title">${activas} activa${activas===1?'':'s'}</div>
      <div class="mod-sub">${proxima ? 'próxima: ' + proxima.empresa : 'sin entrevistas'}</div>
    `;
    el.style.cursor = 'pointer';
    el.onclick = () => this.abrirModalEmpleo();
  }
  ```

- [ ] **Step 2 (Claude): Modal empleo con tabla y formulario**
  - Igual patrón que ULACIT: tabla + agregar/editar/eliminar.
  - Columnas: empresa, puesto, fecha_aplicacion (date input), estado (select: aplicado / entrevista / pendiente / rechazado / aceptado), fuente (LinkedIn / referido / …), notas.

- [ ] **Step 3 (Claude): Métodos `guardarAplicacion` / `eliminarAplicacion`**
  ```javascript
  async guardarAplicacion(datos) {
    const accion = datos.id ? 'editar_fila' : 'agregar_fila';
    const r = await fetch('/api/proxy', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({accion, hoja:'Empleo', id: datos.id, datos})});
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    await this.recargar();
    this.abrirModalEmpleo();
  },
  async eliminarAplicacion(id) {
    if (!confirm('¿Eliminar esta aplicación?')) return;
    await fetch('/api/proxy', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({accion:'eliminar_fila', hoja:'Empleo', id})});
    await this.recargar();
    this.abrirModalEmpleo();
  }
  ```

- [ ] **Step 4 (Claude + Anyelo): Verificar + commit**
  - Mismo flujo: agregar una aplicación de prueba, editar estado, eliminar.
  - Mensaje: `feat: módulo Empleo con CRUD de aplicaciones`.

---

### Task 9: Vault de documentos — upload a Drive + preview

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (`renderVault()` + modal + upload)

**Interfaces:**
- Consumes: `App.data.vault` (hoja `Vault`).
- Produces:
  - Home: nº documentos, últimos 3 subidos.
  - Modal con grid de documentos (thumbnail o ícono por tipo, nombre, fecha, tags, botón "abrir" que abre `drive_link` en pestaña nueva).
  - Formulario de upload: input file → lee como base64 → llama `POST /api/proxy accion=subir_documento`.
  - Función `App.subirDocumento(file, tipo, tags)` reutilizable.

- [ ] **Step 1 (Claude): `renderVault()`**
  ```javascript
  renderVault() {
    const el = document.querySelector('[data-modulo=vault]');
    const v = this.data.vault || [];
    el.innerHTML = `
      <div class="mod-lbl">VAULT</div>
      <div class="mod-title">${v.length} docs</div>
      <div class="mod-sub">encriptados en Drive</div>
    `;
    el.style.cursor = 'pointer';
    el.onclick = () => this.abrirModalVault();
  }
  ```

- [ ] **Step 2 (Claude): Modal Vault**
  - Grid con tarjetas de cada documento. Ícono según extensión (`.pdf` → ícono rojo, `.docx` → azul, etc.).
  - Botón "Subir documento" grande arriba a la derecha.
  - Cada tarjeta: click → abre `drive_link` en pestaña nueva; botón × → llama `App.eliminarDocumento(id)` (borra fila del Sheet + archivo de Drive).

- [ ] **Step 3 (Claude): Función `subirDocumento`**
  ```javascript
  async subirDocumento(file, tipo, tags) {
    const base64 = await new Promise((res,rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    const r = await fetch('/api/proxy', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({
      accion:'subir_documento',
      datos: { nombre: file.name, tipo, tags, mime: file.type, base64 }
    })});
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    await this.recargar();
    this.abrirModalVault();
    return j;
  }
  ```

- [ ] **Step 4 (Claude): Extender `Code.gs` — función `eliminarDocumento` que también borra de Drive**
  - Agregar en el backend:
    ```javascript
    function eliminarDocumento(id) {
      const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Vault');
      const filas = h.getDataRange().getValues();
      for (let i=1; i<filas.length; i++) {
        if (String(filas[i][0]) === String(id)) {
          const driveId = filas[i][5];
          if (driveId) try { DriveApp.getFileById(driveId).setTrashed(true); } catch(e) {}
          h.deleteRow(i+1);
          registrarActividad('eliminar_documento', 'Vault', `id ${id}`);
          return;
        }
      }
      throw new Error('id no encontrado');
    }
    ```
  - Y agregar el `case` en `doPost`:
    ```javascript
    case 'eliminar_documento':     eliminarDocumento(body.id); return json({ok:true});
    ```

- [ ] **Step 5 (Anyelo): Redesplegar Apps Script**
  - Editor Apps Script → pegar `Code.gs` actualizado → Guardar → Implementar → Administrar implementaciones → editar (✏️) → Versión nueva → Implementar. La URL /exec no cambia.

- [ ] **Step 6 (Claude + Anyelo): Verificar**
  - Push, abrir el modal Vault, subir un PDF pequeño de prueba.
  - Verificar que aparece la tarjeta con nombre, fecha, tamaño.
  - Click en la tarjeta → abre en Drive.
  - Verificar en Drive que el archivo está en la carpeta "Vault Anyelo" (creada automáticamente).
  - Eliminar el documento de prueba → verificar que se borra del Sheet Y de Drive.

- [ ] **Step 7 (Anyelo): Commit y push**
  - Mensaje: `feat: Vault de documentos con upload y eliminación en Drive`.

---

### Task 10: Módulo Actividad 7 días (mini-gráfica)

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (`renderActividad()`)

**Interfaces:**
- Consumes: `App.data.actividad` (hoja `Actividad`).
- Produces: mini-gráfica de barras con conteo de acciones por día (últimos 7 días).

- [ ] **Step 1 (Claude): `renderActividad()`**
  ```javascript
  renderActividad() {
    const el = document.querySelector('[data-modulo=actividad]');
    const act = this.data.actividad || [];
    const hoy = new Date();
    const dias = [];
    for (let i=6; i>=0; i--) {
      const d = new Date(hoy); d.setDate(d.getDate()-i);
      const key = d.toISOString().slice(0,10);
      const count = act.filter(a => String(a.timestamp).slice(0,10) === key).length;
      dias.push({key, count});
    }
    const max = Math.max(1, ...dias.map(d => d.count));
    const barras = dias.map(d => `<span style="height:${Math.round(d.count/max*100)}%;background:#D85A30;flex:1;border-radius:2px 2px 0 0"></span>`).join('');
    el.innerHTML = `
      <div class="mod-lbl">ACTIVIDAD · ÚLTIMOS 7 DÍAS</div>
      <div style="display:flex;align-items:end;gap:3px;height:34px;margin-top:8px">${barras}</div>
      <div class="mod-sub" style="margin-top:6px">${dias.reduce((s,d)=>s+d.count,0)} acciones esta semana</div>
    `;
  }
  ```

- [ ] **Step 2 (Claude + Anyelo): Verificar + commit**
  - Al haber estado agregando cursos, aplicaciones y documentos, la mini-gráfica debe mostrar barras reales.
  - Mensaje: `feat: mini-gráfica de actividad 7 días`.

---

### Task 11: Organigrama JORISU animado (página propia)

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html` (agregar sección `#pagina-organigrama` + navegación entre home y páginas)

**Interfaces:**
- Consumes: `App.data.organigrama` (hoja `Organigrama` — cada fila es un nodo: id, tipo `sociedad|socio|proyecto|inversionista`, nombre, padre_id, participación, notas).
- Produces:
  - Función `App.abrirModulo(nombre)` cableada — cambia entre `#home` y `#pagina-organigrama`.
  - Botón "Ver organigrama" en el módulo JORISU que llama `App.abrirModulo('organigrama')`.
  - SVG animado renderizado dinámicamente desde `App.data.organigrama`.

- [ ] **Step 1 (Claude): Poblar la hoja Organigrama con los datos actuales**
  - Vía `POST /api/proxy accion=agregar_fila` para cada nodo. Por ejemplo:
    - `{tipo:'sociedad', nombre:'INVERSIONES JORISU', padre_id:'', participacion:'', notas:'3-102-780078'}` → id 1
    - `{tipo:'socio', nombre:'Anyelo Hidalgo', padre_id:1, participacion:'50%', notas:'Gerente'}` → id 2
    - `{tipo:'socio', nombre:'Jonathan Hidalgo', padre_id:1, participacion:'25%', notas:'Gerente'}` → id 3
    - `{tipo:'socio', nombre:'Karla Brenes', padre_id:1, participacion:'25%', notas:'Socia'}` → id 4
    - `{tipo:'proyecto', nombre:'Corona 2', padre_id:1, participacion:'', notas:'2.0 ha, sin Anyelo'}` → id 5
    - `{tipo:'proyecto', nombre:'Corona 3', padre_id:1, participacion:'Anyelo 16.6%', notas:'1.5 ha, con Kenny'}` → id 6
    - `{tipo:'proyecto', nombre:'Corona 4', padre_id:1, participacion:'Anyelo 50%', notas:'1.5 ha, sin Kenny'}` → id 7
    - `{tipo:'inversionista', nombre:'Kenny Hages', padre_id:6, participacion:'33.3%', notas:'contractual, no socio'}` → id 8

- [ ] **Step 2 (Claude): Sistema de navegación (home ↔ páginas)**
  - Envolver el grid actual en `<div id="home">…</div>` y agregar `<div id="pagina-organigrama" style="display:none"><button onclick="App.volverHome()" class="btn-abrir">← Volver</button><div id="org-canvas"></div></div>`.
  - Implementar en el objeto `App`:
    ```javascript
    abrirModulo(nombre) {
      document.getElementById('home').style.display = 'none';
      const pag = document.getElementById('pagina-' + nombre);
      if (pag) pag.style.display = 'block';
      if (nombre === 'organigrama') this.renderOrganigrama();
    },
    volverHome() {
      document.querySelectorAll('[id^="pagina-"]').forEach(p => p.style.display = 'none');
      document.getElementById('home').style.display = 'block';
    }
    ```

- [ ] **Step 3 (Claude): Renderizar el organigrama SVG dinámico**
  - Función `App.renderOrganigrama()` en el objeto `App`:
    ```javascript
    renderOrganigrama() {
      const nodos = this.data.organigrama || [];
      const raiz = nodos.find(n => !n.padre_id);
      if (!raiz) { document.getElementById('org-canvas').innerHTML = 'Sin datos'; return; }
      const socios = nodos.filter(n => n.tipo === 'socio' && String(n.padre_id) === String(raiz.id));
      const proyectos = nodos.filter(n => n.tipo === 'proyecto' && String(n.padre_id) === String(raiz.id));
      const invs = nodos.filter(n => n.tipo === 'inversionista');

      const W = 720, H = 380;
      const posX = (n, total, i) => 40 + (W - 80) * (i + 0.5) / total;

      const nodoSvg = (n, x, y, w, h, cls, delay) => `
        <g class="node" style="animation-delay:${delay}s">
          <rect x="${x-w/2}" y="${y}" width="${w}" height="${h}" rx="8" class="${cls}"/>
          <text x="${x}" y="${y+18}" text-anchor="middle" font-size="12" fill="#E6ECF2">${n.nombre}</text>
          <text x="${x}" y="${y+34}" text-anchor="middle" class="mono" font-size="9" fill="#7A9AB8">${n.participacion || ''}</text>
          ${n.notas ? `<text x="${x}" y="${y+48}" text-anchor="middle" class="mono" font-size="9" fill="#5A7A9A">${n.notas}</text>` : ''}
        </g>`;

      const linea = (x1, y1, x2, y2, delay, punteada) => `
        <path class="ln${punteada ? ' ln-k' : ''}" style="animation-delay:${delay}s" d="M ${x1} ${y1} L ${x2} ${y2}"/>`;

      let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px">`;
      // raíz
      svg += nodoSvg(raiz, W/2, 10, 200, 46, 'c-teal-fill', 0.1);
      // líneas raíz → socios
      socios.forEach((s, i) => { const x = posX(s, socios.length, i); svg += linea(W/2, 56, x, 100, 0.3 + i*0.05); });
      // socios
      socios.forEach((s, i) => svg += nodoSvg(s, posX(s, socios.length, i), 100, 160, 56, 'c-blue-fill', 0.35 + i*0.15));
      // línea sociedad → proyectos (desde raíz)
      proyectos.forEach((p, i) => { const x = posX(p, proyectos.length, i); svg += linea(W/2, 56, x, 220, 1.0 + i*0.05); });
      // proyectos
      proyectos.forEach((p, i) => svg += nodoSvg(p, posX(p, proyectos.length, i), 220, 140, 50, 'c-teal-fill', 1.1 + i*0.1));
      // inversionistas conectados a su proyecto padre
      invs.forEach((inv, i) => {
        const padre = proyectos.find(p => String(p.id) === String(inv.padre_id));
        if (padre) {
          const px = posX(padre, proyectos.length, proyectos.indexOf(padre));
          const x = W/2 - 100 + i*200;
          svg += linea(px, 270, x, 300, 1.5 + i*0.05, true);
          svg += nodoSvg(inv, x, 300, 200, 42, 'c-amber-fill', 1.55 + i*0.1);
        }
      });
      svg += '</svg>';
      document.getElementById('org-canvas').innerHTML = svg;
    }
    ```
  - Agregar al CSS las clases `c-teal-fill { fill: #0E1F1D; stroke: #5DCAA5; stroke-width: 1; }`, `c-blue-fill`, `c-amber-fill` con el mismo patrón (fill oscuro + stroke del color del ramp).
  - Los keyframes `pop` y `dr` (y clases `.node`, `.ln`, `.ln-k`) copiarlos del mockup Stark del brainstorming.

- [ ] **Step 4 (Claude): Agregar botón "Ver organigrama" al módulo JORISU**
  - En `renderJorisu()`, agregar un segundo botón: `<button onclick="App.abrirModulo('organigrama')" class="btn-abrir">Ver organigrama</button>`.

- [ ] **Step 5 (Claude + Anyelo): Verificar + commit**
  - Click "Ver organigrama" → transición a la página, SVG se dibuja con animación.
  - Botón "← Volver" regresa a home.
  - Mensaje: `feat: organigrama JORISU animado en página propia`.

---

### Task 12: Buscador global Ctrl+K

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\index.html`

**Interfaces:**
- Consumes: todo `App.data` (indexa todas las hojas relevantes).
- Produces:
  - Función `App.abrirBuscador()` (trigger: Ctrl+K, Cmd+K, o click en ícono lupa de la barra superior).
  - Función `App.buscar(query)` que devuelve `[{tipo, titulo, subtitulo, accion}]`.

- [ ] **Step 1 (Claude): Escribir el HTML del command palette**
  - Overlay `<div id="palette" style="display:none">…</div>` con input grande, teclado hint (Ctrl+K), lista de resultados.

- [ ] **Step 2 (Claude): Función `construirIndice()`**
  ```javascript
  construirIndice() {
    const idx = [];
    (this.data.negocios || []).forEach(n => idx.push({tipo:'negocio', titulo:n.nombre, subtitulo:`${n.rol} · ${n.participacion}`, accion:() => window.open(n.endpoint,'_blank')}));
    (this.data.organigrama || []).forEach(o => idx.push({tipo:'persona', titulo:o.nombre, subtitulo:`${o.tipo} · ${o.participacion}`, accion:() => this.abrirModulo('organigrama')}));
    (this.data.estudios || []).forEach(e => idx.push({tipo:'curso', titulo:e.curso, subtitulo:`${e.carrera} · ${e.avance}%`, accion:() => this.abrirModalUlacit()}));
    (this.data.empleo || []).forEach(e => idx.push({tipo:'empleo', titulo:e.empresa, subtitulo:`${e.puesto} · ${e.estado}`, accion:() => this.abrirModalEmpleo()}));
    (this.data.vault || []).forEach(v => idx.push({tipo:'documento', titulo:v.nombre, subtitulo:`${v.tipo} · ${v.fecha}`, accion:() => window.open(v.drive_link,'_blank')}));
    (this.data.contactos || []).forEach(c => idx.push({tipo:'contacto', titulo:c.nombre, subtitulo:`${c.rol || ''} · ${c.organizacion || ''}`, accion:() => alert(`${c.nombre}\n${c.email || ''}\n${c.telefono || ''}`)}));
    return idx;
  }
  ```

- [ ] **Step 3 (Claude): Función `buscar(query)` con fuzzy match simple**
  ```javascript
  buscar(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return this.indice.filter(i =>
      (i.titulo || '').toLowerCase().includes(q) ||
      (i.subtitulo || '').toLowerCase().includes(q)
    ).slice(0, 20);
  }
  ```

- [ ] **Step 4 (Claude): Wiring — input, resultados, teclado**
  - `document.addEventListener('keydown', e => { if ((e.ctrlKey||e.metaKey) && e.key === 'k') { e.preventDefault(); App.abrirBuscador(); }})`
  - En el input: `oninput` → llama `buscar` → renderiza resultados.
  - En resultados: Enter → ejecuta `.accion()`; Escape → cierra; ↑↓ → navega.
  - Al `abrirBuscador()`, llama `construirIndice()` para tener el índice fresco.

- [ ] **Step 5 (Claude + Anyelo): Verificar + commit**
  - Ctrl+K desde cualquier lado → paleta abre.
  - Buscar "corona" → aparecen los proyectos.
  - Buscar "avellana" → aparece el negocio.
  - Enter en un resultado → ejecuta la acción.
  - En iPhone: agregar un botón lupa a la barra superior (Ctrl+K no aplica en móvil).
  - Mensaje: `feat: buscador global Ctrl+K`.

---

### Task 13: PWA para Costa Piña y Avellana Studio

**Files:**
- Modify: `C:\Users\Angelo\Documents\GitHub\vida-panel\..\..\..\Downloads\finca-panel\index.html` (ruta puede variar; en realidad está en `C:\Users\Angelo\Documents\GitHub\finca-panel\index.html` — verificar)
- Create: `C:\Users\Angelo\Documents\GitHub\finca-panel\manifest.webmanifest`
- Create: `C:\Users\Angelo\Documents\GitHub\finca-panel\apple-touch-icon.png`
- Create: `C:\Users\Angelo\Documents\GitHub\finca-panel\icon-192.png`, `icon-512.png`
- Repite para `belleza-panel`.

**Interfaces:** ninguna nueva. Solo mejora los dashboards existentes para que agreguen a pantalla de inicio.

- [ ] **Step 1 (Claude): Generar los íconos para cada dashboard**
  - Costa Piña: fondo verde `#2FA774`, iniciales "CP" o silueta de piña.
  - Avellana Studio: fondo coral `#D24558`, iniciales "AS" o gotita.

- [ ] **Step 2 (Claude): Agregar meta tags PWA a cada `index.html`**
  - Copiar los mismos meta tags del Task 2 Step 1, ajustando `apple-mobile-web-app-title` a "Costa Piña" / "Avellana".

- [ ] **Step 3 (Claude): Escribir cada `manifest.webmanifest`**
  - Costa Piña: `name: "Costa Piña Dashboard"`, `short_name: "Costa Piña"`, `theme_color: "#2FA774"`.
  - Avellana: `name: "Avellana Studio"`, `short_name: "Avellana"`, `theme_color: "#D24558"`.

- [ ] **Step 4 (Anyelo): Push de ambos repos**
  - GitHub Desktop → `finca-panel` → commit "feat: PWA para iPhone" → push.
  - Igual con `belleza-panel`.
  - Esperar redespliegue de GitHub Pages (1-2 min).

- [ ] **Step 5 (Anyelo, iPhone): Agregar los 3 a pantalla de inicio**
  - Abrir cada dashboard en Safari → Compartir → Añadir a pantalla de inicio.
  - Verificar los 3 íconos aparecen distintos (verde CP, coral AS, HUD Vida).

---

## Cierre

Al finalizar las 13 tareas, Anyelo tiene:

- Un dashboard privado en `<algo>.pages.dev` con login por OTP a su correo.
- 3 íconos en el iPhone (Vida, Costa Piña, Avellana) que abren como apps.
- Todos sus negocios, estudios, aplicaciones de empleo, documentos, y contactos en un solo lugar, editables desde el mismo dashboard.
- Datos de Costa Piña y Avellana en vivo (sin duplicación).
- Organigrama animado de JORISU.
- Buscador global (Ctrl+K).
- Log de actividad automático.

Siguientes iteraciones posibles (fuera de este plan): dominio propio, agregar a Belén como usuario de vistas específicas, integración con Google Calendar, backup automático del Sheet.
