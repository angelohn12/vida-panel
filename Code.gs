// ============================================================
//  ANYELO.OS — Vida Dashboard · Backend Apps Script
// ============================================================
//  Sheet: "Vida Master" — reemplazar el SHEET_ID abajo con el
//  id real después de crear el Sheet en Google Drive.
//  Clave API: vive en Propiedades del script como VIDA_KEY (nunca
//  en este archivo) y debe ser igual a VIDA_KEY de Cloudflare Pages.
//  Las claves de Costa Piña y Avellana viven en la hoja Config.
// ============================================================

const SHEET_ID = '1qMQfUIe-ZfQHpSItaU_9lp9n9F7ExPGYkzdQSKms044';

const HOJAS = {
  Perfil:      ['campo','valor','actualizado'],
  Negocios:    ['id','nombre','tipo','rol','participacion','sociedad','estado','endpoint','color','notas'],
  Organigrama: ['id','tipo','nombre','padre_id','participacion','notas'],
  Estudios:    ['id','carrera','curso','avance','semestre','estado','notas'],
  Empleo:      ['id','empresa','puesto','fecha_aplicacion','estado','fuente','notas'],
  Vault:       ['id','nombre','tipo','fecha','tags','drive_id','drive_link','tamano_kb','texto'],
  Contactos:   ['id','nombre','organizacion','rol','email','telefono','notas'],
  Empresa:     ['id','categoria','campo','valor'],
  Bitacora:    ['id','fecha','etiqueta','vinculo','texto','autor'],
  Obligaciones:['id','nombre','acreedor','monto_total','moneda','mi_parte','dia_limite','frecuencia','reembolso','desde','activa','notas','dia_corte','rebajo_cuenta'],
  Pagos:       ['id','obligacion_id','periodo','fecha_pago','monto','moneda','reembolsado','notas'],
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
    cfg.appendRow(['costa_pina_key','']);
    cfg.appendRow(['avellana_url','https://script.google.com/macros/s/AKfycbxQVdDsH_Qgg9MnRgb0rDyzYPkvRESEi2FGD-ENHeT9L7CMbZl_xTaVxDs0wfNe3tflMg/exec']);
    cfg.appendRow(['avellana_key','']);
    cfg.appendRow(['vault_folder_id','']);
  }
}

function claveValida(key) {
  const clave = PropertiesService.getScriptProperties().getProperty('VIDA_KEY');
  return !!clave && key === clave;
}

function doGet(e) {
  ensureSetup();
  if (!e.parameter || !claveValida(e.parameter.key)) return json({ok:false,error:'unauthorized'});
  if (e.parameter.accion === 'leer') return json({ok:true, ...leerTodo(), finanzas: agendaFinanzas()});
  return json({ok:false,error:'accion desconocida'});
}

function doPost(e) {
  ensureSetup();
  const body = JSON.parse(e.postData.contents);
  if (!claveValida(body.key)) return json({ok:false,error:'unauthorized'});
  try {
    switch(body.accion) {
      case 'agregar_fila':           return json({ok:true, id: agregarFila(body.hoja, body.datos)});
      case 'editar_fila':            editarFila(body.hoja, body.id, body.datos); return json({ok:true});
      case 'eliminar_fila':          eliminarFila(body.hoja, body.id); return json({ok:true});
      case 'subir_documento':        return json({ok:true, ...subirDocumento(body.datos)});
      case 'eliminar_documento':     eliminarDocumento(body.id); return json({ok:true});
      case 'leer_dashboard_externo': return json({ok:true, data: leerExterno(body.id)});
      case 'probar_recordatorio':    recordatorioDiario(); return json({ok:true});
      case 'revisar_rebajos':        return json({ok:true, nuevos: revisarRebajos()});    }
    return json({ok:false,error:'accion desconocida'});
  } catch(err) {
    return json({ok:false,error:String(err)});
  }
}

