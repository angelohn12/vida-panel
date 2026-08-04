// ============================================================
//  ANYELO.OS — Vida Dashboard · Backend Apps Script
// ============================================================
//  Sheet: "Vida Master" — reemplazar el SHEET_ID abajo con el
//  id real después de crear el Sheet en Google Drive.
//  Clave API: se usa también en Cloudflare Pages como VIDA_KEY.
// ============================================================

const SHEET_ID = '1qMQfUIe-ZfQHpSItaU_9lp9n9F7ExPGYkzdQSKms044';
const CLAVE = 'VIDA_KEY_2026!';

const HOJAS = {
  Perfil:      ['campo','valor','actualizado'],
  Negocios:    ['id','nombre','tipo','rol','participacion','sociedad','estado','endpoint','color','notas'],
  Organigrama: ['id','tipo','nombre','padre_id','participacion','notas'],
  Estudios:    ['id','carrera','curso','avance','semestre','estado','notas'],
  Empleo:      ['id','empresa','puesto','fecha_aplicacion','estado','fuente','notas'],
  Vault:       ['id','nombre','tipo','fecha','tags','drive_id','drive_link','tamano_kb','texto'],
  Contactos:   ['id','nombre','organizacion','rol','email','telefono','notas'],
  Empresa:     ['id','categoria','campo','valor'],
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
    // migración: asegurar que el encabezado incluya todas las columnas definidas
    const ncols = Math.max(1, hoja.getLastColumn());
    const headers = hoja.getRange(1, 1, 1, ncols).getValues()[0];
    HOJAS[nombre].forEach((col, i) => {
      if (headers[i] !== col) hoja.getRange(1, i + 1).setValue(col);
    });
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
      case 'eliminar_documento':     eliminarDocumento(body.id); return json({ok:true});
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
  const ids = h.getRange(2,1,h.getLastRow()-1,1).getValues().flat().filter(x=>!isNaN(x) && x!=='');
  return ids.length ? Math.max(...ids)+1 : 1;
}

function agregarFila(hoja, datos) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName(hoja);
  const cab = HOJAS[hoja];
  const id = siguienteId(hoja);
  const fila = cab.map(c => c==='id' ? id : (datos[c] !== undefined ? datos[c] : ''));
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

  // Extracción de texto por OCR vía API REST de Drive (no requiere servicio avanzado).
  // Si falla, se guarda sin texto — la subida NO se rompe. El error se reporta en ocr_error.
  let texto = '', ocrErr = '';
  try {
    if (/pdf|image\//i.test(datos.mime || '')) {
      texto = extraerTextoOCR(blob, datos.nombre).slice(0, 45000);
    }
  } catch (e) {
    ocrErr = String(e).slice(0, 300);
  }

  const id = agregarFila('Vault', {
    nombre: datos.nombre,
    tipo: datos.tipo,
    fecha: new Date().toISOString().slice(0,10),
    tags: datos.tags || '',
    drive_id: archivo.getId(),
    drive_link: archivo.getUrl(),
    tamano_kb: Math.round(blob.getBytes().length/1024),
    texto: texto
  });
  return { id: id, drive_id: archivo.getId(), drive_link: archivo.getUrl(), ocr: texto ? true : false, ocr_error: ocrErr };
}

// Convierte una imagen/PDF a Google Doc con OCR (español) vía API REST v3,
// exporta el texto plano y borra el Doc temporal. Solo usa el scope de Drive.
function extraerTextoOCR(blob, nombre) {
  const token = ScriptApp.getOAuthToken();
  const boundary = 'vidaOCR' + Date.now();
  const metadata = { name: '_ocr_temp_' + nombre, mimeType: 'application/vnd.google-apps.document' };
  const pre = '--' + boundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    '--' + boundary + '\r\n' +
    'Content-Type: ' + (blob.getContentType() || 'application/octet-stream') + '\r\n\r\n';
  const post = '\r\n--' + boundary + '--';
  let payload = Utilities.newBlob(pre).getBytes();
  payload = payload.concat(blob.getBytes());
  payload = payload.concat(Utilities.newBlob(post).getBytes());

  const up = UrlFetchApp.fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=es&fields=id',
    { method: 'post', contentType: 'multipart/related; boundary=' + boundary,
      payload: payload, headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  const upObj = JSON.parse(up.getContentText());
  if (!upObj.id) throw new Error('upload ' + up.getResponseCode() + ': ' + up.getContentText().slice(0,150));

  const ex = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + upObj.id + '/export?mimeType=text/plain',
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  const texto = ex.getResponseCode() === 200 ? ex.getContentText() : '';

  UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + upObj.id,
    { method: 'delete', headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });

  return texto;
}

function eliminarDocumento(id) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Vault');
  const filas = h.getDataRange().getValues();
  for (let i=1; i<filas.length; i++) {
    if (String(filas[i][0]) === String(id)) {
      const driveId = filas[i][5];
      if (driveId) { try { DriveApp.getFileById(driveId).setTrashed(true); } catch(e) {} }
      h.deleteRow(i+1);
      registrarActividad('eliminar_documento', 'Vault', `id ${id}`);
      return;
    }
  }
  throw new Error('id no encontrado');
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
  for (let i=1; i<filas.length; i++) { if (filas[i][0]===clave) { h.getRange(i+1,2).setValue(valor); return; } }
  h.appendRow([clave, valor]);
}

function registrarActividad(accion, hoja, detalle) {
  const h = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Actividad');
  h.appendRow([new Date().toISOString(), Session.getActiveUser().getEmail() || 'system', accion, hoja, detalle]);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