function leerTodo() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const res = {};
  // Config guarda claves: nunca sale hacia el navegador
  Object.keys(HOJAS).filter(nombre => nombre !== 'Config').forEach(nombre => {
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


// ============================================================
//  FINANZAS — obligaciones fijas, pagos y recordatorio diario
// ============================================================
//  Obligaciones: una fila por pago fijo (dia_limite = día del mes).
//  Pagos: una fila por obligación pagada en un periodo (YYYY-MM).
//  "desde" = primer periodo que se cobra (evita marcar atrasos viejos).
//  Si la obligación tiene "reembolso", el pago queda pendiente de
//  cobro hasta que reembolsado = 'sí'.
// ============================================================

const DIAS_AVISO = 5;

function filasHoja(nombre) {
  const filas = SpreadsheetApp.openById(SHEET_ID).getSheetByName(nombre).getDataRange().getValues();
  const cab = filas.shift();
  return filas.map(f => Object.fromEntries(cab.map((c,i) => [c, f[i]])));
}

// Sheets convierte "2026-10" en fecha; esto lo devuelve a texto.
function normPeriodo(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'America/Costa_Rica', 'yyyy-MM');
  return String(v || '').trim().slice(0, 7);
}

function tipoCambio() {
  const cache = CacheService.getScriptCache();
  const enCache = cache.get('tc_usd_crc');
  if (enCache) return Number(enCache);
  try {
    const r = JSON.parse(UrlFetchApp.fetch('https://open.er-api.com/v6/latest/USD', {muteHttpExceptions:true}).getContentText());
    const tc = r && r.rates && r.rates.CRC;
    if (tc) { cache.put('tc_usd_crc', String(tc), 21600); setConfig('tc_usd_crc', tc); return tc; }
  } catch (e) {}
  return Number(leerConfig().tc_usd_crc) || 510;
}

function agendaFinanzas() {
  const tz = 'America/Costa_Rica';
  const [hy, hm, hd] = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd').split('-').map(Number);
  const hoy = Date.UTC(hy, hm - 1, hd);
  const DIA = 86400000;
  const tc = tipoCambio();
  const aColones = (monto, moneda) => Math.round(Number(monto || 0) * (String(moneda).toUpperCase() === 'USD' ? tc : 1));
  const obligaciones = filasHoja('Obligaciones').filter(o => o.id !== '' && String(o.activa).toLowerCase() !== 'no');
  const pagos = filasHoja('Pagos').map(p => Object.assign(p, {periodo: normPeriodo(p.periodo)}));
  const periodoActual = hy + '-' + String(hm).padStart(2, '0');

  const items = [], cobros = [];
  const cortes = obligaciones.filter(o => Number(o.dia_corte)).map(o => {
    const ultimo = new Date(Date.UTC(hy, hm, 0)).getUTCDate();
    let c = Date.UTC(hy, hm - 1, Math.min(Number(o.dia_corte), ultimo));
    if (c < hoy) { const u2 = new Date(Date.UTC(hy, hm + 1, 0)).getUTCDate(); c = Date.UTC(hy, hm, Math.min(Number(o.dia_corte), u2)); }
    return {nombre: o.nombre, fecha: Utilities.formatDate(new Date(c), 'UTC', 'yyyy-MM-dd'), dias: Math.round((c - hoy) / DIA)};
  }).sort((a, b) => a.dias - b.dias);
  let totalMes = 0, pagadoMes = 0;

  obligaciones.forEach(o => {
    const desde = normPeriodo(o.desde) || periodoActual;
    const parte = o.mi_parte !== '' ? o.mi_parte : o.monto_total;
    const crc = aColones(parte, o.moneda);
    let siguiente = null;
    for (let k = -3; k <= 2; k++) {
      const y = hy + Math.floor((hm - 1 + k) / 12), m = ((hm - 1 + k) % 12 + 12) % 12;
      const periodo = y + '-' + String(m + 1).padStart(2, '0');
      if (periodo < desde) continue;
      const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const venc = Date.UTC(y, m, Math.min(Number(o.dia_limite) || 1, ultimo));
      const pago = pagos.find(p => String(p.obligacion_id) === String(o.id) && p.periodo === periodo);
      if (periodo === periodoActual) { totalMes += crc; if (pago) pagadoMes += crc; }
      if (pago) {
        if (o.reembolso && String(pago.reembolsado).toLowerCase() !== 'sí')
          cobros.push({pago_id: pago.id, obligacion: o.nombre, detalle: o.reembolso, periodo, monto: pago.monto || parte, moneda: pago.moneda || o.moneda});
        continue;
      }
      if (!siguiente) siguiente = {periodo, venc};
    }
    if (!siguiente) return;
    const dias = Math.round((siguiente.venc - hoy) / DIA);
    items.push({
      id: o.id, nombre: o.nombre, acreedor: o.acreedor, periodo: siguiente.periodo,
      vence: Utilities.formatDate(new Date(siguiente.venc), 'UTC', 'yyyy-MM-dd'), dias,
      estado: dias < 0 ? 'atrasada' : dias === 0 ? 'hoy' : dias <= DIAS_AVISO ? 'pronto' : 'al_dia',
      mi_parte: parte, moneda: o.moneda, crc, reembolso: o.reembolso, notas: o.notas
    });
  });
  items.sort((a, b) => a.dias - b.dias);
  return {hoy: Utilities.formatDate(new Date(hoy), 'UTC', 'yyyy-MM-dd'), tc, periodo: periodoActual,
          total_mes: totalMes, pagado_mes: pagadoMes, pendiente_mes: totalMes - pagadoMes, items, cobros, cortes};
}

// ------------------------------------------------------------
//  Rebajos automáticos: si la obligación tiene "rebajo_cuenta"
//  (4 últimos dígitos de la cuenta), se marca sola al llegar el
//  aviso del BAC de un débito aplicado por ese monto. Los avisos
//  "fue rechazada" traen el mismo monto y NO cuentan como pago.
// ------------------------------------------------------------

const TOLERANCIA_REBAJO = 3;   // el monto cambia unos centavos cada mes
const DIAS_REVISION = 10;      // cuántos días atrás se leen los avisos
const MARGEN_PERIODO = 15;     // máx. días entre el rebajo y el vencimiento

function leerRebajoBAC(texto) {
  const t = String(texto).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  if (!/fue aplicada correctamente/i.test(t)) return null;
  const m = t.match(/referencia (\d+), debitando su cuenta IBAN \S*?(\d{4}) por un monto de ([\d,]+\.\d{2}) (Dolares|Colones)\..*?y hora:? (\d{2})\/(\d{2})\/(\d{4})/i);
  if (!m) return null;
  return {ref: m[1], cuenta: m[2], monto: Number(m[3].replace(/,/g, '')),
          moneda: /dolares/i.test(m[4]) ? 'USD' : 'CRC', fecha: m[7] + '-' + m[6] + '-' + m[5]};
}

// Periodo cuyo vencimiento queda más cerca del rebajo (la cuota del día 1 suele rebajarse el 31).
function periodoDeRebajo(diaLimite, desde, fecha) {
  const [y0, m0, d0] = fecha.split('-').map(Number);
  const dia = Date.UTC(y0, m0 - 1, d0);
  let mejor = null, menor = Infinity;
  for (let k = -1; k <= 1; k++) {
    const y = y0 + Math.floor((m0 - 1 + k) / 12), m = ((m0 - 1 + k) % 12 + 12) % 12;
    const periodo = y + '-' + String(m + 1).padStart(2, '0');
    if (desde && periodo < desde) continue;
    const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const dif = Math.abs(Date.UTC(y, m, Math.min(Number(diaLimite) || 1, ultimo)) - dia) / 86400000;
    if (dif < menor) { menor = dif; mejor = periodo; }
  }
  return menor <= MARGEN_PERIODO ? mejor : null;
}

function textoCorreo(parte) {
  let texto = '';
  const data = parte.body && parte.body.data;
  if (data && /^text\//.test(parte.mimeType || '')) {
    const bytes = typeof data === 'string' ? Utilities.base64DecodeWebSafe(data) : data;
    texto = Utilities.newBlob(bytes).getDataAsString('UTF-8');
  }
  return (parte.parts || []).reduce((acc, p) => acc + ' ' + textoCorreo(p), texto);
}

function revisarRebajos() {
  const conRebajo = filasHoja('Obligaciones').filter(o => o.id !== '' && String(o.activa).toLowerCase() !== 'no' && String(o.rebajo_cuenta || '').trim());
  if (!conRebajo.length) return [];
  const pagos = filasHoja('Pagos').map(p => Object.assign(p, {periodo: normPeriodo(p.periodo)}));
  const q = 'from:notificaciones@baccredomatic.cr "aplicada correctamente" newer_than:' + DIAS_REVISION + 'd';
  const lista = Gmail.Users.Messages.list('me', {q, maxResults: 50}).messages || [];
  const nuevos = [];
  lista.forEach(item => {
    const r = leerRebajoBAC(textoCorreo(Gmail.Users.Messages.get('me', item.id, {format: 'full'}).payload));
    if (!r || pagos.some(p => String(p.notas).includes(r.ref))) return;
    const o = conRebajo.find(c => String(c.rebajo_cuenta).trim() === r.cuenta &&
      String(c.moneda).toUpperCase() === r.moneda && Math.abs(Number(c.monto_total) - r.monto) <= TOLERANCIA_REBAJO);
    if (!o) return;
    const periodo = periodoDeRebajo(o.dia_limite, normPeriodo(o.desde), r.fecha);
    if (!periodo || pagos.some(p => String(p.obligacion_id) === String(o.id) && p.periodo === periodo)) return;
    const pago = {obligacion_id: o.id, periodo, fecha_pago: r.fecha, monto: r.monto, moneda: r.moneda, reembolsado: '',
                  notas: 'Marcado solo: rebajo BAC …' + r.cuenta + ' (SINPE ref. ' + r.ref + ')'};
    agregarFila('Pagos', pago);
    pagos.push(pago);
    nuevos.push({nombre: o.nombre, periodo, fecha: r.fecha, monto: r.monto, moneda: r.moneda});
  });
  return nuevos;
}

function recordatorioDiario() {
  let rebajos = [], errorRebajos = false;
  try { rebajos = revisarRebajos(); } catch (e) { errorRebajos = true; console.error(e); }
  const a = agendaFinanzas();
  const crc = n => '₡' + Math.round(n).toLocaleString('es-CR');
  const monto = i => (String(i.moneda).toUpperCase() === 'USD' ? '$' + Number(i.mi_parte).toLocaleString('es-CR') + ' (' + crc(i.crc) + ')' : crc(i.crc));
  const fecha = s => { const p = s.split('-'); return p[2] + '/' + p[1]; };
  const cuando = i => i.dias < 0 ? 'atrasado ' + (-i.dias) + (i.dias === -1 ? ' día' : ' días') : i.dias === 0 ? 'vence HOY' : 'en ' + i.dias + (i.dias === 1 ? ' día' : ' días');
  const color = {atrasada:'#C0392B', hoy:'#C0392B', pronto:'#B9770E', al_dia:'#555'};
  const fila = i => '<tr><td style="padding:6px 10px 6px 0"><b>' + i.nombre + '</b><br><span style="color:#777;font-size:12px">' + (i.acreedor || '') + (i.reembolso ? ' · ' + i.reembolso : '') + '</span></td>' +
    '<td style="padding:6px 10px;white-space:nowrap">' + monto(i) + '</td>' +
    '<td style="padding:6px 0;white-space:nowrap;color:' + color[i.estado] + '">' + fecha(i.vence) + ' · ' + cuando(i) + '</td></tr>';

  const urgentes = a.items.filter(i => i.estado !== 'al_dia');
  const proximos = a.items.filter(i => i.estado === 'al_dia');
  let html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;max-width:600px">';
  html += '<h2 style="margin:0 0 4px">Finanzas del día</h2><div style="color:#777;margin-bottom:16px">' + fecha(a.hoy) + ' · tipo de cambio ' + crc(a.tc) + ' por dólar</div>';
  if (rebajos.length) html += '<h3 style="margin:0 0 6px">Marcado como pagado (rebajo del BAC)</h3><ul style="margin:0 0 16px;padding-left:18px">' +
    rebajos.map(r => '<li>' + r.nombre + ': ' + (r.moneda === 'USD' ? '$' + r.monto : crc(r.monto)) + ' el ' + fecha(r.fecha) + '</li>').join('') + '</ul>';
  if (errorRebajos) html += '<p style="margin:0 0 16px;color:#B9770E">Hoy no pude revisar los rebajos del BAC: lo que diga atrasado podría estar pagado.</p>';
  html += urgentes.length
    ? '<h3 style="margin:0 0 6px">Para atender ya</h3><table style="border-collapse:collapse">' + urgentes.map(fila).join('') + '</table>'
    : '<p style="margin:0 0 6px">Nada vence en los próximos ' + DIAS_AVISO + ' días.</p>';
  const cortesCerca = a.cortes.filter(c => c.dias <= 3);
  if (cortesCerca.length) html += '<h3 style="margin:18px 0 6px">Cortes de tarjeta</h3><ul style="margin:0;padding-left:18px">' +
    cortesCerca.map(c => '<li>' + c.nombre + ': corte ' + (c.dias === 0 ? 'HOY' : 'en ' + c.dias + (c.dias === 1 ? ' día' : ' días')) + ' (' + fecha(c.fecha) + '). Lo que compres después pasa al siguiente estado de cuenta.</li>').join('') + '</ul>';
  if (proximos.length) html += '<h3 style="margin:18px 0 6px">Lo que sigue</h3><table style="border-collapse:collapse">' + proximos.map(fila).join('') + '</table>';
  html += '<div style="margin-top:18px;padding-top:12px;border-top:1px solid #ddd">Este mes: ' + crc(a.total_mes) + ' en total · pagado ' + crc(a.pagado_mes) + ' · <b>falta ' + crc(a.pendiente_mes) + '</b></div>';
  html += '<div style="margin-top:14px"><a href="https://vida-panel.pages.dev">Abrir el Vida Panel</a> para marcar lo pagado.</div></div>';

  const asunto = urgentes.length
    ? 'Finanzas: ' + urgentes.map(i => i.nombre + ' ' + cuando(i)).join(' · ')
    : 'Finanzas del día: todo al día';
  MailApp.sendEmail({to: Session.getEffectiveUser().getEmail(), subject: asunto, htmlBody: html});
}

// Correr UNA VEZ desde el editor (botón Ejecutar) para autorizar la lectura de Gmail.
function autorizarGmail() {
  ensureSetup();
  console.log(JSON.stringify(revisarRebajos()));
}

// Correr UNA VEZ desde el editor (botón Ejecutar) para autorizar y activar el correo diario.
function instalarRecordatorios() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'recordatorioDiario').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('recordatorioDiario').timeBased().everyDays(1).atHour(6).nearMinute(30).inTimezone('America/Costa_Rica').create();
  ensureSetup();
  recordatorioDiario();
}
