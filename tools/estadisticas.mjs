#!/usr/bin/env node
// Cifras y gráficas del escaparate a partir de una tanda de jornadas de la empresa simulada.
//
//   node tools/estadisticas.mjs --tanda <carpeta de la tanda> --censo <people.json> [--salida <raíz del escaparate>]
//                               [--lang es|en] [--hasta AAAA-MM-DD]
//
// Lee solo los días con manifiesto completo y contiguos desde el primero (comprueba el sha256
// de cada fichero contra su manifiesto), y escribe tools/datos.json y las gráficas SVG de
// img/datos/. Con --lang en, las gráficas salen en inglés en img/datos-en/ y además se escribe
// README.en-borrador.md (tools/readme-en.mjs); tools/datos.json es el mismo en los dos idiomas.
// Con --hasta, no lee días posteriores a esa fecha (para reproducir un corte ya publicado).
// El censo es obligatorio, porque el README enlaza las gráficas por sociedad y área;
// solo se usa para agrupar las tareas así (de cada persona se lee su sociedad y su área, nada más).
// Sin él, el guion se detiene antes de escribir nada. No escribe nombres ni rutas.
// Se puede volver a ejecutar cuando la tanda avance: regenera todo desde cero.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { EN } from "./etiquetas-en.mjs";
import { escribirReadmeEn } from "./readme-en.mjs";

// -- argumentos ---------------------------------------------------------------------------- //

function argumentos(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith("--")) out[k.slice(2)] = argv[++i];
  }
  return out;
}
const ARGS = argumentos(process.argv.slice(2));
const TANDA = ARGS.tanda || process.env.AAOS_TANDA;
const CENSO = ARGS.censo || process.env.AAOS_CENSO || null;
const RAIZ = path.resolve(ARGS.salida || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
const LANG = ARGS.lang || "es";
const HASTA_MAX = ARGS.hasta || null;
if (!TANDA || !CENSO) {
  console.error("uso: node tools/estadisticas.mjs --tanda <carpeta> --censo <people.json> [--salida <raíz>] [--lang es|en] [--hasta AAAA-MM-DD]");
  if (TANDA) console.error("falta --censo: sin él no salen las gráficas por sociedad y área que enlaza el README; no se ha escrito nada");
  process.exit(2);
}
if (!["es", "en"].includes(LANG)) {
  console.error("--lang solo admite es o en; no se ha escrito nada");
  process.exit(2);
}
if (HASTA_MAX && !/^\d{4}-\d{2}-\d{2}$/.test(HASTA_MAX)) {
  console.error("--hasta va como AAAA-MM-DD; no se ha escrito nada");
  process.exit(2);
}
if (!fs.existsSync(CENSO)) {
  console.error("no existe el censo indicado en --censo; no se ha escrito nada");
  process.exit(2);
}

// -- etiquetas ----------------------------------------------------------------------------- //

const SOCIEDADES = ["matriz", "logistica", "tienda", "sat", "taller", "maquinaria", "academia", "financiera", "inmobiliaria"];
const ET_SOC = {
  matriz: "Matriz", logistica: "Logística", tienda: "Tienda", sat: "Servicio técnico", taller: "Taller",
  maquinaria: "Maquinaria", academia: "Academia", financiera: "Financiera", inmobiliaria: "Inmobiliaria",
};
const ET_APP = { correo: "Correo", documentos: "Documentos", telefono: "Teléfono", hoja: "Hoja de cálculo", erp: "ERP", crm: "CRM", banco: "Banco" };
const ET_AREA = {
  direccion: "Dirección", rrhh: "Personas", finanzas: "Finanzas y administración", it: "Sistemas", legal: "Legal",
  bienestar: "Prevención", gerencia: "Gerencia", almacen: "Almacén", ventas: "Ventas", trafico: "Tráfico",
  responsable: "Responsable de la sociedad", catalogo: "Catálogo y precios", web: "Tienda en línea", atencion: "Atención al cliente",
  devoluciones: "Devoluciones", jefatura: "Jefatura", campo: "Técnicos de campo", recambios: "Recambios",
  administracion: "Administración", oficiales: "Oficiales de taller", calidad: "Calidad", mostrador: "Mostrador",
  entrega: "Entrega y recogida", valoracion: "Valoración", comercial: "Comercial", coordinacion: "Coordinación",
  formacion: "Formación", riesgos: "Riesgos", cumplimiento: "Cumplimiento", formalizacion: "Formalización",
  recobro: "Recobro", tesoreria: "Tesorería", alquileres: "Alquileres", patrimonio: "Patrimonio",
  reformas: "Reformas", comunidades: "Comunidades",
};
const ET_TIPO = {
  correo_interno_coordinacion: "Correo interno de coordinación", correo_al_jefe_avance: "Correo de avance al responsable",
  correo_suplente_traspaso: "Traspaso al suplente", correo_peticion_documento: "Petición de un documento",
  correo_cliente_seguimiento: "Seguimiento a un cliente", correo_proveedor_consulta: "Consulta a un proveedor",
  correo_confirmacion_pedido: "Confirmación de pedido mayorista", correo_aviso_sat_cliente: "Acuse de aviso del SAT",
  doc_nota_reunion: "Nota de reunión", doc_parte_trabajo: "Parte de trabajo", doc_procedimiento_borrador: "Borrador de procedimiento",
  doc_resumen_pedidos_web: "Resumen de pedidos web", doc_registro_factura_proveedor: "Registro de facturas de proveedor",
  banco_conciliacion: "Conciliación de movimientos (lote diario)", crm_actividad_llamada: "Llamada con cliente (CRM)",
  crm_actividad_nota: "Nota de cliente (CRM)", tel_nota_llamada: "Nota de llamada", erp_nota_incidencia: "Incidencia en el ERP",
  erp_consulta_stock: "Consulta de existencias", hoja_control_diario: "Hoja de control diario", hoja_cuadre: "Hoja de cuadre",
  erp_aprobar_pedido_borrador: "Aprobación de pedido de compra", compras_reclamar_proveedor: "Reclamación de retraso a proveedor",
  tesoreria_conciliar_banco: "Conciliación bancaria (por tick)", tesoreria_reclamar_cobro: "Reclamación de cobro",
  comercial_seguir_moroso: "Seguimiento de moroso", direccion_revisar_desviacion: "Revisión de desviación presupuestaria",
  academia_matricula: "Matrícula en la academia", taller_cerrar_reparacion: "Cierre de reparación del taller",
  sat_cerrar_y_facturar: "Cierre y factura de aviso del SAT",
};
const ET_SUCESO = {
  pedidos_mayorista: "Pedido de un mayorista", pedidos_web: "Pedidos de la tienda en línea", avisos_sat: "Aviso al servicio técnico",
  facturas_proveedor: "Facturas de proveedor", movimientos_banco: "Movimientos de banco",
};
const ET_ECO = {
  eco_compras_aprobar: "Pedido de compra por aprobar", eco_compras_retrasos: "Compra con retraso",
  eco_conciliar_banco: "Movimiento de banco", eco_reclamar_cobros: "Factura vencida sin cobrar",
  eco_seguir_morosos: "Cliente que pasa a moroso", eco_revisar_desviacion: "Desviación del presupuesto al cierre",
  eco_matricular: "Factura de la academia", eco_cerrar_reparacion: "Factura del taller", eco_cerrar_aviso_sat: "Factura del SAT",
};
const ET_MOTIVO = {
  vacio: "Texto vacío", corto: "Demasiado corto", largo: "Demasiado largo", marcador: "Marcador mal formado",
  llaves: "Llaves sin rellenar", ruta_local: "Ruta local", nombre_persona: "Nombre de una persona del censo",
  nombre_sociedad: "Nombre de una sociedad", iban: "Cuenta bancaria escrita", telefono: "Teléfono escrito",
  identificador: "Documento de identidad", cifra_literal: "Cifra escrita a mano", dominio: "Dominio no permitido",
  salud_emocion: "Léxico de salud o emociones", ranking: "Comparar o puntuar personas", palabra_vetada: "Palabra vetada",
  referencia_ajena: "Referencia ajena a la tarea", marcador_perdido: "Falta un marcador obligatorio",
  duplicado: "Casi duplicado de un texto reciente", json_invalido: "Respuesta que no es JSON", falta_texto: "Falta el texto de una tarea", fallo_escritor: "Fallo al pedir el texto",
};
const etMotivo = (k) => ET_MOTIVO[k] || k;
const ET_FUENTE = { modelo: "Modelo (primer intento)", reintento: "Modelo (reintento)", plantilla: "Plantilla de reserva" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Familias de sucesos económicos y de movimientos de banco, por el prefijo de su identificador.
const FAMILIAS = [
  [/^VINC-POOL-INT-/, "Intereses de la tesorería común"],
  [/^VINC-POOL-/, "Tesorería común (barridos y anticipos)"],
  [/^VINC-GEST-/, "Servicios centrales de la matriz"],
  [/^VINC-FORM-/, "Formación interna de la academia"],
  [/^VINC-CERO-/, "Subvención de la financiación al 0 %"],
  [/^(VINC|COB|REV|DET)-FACTOR-/, "Factoring de facturas de logística"],
  [/^(PAG-|COB-)?VINC-MAQ-/, "Reparaciones del taller a maquinaria"],
  [/^(VINC-FIN|BAN)-/, "Financiación de la financiera"],
  [/^LIN-/, "Línea bancaria"],
  [/^(APE|CUO|SEG)-PRE-|^PRE-\d|^FIN-FAC-/, "Préstamos y compras financiadas"],
  [/^DET-/, "Deterioro de la cartera de préstamos"],
  [/^(COB-)?FAC-ALQ-|^(FIA|DEV|DAN|COMP-DAN)-ALQ-|^AMO-/, "Alquiler de maquinaria"],
  [/^INM-/, "Rentas y gastos de inmuebles"],
  [/^NOM-/, "Nóminas"],
  [/^EXTRA-/, "Pagas extra"],
  [/^SS-/, "Seguridad Social"],
  [/^IRPF-/, "Retenciones de IRPF"],
  [/^IVA-/, "IVA trimestral"],
  [/^IS-/, "Impuesto sobre sociedades"],
  [/^GAS-/, "Gastos generales"],
  [/^ACR-/, "Costes variables (acreedores)"],
  [/^REN-MANT-|^(SRV|COB|REC|MOR)-FAC-S-MANT-/, "Contratos de mantenimiento del SAT"],
  [/^SRV-FAC-S/, "Servicios del SAT"],
  [/^SRV-FAC-T/, "Trabajos del taller"],
  [/^SRV-FAC-A/, "Cursos de la academia"],
  [/^VTA-/, "Ventas (tienda y mayoristas)"],
  [/^(PUBLICIDAD_CAPTACION|DEVOLUCIONES|COMISION_PASARELA)-/, "Costes de cada venta en línea"],
  [/^MER-/, "Mermas"],
  [/^(BOR|APR|RET|REC)-PCO-/, "Compras (borrador, aprobación, retraso, recepción)"],
  [/^PAG-FPV-|^FPV-/, "Pagos a proveedores"],
  [/^REC-FAC-/, "Reclamaciones de cobro"],
  [/^MOR-FAC-/, "Clientes morosos"],
  [/^(PRV|FAL)-FAC-/, "Provisiones y fallidos"],
  [/^COB-|^FAC-|^LIQ-/, "Cobros de clientes"],
  [/^PRE-/, "Préstamos y compras financiadas"],
];
const familia = (id) => (FAMILIAS.find(([re]) => re.test(id)) || [null, "Otros"])[1];

// Partidas de gasto que tienen su ingreso idéntico en otra sociedad del grupo (se eliminan al consolidar).
const VINCULADAS = [
  { gasto: "honorarios_gestion", ingreso: "ventas", ingreso_en: "matriz", que: "Servicios centrales" },
  { gasto: "gasto_intereses_pool", ingreso: "intereses_pool", que: "Intereses de la tesorería común" },
  { gasto: "gasto_intereses_vinculados", ingreso: "intereses_vinculados", que: "Intereses del préstamo de la matriz" },
  { gasto: "subvencion_financiacion", ingreso: "subvenciones_tienda", que: "Subvención de la financiación al 0 %" },
  { gasto: "gasto_factoring", ingreso: "descuento_factoring", que: "Descuento del factoring" },
  { gasto: "mantenimiento", gasto_en: "maquinaria", ingreso: "ventas", ingreso_en: "taller", que: "Reparaciones del taller a maquinaria" },
];

// -- utilidades ---------------------------------------------------------------------------- //

const leerJSON = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const sumar = (obj, k, v = 1) => { obj[k] = (obj[k] || 0) + v; };
const ordenar = (obj) => Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))));
const minutos = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const diasEntre = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const diaSemana = (f) => DIAS_SEMANA[new Date(f + "T12:00:00Z").getUTCDay()];
const mesDe = (f) => f.slice(0, 7);
const euros = (c) => Math.round(c) / 100;
const mediana = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const top = (obj, n) => Object.entries(ordenar(obj)).slice(0, n).map(([k, v]) => ({ clave: k, n: v }));
// Formatos de las gráficas (y de los mensajes); datos.json guarda los números sin formato.
const LOCALE = LANG === "en" ? "en-US" : "es-ES";
const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const num = (x) => nf0.format(x);
function eurCorto(e) {
  const a = Math.abs(e);
  if (LANG === "en") {
    const signo = e < 0 && a >= 0.5 ? "−" : "";
    if (a >= 1e6) return `${signo}€${nf1.format(a / 1e6)}M`;
    if (a >= 1e3) return `${signo}€${nf1.format(a / 1e3)}k`;
    return `${signo}€${nf0.format(a)}`;
  }
  if (a >= 1e6) return nf1.format(e / 1e6) + " M€";
  if (a >= 1e3) return nf1.format(e / 1e3) + " k€";
  return nf0.format(e) + " €";
}

// -- lectura de la tanda ------------------------------------------------------------------- //

function diasCompletos(raiz) {
  const nombres = fs.readdirSync(raiz).filter((d) => /^dia-\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const dias = [];
  const avisos = [];
  for (const d of nombres) {
    if (HASTA_MAX && d.slice(4) > HASTA_MAX) break;
    const carpeta = path.join(raiz, d);
    const rutaM = path.join(carpeta, "manifiesto.json");
    if (!fs.existsSync(rutaM) || fs.existsSync(path.join(carpeta, "parciales"))) break;
    const m = leerJSON(rutaM);
    if (!m.completo) break;
    const roto = Object.entries(m.ficheros).find(([f, h]) => !fs.existsSync(path.join(carpeta, f)) || sha(path.join(carpeta, f)) !== h);
    if (roto) { avisos.push(`${d}: ${roto[0]} no coincide con su manifiesto`); break; }
    if (dias.length && diasEntre(dias.at(-1).fecha, m.fecha) !== 1) { avisos.push(`${d}: hueco en la tanda`); break; }
    dias.push({ fecha: m.fecha, carpeta, manifiesto: m });
  }
  return { dias, avisos };
}

const { dias: DIAS, avisos: AVISOS } = diasCompletos(path.resolve(TANDA));
if (!DIAS.length) { console.error("no hay días completos en la tanda"); process.exit(1); }
const DESDE = DIAS[0].fecha;
const HASTA = DIAS.at(-1).fecha;

let censo = null;
if (CENSO) {
  censo = {};
  for (const p of leerJSON(CENSO).people) censo[p.person_id] = { sociedad: p.sociedad, area: p.area };
}

// -- recorrido día a día ------------------------------------------------------------------- //

const R = {
  porDia: [], porMes: {}, tipos: {}, apps: {}, dominios: {}, puestos: {}, sociedades: {}, areas: {}, socArea: {},
  rutina: 0, deSucesos: 0, deEco: 0, personasDia: [],
  fuentes: {}, rechazos: {}, correos: 0, correosExternos: 0, documentos: 0, llamadas: 0, crm: 0, libros: 0,
  sucesos: {}, sucesosPuesto: {}, eco: {}, ecoPuesto: {}, ecoRetraso: {}, ecoMismoDia: {}, ecoTickSiguiente: {},
  sucesosEco: {}, banco: { n: 0, cobros: 0, cobrosC: 0, pagos: 0, pagosC: 0, familias: {} },
  caja: [], cierres: {},
};
const facturas = new Map(); // id -> {primera, ultima, situaciones:Set}
const pedidos = new Map(); // id -> último registro (+ primera fecha)
const movimientos = new Map(); // id -> {fecha, cuenta, importe, referencia}
// Préstamos concedidos dentro de la tanda: su suceso de concesión lleva el identificador desnudo
// (PRE-nnnnnn). La cartera de arranque no tiene ese suceso, aunque lleve la fecha del primer día.
const concedidos = new Set();
const refsTarea = {}; // tipo de tarea -> Set de referencias
const tareasPorRef = {}; // referencia -> [{fecha, hora, puesto, tipo}]
let estadoFinal = null;
let ticksFinal = null;
let previo = null; // resumen del final del día anterior

for (const D of DIAS) {
  const { fecha, carpeta, manifiesto: m } = D;
  const rc = m.recuentos;
  const ag = leerJSON(path.join(carpeta, "agenda.json"));
  const mes = mesDe(fecha);
  R.porMes[mes] ||= { dias: 0, laborables: 0, tareas: 0 };
  R.porMes[mes].dias++;
  const tareasHoy = ag.recuentos.tareas;
  R.porDia.push({ fecha, tareas: tareasHoy, personas: ag.recuentos.personas });
  if (tareasHoy > 0) { R.porMes[mes].laborables++; R.personasDia.push(ag.recuentos.personas); }
  R.porMes[mes].tareas += tareasHoy;

  for (const p of ag.personas) {
    const quien = censo?.[p.persona];
    sumar(R.dominios, p.dominio, p.tareas.length);
    sumar(R.puestos, p.puesto, p.tareas.length);
    if (quien) {
      sumar(R.sociedades, quien.sociedad, p.tareas.length);
      sumar(R.areas, quien.area, p.tareas.length);
      sumar(R.socArea, `${quien.sociedad}|${quien.area}`, p.tareas.length);
    }
    for (const t of p.tareas) {
      sumar(R.tipos, t.tipo);
      sumar(R.apps, t.app);
      (refsTarea[t.tipo] ||= new Set());
      for (const ref of t.referencias) {
        refsTarea[t.tipo].add(ref);
        (tareasPorRef[ref] ||= []).push({ fecha, hora: t.hora, puesto: p.puesto, tipo: t.tipo });
      }
      if (!t.suceso) { R.rutina++; continue; }
      if (t.suceso.startsWith("eco_")) {
        R.deEco++;
        (R.ecoPuesto[t.suceso] ||= {});
        sumar(R.ecoPuesto[t.suceso], p.puesto);
        if (t.causa) {
          const retraso = diasEntre(t.causa.fecha, fecha) * 1440 + minutos(t.hora) - minutos(t.causa.hora);
          (R.ecoRetraso[t.suceso] ||= []).push(retraso);
          if (t.causa.fecha === fecha) sumar(R.ecoMismoDia, t.suceso);
          if (t.causa.fecha === fecha && retraso >= 60 && retraso < 120) sumar(R.ecoTickSiguiente, t.suceso);
        }
      } else {
        R.deSucesos++;
        (R.sucesosPuesto[t.suceso] ||= {});
        sumar(R.sucesosPuesto[t.suceso], p.puesto);
      }
    }
  }
  for (const [k, v] of Object.entries(ag.recuentos.sucesos || {})) {
    R.sucesos[k] ||= { eventos: 0, tareas: 0 };
    R.sucesos[k].eventos += v.eventos; R.sucesos[k].tareas += v.tareas;
  }
  for (const [k, v] of Object.entries(ag.recuentos.sucesos_eco || {})) {
    R.sucesosEco[k] ||= { causas: 0, tareas: 0, eventos: 0, diferidos: 0, sin_persona: 0 };
    for (const c of Object.keys(R.sucesosEco[k])) R.sucesosEco[k][c] += v[c] || 0;
  }
  for (const [k, v] of Object.entries(rc.textos_por_fuente || {})) sumar(R.fuentes, k, v);
  (R.fuentesMes ||= {})[mes] ||= {};
  for (const [k, v] of Object.entries(rc.textos_por_fuente || {})) sumar(R.fuentesMes[mes], k, v);
  for (const [k, v] of Object.entries(m.rechazos || {})) sumar(R.rechazos, k.startsWith("escritor:") ? "fallo_escritor" : k, v);
  R.correos += rc.correos; R.documentos += rc.documentos; R.llamadas += rc.llamadas; R.crm += rc.crm_actividades; R.libros += rc.libros;
  R.correosExternos += leerJSON(path.join(carpeta, "correo.json")).correos.filter((c) => c.externo).length;

  for (const f of leerJSON(path.join(carpeta, "facturas.json")).facturas) {
    const x = facturas.get(f.id) || { primera: fecha, situaciones: new Set() };
    x.ultima = f; x.situaciones.add(f.situacion);
    facturas.set(f.id, x);
  }
  for (const p of leerJSON(path.join(carpeta, "pedidos_compra.json")).pedidos_compra) {
    const x = pedidos.get(p.id);
    pedidos.set(p.id, { ...p, primera: x?.primera || fecha });
  }
  const banco = leerJSON(path.join(carpeta, "banco.json")).movimientos;
  for (const b of banco) {
    movimientos.set(b.id, { fecha, cuenta: b.cuenta, importe: b.importe_centimos, referencia: b.referencia });
    R.banco.n++;
    if (b.importe_centimos >= 0) { R.banco.cobros++; R.banco.cobrosC += b.importe_centimos; } else { R.banco.pagos++; R.banco.pagosC -= b.importe_centimos; }
    const fam = familia(b.referencia);
    R.banco.familias[fam] ||= { n: 0, entradas_centimos: 0, salidas_centimos: 0 };
    R.banco.familias[fam].n++;
    if (b.importe_centimos >= 0) R.banco.familias[fam].entradas_centimos += b.importe_centimos; else R.banco.familias[fam].salidas_centimos -= b.importe_centimos;
  }

  const ticks = fs.readFileSync(path.join(carpeta, "ticks.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
  const sucDia = {};
  for (const t of ticks) for (const s of t.sucesos) { sumar(sucDia, familia(s)); if (/^PRE-\d{6}$/.test(s)) concedidos.add(s); }
  (R.familiasSucesos ||= {});
  for (const [k, v] of Object.entries(sucDia)) sumar(R.familiasSucesos, k, v);
  const ultimo = ticks.at(-1).sociedades;
  const primero = ticks[0].sociedades;
  const fila = { fecha, ticks: ticks.length, sucesos: Object.values(sucDia).reduce((a, b) => a + b, 0), familias: sucDia };
  fila.caja_grupo_ini = SOCIEDADES.reduce((a, s) => a + primero[s].flujo.caja_ini, 0);
  fila.caja_grupo = SOCIEDADES.reduce((a, s) => a + ultimo[s].caja, 0);
  fila.existencias_ini = primero.logistica.flujo.existencias_ini + primero.tienda.flujo.existencias_ini;
  fila.existencias = ultimo.logistica.existencias + ultimo.tienda.existencias;
  fila.unidades = ultimo.logistica.existencias_unidades + ultimo.tienda.existencias_unidades;
  fila.caja = Object.fromEntries(SOCIEDADES.map((s) => [s, ultimo[s].caja]));
  fila.comercial = Object.fromEntries(["logistica", "tienda"].map((s) => [s, {
    demanda_unidades: ultimo[s].demanda_unidades, servidas_unidades: ultimo[s].servidas_unidades,
    ventas_perdidas_unidades: ultimo[s].ventas_perdidas_unidades, ventas_perdidas_centimos: ultimo[s].ventas_perdidas_centimos,
    cola_stock_unidades: ultimo[s].cola_stock_unidades, pedidos_pendientes: ultimo[s].pedidos_pendientes,
    compras_abiertas: ultimo[s].compras_abiertas, cobros_pendientes: ultimo[s].cobros_pendientes,
  }]));
  fila.servicios = Object.fromEntries(["sat", "taller"].map((s) => [s, { cola: ultimo[s].cola_servicios, cola_minutos: ultimo[s].cola_servicios_minutos }]));
  fila.maquinaria = { alquileres_activos: ultimo.maquinaria.alquileres_activos };
  fila.inmobiliaria = { inmuebles_ocupados: ultimo.inmobiliaria.inmuebles_ocupados };
  fila.financiera = { cartera_centimos: ultimo.financiera.cartera_centimos, dudosos_centimos: ultimo.financiera.dudosos_centimos };
  fila.cola_servicios_max_dia = Math.max(...ticks.map((t) => (t.sociedades.sat.cola_servicios || 0) + (t.sociedades.taller.cola_servicios || 0)));
  fila.cola_stock_max_dia = Math.max(...ticks.map((t) => (t.sociedades.logistica.cola_stock_unidades || 0) + (t.sociedades.tienda.cola_stock_unidades || 0)));
  R.caja.push(fila);
  previo = fila;

  const eco = leerJSON(path.join(carpeta, "economia.json"));
  for (const c of eco.cierres) R.cierres[Object.values(c.cierre)[0].mes] = c.cierre;
  estadoFinal = eco.estado;
  ticksFinal = ticks;
}

// -- economía: cuentas de resultados ------------------------------------------------------- //

function pygDeLibro(libro) {
  const { plan, saldos } = libro;
  const out = {};
  let ing = 0, gas = 0;
  for (const p of Object.keys(plan).sort()) {
    if (plan[p] === "ingreso") { out[p] = -saldos[p]; ing += -saldos[p]; }
    if (plan[p] === "gasto") { out[p] = saldos[p]; gas += saldos[p]; }
  }
  return { ...out, ingresos: ing, gastos: gas, resultado: ing - gas };
}

function cuenta(pygs, cerrado, mes) {
  const sociedades = {};
  for (const s of SOCIEDADES) {
    const p = pygs[s];
    const impuesto = p.impuesto_sociedades || 0;
    sociedades[s] = {
      ingresos: euros(p.ingresos), gastos_sin_impuesto: euros(p.gastos - impuesto),
      resultado_antes_impuestos: euros(p.resultado + impuesto), impuesto_sociedades: euros(impuesto), resultado: euros(p.resultado),
    };
  }
  const suma = (k) => SOCIEDADES.reduce((a, s) => a + (pygs[s][k] || 0), 0);
  const eliminaciones = [];
  let eliminado = 0;
  for (const v of VINCULADAS) {
    const gasto = v.gasto_en ? (pygs[v.gasto_en][v.gasto] || 0) : suma(v.gasto);
    let ingreso = v.ingreso_en ? null : suma(v.ingreso);
    if (v.ingreso_en === "matriz") ingreso = pygs.matriz.ventas || 0;
    eliminado += gasto;
    eliminaciones.push({ concepto: v.que, importe: euros(gasto), ...(ingreso === null ? {} : { contrapartida_cuadra: ingreso === gasto }) });
  }
  const formacion = [...facturas.values()].filter((x) => x.ultima.id.startsWith("VINC-FORM-") && mesDe(x.ultima.creado_en) === mes)
    .reduce((a, x) => a + x.ultima.base_centimos, 0);
  eliminado += formacion;
  eliminaciones.push({ concepto: "Formación interna de la academia", importe: euros(formacion) });
  const reparaciones = [...facturas.values()].filter((x) => x.ultima.id.startsWith("VINC-MAQ-") && mesDe(x.ultima.creado_en) === mes)
    .reduce((a, x) => a + x.ultima.base_centimos, 0);
  const rep = eliminaciones.find((e) => e.concepto.startsWith("Reparaciones"));
  rep.contrapartida_cuadra = euros(reparaciones) === rep.importe;
  const impuesto = suma("impuesto_sociedades");
  return {
    mes, cerrado, sociedades,
    consolidado: {
      ingresos_sumados: euros(suma("ingresos")), eliminaciones_intragrupo: euros(eliminado),
      ingresos_consolidados: euros(suma("ingresos") - eliminado),
      resultado_antes_impuestos: euros(suma("resultado") + impuesto), impuesto_sociedades: euros(impuesto), resultado: euros(suma("resultado")),
      detalle_eliminaciones: eliminaciones,
    },
  };
}

const MESES_TANDA = Object.keys(R.porMes).sort();
const cuentas = [];
for (const mes of MESES_TANDA) {
  if (R.cierres[mes]) cuentas.push(cuenta(Object.fromEntries(SOCIEDADES.map((s) => [s, R.cierres[mes][s].pyg])), true, mes));
  else if (mes === mesDe(HASTA)) cuentas.push({ ...cuenta(Object.fromEntries(SOCIEDADES.map((s) => [s, pygDeLibro(estadoFinal.sociedades[s].libro)])), false, mes), hasta: HASTA,
    nota: "Mes sin cerrar: faltan las nóminas, los servicios centrales y el impuesto, que se apuntan el último día hábil o al cierre." });
}

// -- cadenas ------------------------------------------------------------------------------- //

const facturasTanda = [...facturas.values()].filter((x) => x.ultima.creado_en.slice(0, 10) >= DESDE);
const conciliados = refsTarea.tesoreria_conciliar_banco || new Set();
function embudoFacturas(lista, tareaCierre) {
  const cobradas = lista.filter((x) => x.ultima.estado === "cobrada");
  const conMov = cobradas.filter((x) => x.ultima.mov_banco && movimientos.has(x.ultima.mov_banco));
  const conc = conMov.filter((x) => conciliados.has(x.ultima.mov_banco));
  const out = {
    emitidas: lista.length,
    ...(tareaCierre ? { con_tarea_de_cierre: lista.filter((x) => refsTarea[tareaCierre]?.has(x.ultima.id)).length } : {}),
    cobradas: cobradas.length, cobro_con_movimiento_de_banco: conMov.length, movimiento_conciliado_por_tesoreria: conc.length,
    importe_emitido: euros(lista.reduce((a, x) => a + x.ultima.total_centimos, 0)),
    importe_cobrado: euros(cobradas.reduce((a, x) => a + x.ultima.total_centimos, 0)),
  };
  return out;
}
const esServicio = (id, letra) => new RegExp(`^FAC-${letra}[A-Z]{6}$`).test(id);
const externas = facturasTanda.filter((x) => !x.ultima.id.startsWith("VINC-"));
const situacionFinal = {};
for (const x of externas) sumar(situacionFinal, x.ultima.situacion);
const porSociedadFact = {};
for (const x of externas) sumar(porSociedadFact, x.ultima.sociedad);

const facturasR = {
  nota: "Facturas emitidas dentro de la tanda (sin la cartera de arranque); las intragrupo van aparte.",
  emitidas_a_terceros: externas.length,
  importe_emitido_a_terceros: euros(externas.reduce((a, x) => a + x.ultima.total_centimos, 0)),
  por_sociedad: ordenar(porSociedadFact),
  situacion_al_final: ordenar(situacionFinal),
  alguna_vez_vencidas: externas.filter((x) => x.situaciones.has("vencida")).length,
  impagadas: externas.filter((x) => x.situaciones.has("impagada")).length,
  cedidas_en_factoring: externas.filter((x) => x.ultima.cesion).length,
  con_albaran_de_pedido: externas.filter((x) => x.ultima.albaran_ids?.length).length,
  intragrupo: {
    servicios_centrales: facturasTanda.filter((x) => x.ultima.id.startsWith("VINC-GEST-")).length,
    reparaciones_taller_a_maquinaria: facturasTanda.filter((x) => x.ultima.id.startsWith("VINC-MAQ-")).length,
    formacion_interna: facturasTanda.filter((x) => x.ultima.id.startsWith("VINC-FORM-")).length,
  },
  cartera_de_arranque: facturas.size - facturasTanda.length,
};

const comprasEco = [...pedidos.values()].filter((p) => p.sociedad);
const borradoresTarea = [...pedidos.values()].filter((p) => !p.sociedad);
const pagosFPV = new Set([...movimientos.values()].filter((m) => m.importe < 0 && m.referencia.startsWith("FPV-")).map((m) => m.referencia));
const aprobTareas = refsTarea.erp_aprobar_pedido_borrador || new Set();
function embudoCompras(lista) {
  const estado = {}, porSoc = {};
  for (const p of lista) { sumar(estado, p.situacion); sumar(porSoc, p.sociedad); }
  return {
    pedidos: lista.length, por_situacion_al_final: ordenar(estado), por_sociedad: ordenar(porSoc),
    aprobados: lista.filter((p) => p.aprobado_por).length,
    aprobacion_con_tarea: lista.filter((p) => aprobTareas.has(p.id)).length,
    recibidos_con_factura_de_proveedor: lista.filter((p) => p.estado === "recibido" && p.factura_proveedor).length,
    pagados: lista.filter((p) => p.situacion === "pagado").length,
    pago_con_movimiento_de_banco: lista.filter((p) => p.situacion === "pagado" && pagosFPV.has(p.factura_proveedor)).length,
    importe_pedido: euros(lista.reduce((a, p) => a + p.total_centimos, 0)),
  };
}
// Reposición de existencias (borrador por stock bajo, aprobación, recepción, pago) y materiales que compran SAT y taller para cada trabajo.
const reposicion = comprasEco.filter((p) => ["logistica", "tienda"].includes(p.sociedad));
const compras = {
  reposicion_de_existencias: {
    ...embudoCompras(reposicion),
    cadena_completa: reposicion.filter((p) => aprobTareas.has(p.id) && p.situacion === "pagado" && pagosFPV.has(p.factura_proveedor)).length,
  },
  materiales_de_servicios: embudoCompras(comprasEco.filter((p) => !["logistica", "tienda"].includes(p.sociedad))),
  borradores_por_consulta_de_existencias: borradoresTarea.length,
};

const facturasTaller = facturasTanda.filter((x) => x.ultima.sociedad === "taller");
const cadenas = {
  ventas_y_cobros: embudoFacturas(externas.filter((x) => ["logistica", "tienda"].includes(x.ultima.sociedad))),
  servicio_tecnico: embudoFacturas(facturasTanda.filter((x) => x.ultima.sociedad === "sat" && esServicio(x.ultima.id, "S")), "sat_cerrar_y_facturar"),
  taller: embudoFacturas(facturasTaller.filter((x) => !x.ultima.id.startsWith("VINC-")), "taller_cerrar_reparacion"),
  taller_a_maquinaria: embudoFacturas(facturasTaller.filter((x) => x.ultima.id.startsWith("VINC-MAQ-"))),
  academia: embudoFacturas(facturasTanda.filter((x) => x.ultima.sociedad === "academia" && !x.ultima.id.startsWith("VINC-")), "academia_matricula"),
  maquinaria_alquileres: embudoFacturas(facturasTanda.filter((x) => x.ultima.sociedad === "maquinaria" && x.ultima.id.startsWith("FAC-ALQ-"))),
  compras,
};

const fin = estadoFinal.sociedades.financiera.financiera;
// Solo lo concedido en la tanda (con su suceso de concesión); la cartera de arranque va aparte.
const nuevos = Object.values(fin.prestamos).filter((p) => concedidos.has(p.id));
const arranque = Object.values(fin.prestamos).filter((p) => !concedidos.has(p.id));
const porProducto = {}, arranquePorProducto = {};
for (const [lista, out] of [[nuevos, porProducto], [arranque, arranquePorProducto]]) {
  for (const p of lista) {
    out[p.producto] ||= { operaciones: 0, principal: 0 };
    out[p.producto].operaciones++; out[p.producto].principal += p.principal;
  }
  for (const v of Object.values(out)) v.principal = euros(v.principal);
}
const financiera = {
  nota: "Operaciones nuevas: las concedidas dentro de la tanda, con su suceso de concesión. La cartera de arranque se cuenta aparte.",
  operaciones_nuevas_por_producto: porProducto,
  cartera_de_arranque_por_producto: arranquePorProducto,
  compras_de_tienda_financiadas: nuevos.filter((p) => p.factura_tienda).length,
  factoring: { cedido: euros(fin.factoring_concedido), cobrado: euros(fin.factoring_cobrado), facturas_cedidas: facturasR.cedidas_en_factoring },
};

// -- movimientos de banco por familia; impuestos y nóminas ---------------------------------- //

const familiasBanco = {};
for (const [k, v] of Object.entries(R.banco.familias).sort((a, b) => b[1].n - a[1].n)) {
  familiasBanco[k] = { movimientos: v.n, entradas: euros(v.entradas_centimos), salidas: euros(v.salidas_centimos) };
}

// -- reacciones a la economía ---------------------------------------------------------------- //

const reacciones = {};
for (const k of Object.keys(ET_ECO)) {
  const s = R.sucesosEco[k] || { causas: 0, tareas: 0, eventos: 0, diferidos: 0, sin_persona: 0 };
  const ret = R.ecoRetraso[k] || [];
  reacciones[k] = {
    causa: ET_ECO[k], tarea: ET_TIPO[tipoDeEco(k)],
    ...s,
    mismo_dia: R.ecoMismoDia[k] || 0, en_el_tick_siguiente: R.ecoTickSiguiente[k] || 0,
    retraso_mediano_min: mediana(ret),
    puestos: top(R.ecoPuesto[k] || {}, 3).map((x) => ({ puesto: x.clave, tareas: x.n })),
  };
}
function tipoDeEco(k) {
  return {
    eco_compras_aprobar: "erp_aprobar_pedido_borrador", eco_compras_retrasos: "compras_reclamar_proveedor",
    eco_conciliar_banco: "tesoreria_conciliar_banco", eco_reclamar_cobros: "tesoreria_reclamar_cobro",
    eco_seguir_morosos: "comercial_seguir_moroso", eco_revisar_desviacion: "direccion_revisar_desviacion",
    eco_matricular: "academia_matricula", eco_cerrar_reparacion: "taller_cerrar_reparacion", eco_cerrar_aviso_sat: "sat_cerrar_y_facturar",
  }[k];
}
const sucesosDensa = {};
for (const k of Object.keys(ET_SUCESO)) {
  const s = R.sucesos[k] || { eventos: 0, tareas: 0 };
  sucesosDensa[k] = { suceso: ET_SUCESO[k], ...s, puestos: top(R.sucesosPuesto[k] || {}, 2).map((x) => ({ puesto: x.clave, tareas: x.n })) };
}

// -- un día cualquiera ---------------------------------------------------------------------- //

const laborables = R.porDia.filter((d) => d.tareas > 0);
const media = laborables.reduce((a, d) => a + d.tareas, 0) / laborables.length;
const elegido = [...laborables].sort((a, b) => Math.abs(a.tareas - media) - Math.abs(b.tareas - media) || a.fecha.localeCompare(b.fecha))[0];
function unDia(fecha) {
  const D = DIAS.find((x) => x.fecha === fecha);
  const ag = leerJSON(path.join(D.carpeta, "agenda.json"));
  const tipos = {}, apps = {}, eco = {}, puestos = new Set();
  for (const p of ag.personas) {
    puestos.add(p.puesto);
    for (const t of p.tareas) { sumar(tipos, t.tipo); sumar(apps, t.app); if (t.suceso?.startsWith("eco_")) sumar(eco, t.suceso); }
  }
  const idx = DIAS.indexOf(D);
  const fila = R.caja[idx], ant = idx > 0 ? R.caja[idx - 1] : null;
  const nuevas = [...facturas.values()].filter((x) => x.primera === fecha && x.ultima.creado_en.slice(0, 10) === fecha && !x.ultima.id.startsWith("VINC-"));
  const banco = leerJSON(path.join(D.carpeta, "banco.json")).movimientos;
  const perdidas = (s) => fila.comercial[s].ventas_perdidas_unidades - (ant ? ant.comercial[s].ventas_perdidas_unidades : 0);
  // Ejemplo de cadena: una factura del SAT emitida hoy y la tarea que la cierra.
  let ejemploSat = null;
  for (const x of nuevas.filter((y) => y.ultima.sociedad === "sat").sort((a, b) => a.ultima.creado_en.localeCompare(b.ultima.creado_en))) {
    const t = (tareasPorRef[x.ultima.id] || []).find((y) => y.tipo === "sat_cerrar_y_facturar");
    if (t) { ejemploSat = { factura_a_las: x.ultima.creado_en.slice(11, 16), cierre: { fecha: t.fecha, hora: t.hora, puesto: t.puesto }, cobrada: x.ultima.estado === "cobrada" }; break; }
  }
  let ejemploCompra = null;
  for (const p of ag.personas) for (const t of p.tareas) {
    if (!ejemploCompra && t.tipo === "erp_aprobar_pedido_borrador" && t.causa) ejemploCompra = { causa_a_las: t.causa.hora, causa_fecha: t.causa.fecha, tarea_a_las: t.hora, puesto: p.puesto, sociedad: ET_SOC[t.causa.sociedad] };
  }
  return {
    fecha, dia_semana: diaSemana(fecha), personas: ag.recuentos.personas, puestos_distintos: puestos.size, tareas: ag.recuentos.tareas,
    media_laborable: Math.round(media),
    por_app: ordenar(apps), tipos_principales: top(tipos, 6).map((x) => ({ tipo: ET_TIPO[x.clave] || x.clave, tareas: x.n })),
    reacciones_a_la_economia: ordenar(eco),
    economia: {
      ticks: fila.ticks, sucesos: fila.sucesos, familias_principales: top(fila.familias, 6).map((x) => ({ familia: x.clave, sucesos: x.n })),
      facturas_nuevas: nuevas.length, importe_facturado: euros(nuevas.reduce((a, x) => a + x.ultima.total_centimos, 0)),
      movimientos_banco: banco.length, cobros_de_clientes: banco.filter((b) => b.importe_centimos > 0 && /^(FAC|LIQ)-/.test(b.referencia)).length,
      pagos_a_proveedores: banco.filter((b) => b.importe_centimos < 0 && b.referencia.startsWith("FPV-")).length,
      caja_grupo_inicio: euros(fila.caja_grupo_ini), caja_grupo_fin: euros(fila.caja_grupo),
      unidades_no_servidas: { logistica: perdidas("logistica"), tienda: perdidas("tienda") },
    },
    ejemplo_sat: ejemploSat, ejemplo_compra: ejemploCompra,
  };
}

// -- datos.json ----------------------------------------------------------------------------- //

const totalTareas = R.porDia.reduce((a, d) => a + d.tareas, 0);
const ult = R.caja.at(-1), pri = R.caja[0];
const datos = {
  formato: "aaos-escaparate-datos/1",
  aviso: "Cifras de una tanda de la empresa SIMULADA; ambiente de entrenamiento, no una empresa real ni una medida de Ariamir.",
  tanda: {
    desde: DESDE, hasta: HASTA, dias_simulados: DIAS.length, dias_laborables: laborables.length,
    dias_sin_trabajo: DIAS.length - laborables.length, fin_previsto: "2027-01-31",
    semilla: DIAS[0].manifiesto.semilla, tick_minutos: leerJSON(path.join(DIAS.at(-1).carpeta, "economia.json")).tick_min,
    huella_codigo: DIAS[0].manifiesto.codigo_sha256.slice(0, 12), avisos_lectura: AVISOS,
  },
  por_mes: Object.fromEntries(MESES_TANDA.map((m) => [m, { ...R.porMes[m], hasta: m === mesDe(HASTA) ? HASTA : undefined }])),
  tareas: {
    total: totalTareas, media_por_dia_laborable: Math.round(media * 10) / 10,
    minimo_laborable: Math.min(...laborables.map((d) => d.tareas)), maximo_laborable: Math.max(...laborables.map((d) => d.tareas)),
    personas_por_dia_laborable_media: Math.round(R.personasDia.reduce((a, b) => a + b, 0) / R.personasDia.length),
    rutina: R.rutina, por_sucesos_del_dia: R.deSucesos, por_reaccion_a_la_economia: R.deEco,
    por_tipo: Object.fromEntries(Object.entries(ordenar(R.tipos)).map(([k, v]) => [k, { etiqueta: ET_TIPO[k] || k, tareas: v }])),
    por_app: Object.fromEntries(Object.entries(ordenar(R.apps)).map(([k, v]) => [k, { etiqueta: ET_APP[k] || k, tareas: v }])),
    por_experiencia: ordenar(R.dominios),
    por_sociedad: censo ? Object.fromEntries(Object.entries(ordenar(R.sociedades)).map(([k, v]) => [k, { etiqueta: ET_SOC[k] || k, tareas: v }])) : null,
    por_area: censo ? Object.fromEntries(Object.entries(ordenar(R.areas)).map(([k, v]) => [k, { etiqueta: ET_AREA[k] || k, tareas: v }])) : null,
    por_puesto_principales: top(R.puestos, 12).map((x) => ({ puesto: x.clave, tareas: x.n })),
    puestos_distintos: Object.keys(R.puestos).length,
    por_dia: R.porDia,
  },
  apps: {
    correos: R.correos, correos_externos: R.correosExternos, correos_internos: R.correos - R.correosExternos,
    documentos: R.documentos, llamadas: R.llamadas, actividades_crm: R.crm, libros_de_hoja: R.libros, movimientos_banco: R.banco.n,
  },
  textos: {
    por_fuente: ordenar(R.fuentes), por_fuente_y_mes: R.fuentesMes,
    rechazos_por_motivo: Object.fromEntries(Object.entries(ordenar(R.rechazos)).map(([k, v]) => [k, { etiqueta: etMotivo(k), rechazos: v }])),
    rechazos_total: Object.values(R.rechazos).reduce((a, b) => a + b, 0),
    nota: "Motivos contados por texto e intento (la respuesta que no es JSON cuenta una vez); un texto rechazado puede sumar varios motivos. Se guarda el motivo y una huella, no el texto.",
  },
  sucesos_del_dia: sucesosDensa,
  reacciones_a_la_economia: reacciones,
  reacciones_resumen: (() => {
    const v = Object.values(reacciones), n = v.reduce((a, x) => a + x.tareas, 0);
    const mismo = v.reduce((a, x) => a + x.mismo_dia, 0), sig = v.reduce((a, x) => a + x.en_el_tick_siguiente, 0);
    return { tareas: n, mismo_dia: mismo, en_el_tick_siguiente: sig, mismo_dia_pct: Math.round(mismo / n * 100), tick_siguiente_pct: Math.round(sig / n * 100) };
  })(),
  sucesos_economicos_por_familia: ordenar(R.familiasSucesos),
  facturas: facturasR,
  cadenas,
  financiera,
  banco: {
    movimientos: R.banco.n, entradas: R.banco.cobros, salidas: R.banco.pagos,
    importe_entradas: euros(R.banco.cobrosC), importe_salidas: euros(R.banco.pagosC), por_familia: familiasBanco,
  },
  cuentas_de_resultados: cuentas,
  caja_y_existencias: {
    caja_grupo_inicio: euros(pri.caja_grupo_ini), caja_grupo_final: euros(ult.caja_grupo),
    caja_final_por_sociedad: Object.fromEntries(SOCIEDADES.map((s) => [s, euros(ult.caja[s])])),
    existencias_inicio: euros(pri.existencias_ini), existencias_final: euros(ult.existencias),
    unidades_final: ult.unidades,
    comercial_final: Object.fromEntries(Object.entries(ult.comercial).map(([s, v]) => [s, {
      ...v, ventas_perdidas: euros(v.ventas_perdidas_centimos), ventas_perdidas_centimos: undefined,
      nivel_de_servicio_pct: Math.round(v.servidas_unidades / v.demanda_unidades * 1000) / 10,
    }])),
    cola_servicios_maxima: Math.max(...R.caja.map((f) => f.cola_servicios_max_dia)),
    cola_servicios_final: ult.servicios,
    cola_stock_maxima_unidades: Math.max(...R.caja.map((f) => f.cola_stock_max_dia)),
    alquileres_de_maquinaria_activos_final: ult.maquinaria.alquileres_activos,
    inmuebles_ocupados_final: ult.inmobiliaria.inmuebles_ocupados,
    cartera_de_prestamos_final: euros(ult.financiera.cartera_centimos),
    por_dia: R.caja.map((f) => ({ fecha: f.fecha, caja_grupo: euros(f.caja_grupo), existencias: euros(f.existencias), unidades: f.unidades })),
  },
  un_dia_cualquiera: unDia(elegido.fecha),
};

fs.mkdirSync(path.join(RAIZ, "tools"), { recursive: true });
fs.writeFileSync(path.join(RAIZ, "tools", "datos.json"), JSON.stringify(datos, null, 1) + "\n");

// -- gráficas SVG ---------------------------------------------------------------------------- //

const DIR_IMG = path.join(RAIZ, "img", LANG === "en" ? "datos-en" : "datos");
fs.mkdirSync(DIR_IMG, { recursive: true });

// Etiquetas de las gráficas en el idioma pedido; si falta una traducción, se avisa y sale la clave.
const sinTraducir = new Set();
function etiquetas(es, en) {
  if (LANG !== "en") return es;
  return new Proxy(en, { get: (o, k) => (k in o ? o[k] : (sinTraducir.add(String(k)), es[k] || k)) });
}
const L = {
  soc: etiquetas(ET_SOC, EN.soc), app: etiquetas(ET_APP, EN.app), area: etiquetas(ET_AREA, EN.area),
  tipo: etiquetas(ET_TIPO, EN.tipo), eco: etiquetas(ET_ECO, EN.eco), fuente: etiquetas(ET_FUENTE, EN.fuente),
  motivo: LANG === "en" ? (k) => (k in EN.motivo ? EN.motivo[k] : (sinTraducir.add(k), k)) : etMotivo,
  meses: LANG === "en" ? EN.meses : MESES,
};
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const T = LANG === "en" ? {
  fechaLarga: (f) => `${Number(f.slice(8, 10))} ${EN.meses[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}`,
  periodo: (a, b) => `${a} to ${b}`,
  dias: ["Tasks per calendar day", (p) => `Tasks per day, ${p}; weekends and holidays at zero`],
  app: ["Tasks by app", (n, p) => `${n} tasks, ${p}`],
  tipo: ["Tasks by type", (n, de, parte) => `The ${n} most frequent of ${de} types (${parte}% of tasks)`],
  sociedad: ["Tasks by company", "By each person's company; total tasks"],
  area: ["Tasks by area", (n, de, parte) => `The ${n} of ${de} areas with the most tasks, added up across companies (${parte}% of tasks)`],
  reacciones: ["Tasks that react to the economy", "By cause; tasks set on the same day as the cause or on a later day", ["Same day", "A later day"]],
  textos: ["Where the texts come from", "Texts saved, by month and source", (d) => ` (to the ${ordinal(d)})`],
  rechazos: ["Responses rejected by the validator", "Reasons per text and attempt; one rejected text can add several"],
  resultado: ["Pre-tax profit by company", "Euros per closed month; December includes the extra pay"],
  caja: ["Group cash and inventory", "Euros at the close of each calendar day", ["Cash of the nine companies", "Logistics and retail inventory (at cost)"]],
  cadenas: ["Complete chains", "How many documents reach each step within the run", [
    "Sales: invoices issued", "… collected", "… with their bank transaction", "… reconciled by treasury",
    "Field service: service invoices", "… with a close-out task", "… collected",
    "Restocking: draft orders", "… approved with their task", "… received with an invoice", "… paid with a bank transaction",
  ]],
} : {
  fechaLarga: (f) => `${Number(f.slice(8, 10))} de ${MESES[Number(f.slice(5, 7)) - 1]} de ${f.slice(0, 4)}`,
  periodo: (a, b) => `Del ${a} al ${b}`,
  dias: ["Tareas por día natural", (p) => `Tareas al día; ${p.toLowerCase()}; fines de semana y festivos a cero`],
  app: ["Tareas por aplicación", (n, p) => `${n} tareas; ${p.toLowerCase()}`],
  tipo: ["Tareas por tipo", (n, de, parte) => `Los ${n} tipos más frecuentes de ${de} (${parte} % de las tareas)`],
  sociedad: ["Tareas por sociedad", "Según la sociedad de cada persona; tareas en total"],
  area: ["Tareas por área", (n, de, parte) => `Las ${n} áreas con más tareas de ${de}, sumadas entre sociedades (${parte} % de las tareas)`],
  reacciones: ["Tareas que reaccionan a la economía", "Por causa; tareas puestas el mismo día de la causa o en días siguientes", ["El mismo día", "Un día posterior"]],
  textos: ["Origen de los textos", "Textos guardados por mes y fuente", (d) => ` (hasta el ${d})`],
  rechazos: ["Respuestas rechazadas por el validador", "Motivos por texto e intento; un texto rechazado puede sumar varios"],
  resultado: ["Resultado antes de impuestos por sociedad", "Euros por mes cerrado; diciembre lleva la paga extra"],
  caja: ["Caja del grupo y existencias", "Euros al cierre de cada día natural", ["Caja de las nueve sociedades", "Existencias de logística y tienda (a coste)"]],
  cadenas: ["Cadenas completas", "Cuántos documentos llegan a cada paso dentro de la tanda", [
    "Ventas: facturas emitidas", "… cobradas", "… con su movimiento de banco", "… conciliado por tesorería",
    "SAT: facturas de servicio", "… con tarea de cierre", "… cobradas",
    "Reposición: pedidos en borrador", "… aprobados con su tarea", "… recibidos con factura", "… pagados con movimiento",
  ]],
};
for (const f of fs.readdirSync(DIR_IMG)) if (f.endsWith(".svg")) fs.unlinkSync(path.join(DIR_IMG, f));

const COLORES = [["#2a78d6", "#3987e5"], ["#eb6834", "#d95926"], ["#1baf7a", "#199e70"]];
const ESTILO = `<style>
.t{fill:#898781;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:12px}
.ti{font-size:15px;font-weight:600}.st{font-size:12px}.v{font-variant-numeric:tabular-nums}
.g{stroke:#898781;stroke-opacity:.22;stroke-width:1}.ax{stroke:#898781;stroke-opacity:.55;stroke-width:1}
${COLORES.map(([c], i) => `.c${i + 1}{fill:${c}}.l${i + 1}{stroke:${c};fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}`).join("\n")}
@media (prefers-color-scheme:dark){${COLORES.map(([, c], i) => `.c${i + 1}{fill:${c}}.l${i + 1}{stroke:${c}}`).join("")}}
</style>`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const anchoTexto = (s, px = 12) => String(s).length * px * 0.56;

function lienzo(ancho, alto, titulo, subtitulo, cuerpo) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" role="img" aria-labelledby="ti de">
<title id="ti">${esc(titulo)}</title><desc id="de">${esc(subtitulo)}</desc>
${ESTILO}
<text class="t ti" x="0" y="18">${esc(titulo)}</text>
<text class="t st" x="0" y="38">${esc(subtitulo)}</text>
${cuerpo}
</svg>
`;
}
// Barra horizontal con el extremo de datos redondeado (r 4 px) y el lado de la base recto.
function barraH(x0, x1, y, h, clase) {
  if (Math.abs(x1 - x0) < 0.5) return "";
  const r = Math.min(4, h / 2, Math.abs(x1 - x0));
  const s = x1 >= x0 ? 1 : -1;
  return `<path class="${clase}" d="M${x0.toFixed(1)} ${y.toFixed(1)}H${(x1 - s * r).toFixed(1)}Q${x1.toFixed(1)} ${y.toFixed(1)} ${x1.toFixed(1)} ${(y + r).toFixed(1)}V${(y + h - r).toFixed(1)}Q${x1.toFixed(1)} ${(y + h).toFixed(1)} ${(x1 - s * r).toFixed(1)} ${(y + h).toFixed(1)}H${x0.toFixed(1)}Z"/>`;
}
function barraV(x, w, y0, y1, clase) {
  if (Math.abs(y1 - y0) < 0.5) return "";
  const r = Math.min(4, w / 2, Math.abs(y1 - y0));
  return `<path class="${clase}" d="M${x.toFixed(1)} ${y0.toFixed(1)}V${(y1 + r).toFixed(1)}Q${x.toFixed(1)} ${y1.toFixed(1)} ${(x + r).toFixed(1)} ${y1.toFixed(1)}H${(x + w - r).toFixed(1)}Q${(x + w).toFixed(1)} ${y1.toFixed(1)} ${(x + w).toFixed(1)} ${(y1 + r).toFixed(1)}V${y0.toFixed(1)}Z"/>`;
}
function marcas(max, n = 5) {
  if (max <= 0) return [0];
  const paso0 = max / n, mag = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((p) => p >= paso0);
  const out = [];
  for (let v = 0; v <= max + paso * 0.001; v += paso) out.push(Math.round(v * 1e6) / 1e6);
  if (out.at(-1) < max) out.push(out.at(-1) + paso);
  return out;
}
function leyenda(series, x, y) {
  let cx = x, out = "";
  series.forEach((s, i) => {
    out += `<rect class="c${i + 1}" x="${cx}" y="${y - 9}" width="10" height="10" rx="2"/><text class="t" x="${cx + 15}" y="${y}">${esc(s)}</text>`;
    cx += 15 + anchoTexto(s) + 22;
  });
  return out;
}

// Barras horizontales, una serie o apiladas. filas: [{etiqueta, valores:[...] }]
function barrasH({ archivo, titulo, subtitulo, filas, series = null, unidad = "", formato = num, ancho = 760 }) {
  const etiq = Math.min(300, Math.max(...filas.map((f) => anchoTexto(f.etiqueta))) + 12);
  const arriba = series ? 72 : 56, alto_f = 22, h = 14;
  const ys = []; let yAcc = arriba;
  for (const f of filas) { if (f.separar && ys.length) yAcc += 12; ys.push(yAcc); yAcc += alto_f; }
  const totales = filas.map((f) => f.valores.reduce((a, b) => a + b, 0));
  const max = Math.max(...totales);
  const x0 = etiq, x1 = ancho - 70;
  const esc_ = (v) => x0 + (v / max) * (x1 - x0);
  let cuerpo = series ? leyenda(series, 0, 60) : "";
  filas.forEach((f, i) => {
    const y = ys[i];
    cuerpo += `<text class="t" x="${etiq - 8}" y="${y + h - 3}" text-anchor="end">${esc(f.etiqueta)}</text>`;
    let acc = 0;
    f.valores.forEach((v, j) => {
      if (!v) return;
      const a = esc_(acc) + (acc > 0 ? 1 : 0), b = esc_(acc + v) - (j < f.valores.length - 1 && f.valores.slice(j + 1).some(Boolean) ? 1 : 0);
      const ultimo = !f.valores.slice(j + 1).some(Boolean);
      cuerpo += ultimo ? barraH(a, b, y, h, `c${j + 1}`) : `<rect class="c${j + 1}" x="${a.toFixed(1)}" y="${y}" width="${Math.max(0, b - a).toFixed(1)}" height="${h}"/>`;
      acc += v;
    });
    cuerpo += `<text class="t v" x="${(esc_(totales[i]) + 6).toFixed(1)}" y="${y + h - 3}">${esc(formato(totales[i]))}${unidad}</text>`;
  });
  cuerpo += `<line class="ax" x1="${x0}" x2="${x0}" y1="${arriba - 4}" y2="${yAcc - 4}"/>`;
  fs.writeFileSync(path.join(DIR_IMG, archivo), lienzo(ancho, yAcc + 6, titulo, subtitulo, cuerpo));
}

// Columnas por día natural (los días sin trabajo quedan a cero).
function columnasDias({ archivo, titulo, subtitulo, dias, unidad, ancho = 760, alto = 280 }) {
  const iz = 48, de = 10, arriba = 56, abajo = 40;
  const max = Math.max(...dias.map((d) => d.valor));
  const tk = marcas(max, 4), top_ = tk.at(-1);
  const w = (ancho - iz - de) / dias.length;
  const y = (v) => arriba + (1 - v / top_) * (alto - arriba - abajo);
  let cuerpo = "";
  for (const v of tk) cuerpo += `<line class="g" x1="${iz}" x2="${ancho - de}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="t v" x="${iz - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${num(v)}</text>`;
  dias.forEach((d, i) => { cuerpo += barraV(iz + i * w + 1, Math.max(1, w - 2), y(0), y(d.valor), "c1"); });
  dias.forEach((d, i) => {
    if (d.fecha.endsWith("-01") || i === 0) {
      const x = iz + i * w;
      cuerpo += `<line class="ax" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${y(0)}" y2="${y(0) + 6}"/><text class="t" x="${(x + 2).toFixed(1)}" y="${y(0) + 20}">${L.meses[Number(d.fecha.slice(5, 7)) - 1]} ${d.fecha.slice(0, 4)}</text>`;
    }
  });
  cuerpo += `<line class="ax" x1="${iz}" x2="${ancho - de}" y1="${y(0)}" y2="${y(0)}"/>`;
  fs.writeFileSync(path.join(DIR_IMG, archivo), lienzo(ancho, alto, titulo, subtitulo, cuerpo));
}

// Líneas con un solo eje (misma unidad), etiqueta directa al final de cada serie.
function lineas({ archivo, titulo, subtitulo, fechas, series, formato = eurCorto, ancho = 760, alto = 300 }) {
  const iz = 64, de = 92, arriba = 72, abajo = 40;
  const max = Math.max(...series.flatMap((s) => s.valores));
  const tk = marcas(max, 4), top_ = tk.at(-1);
  const x = (i) => iz + (i / (fechas.length - 1)) * (ancho - iz - de);
  const y = (v) => arriba + (1 - v / top_) * (alto - arriba - abajo);
  let cuerpo = leyenda(series.map((s) => s.nombre), 0, 60);
  for (const v of tk) cuerpo += `<line class="g" x1="${iz}" x2="${ancho - de}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="t v" x="${iz - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${formato(v)}</text>`;
  fechas.forEach((f, i) => {
    if (f.endsWith("-01") || i === 0) cuerpo += `<line class="ax" x1="${x(i).toFixed(1)}" x2="${x(i).toFixed(1)}" y1="${y(0)}" y2="${y(0) + 6}"/><text class="t" x="${(x(i) + 2).toFixed(1)}" y="${y(0) + 20}">${L.meses[Number(f.slice(5, 7)) - 1]} ${f.slice(0, 4)}</text>`;
  });
  cuerpo += `<line class="ax" x1="${iz}" x2="${ancho - de}" y1="${y(0)}" y2="${y(0)}"/>`;
  series.forEach((s, j) => {
    cuerpo += `<polyline class="l${j + 1}" points="${s.valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}"/>`;
    const u = s.valores.at(-1);
    cuerpo += `<text class="t v" x="${(x(fechas.length - 1) + 6).toFixed(1)}" y="${(y(u) + 4).toFixed(1)}">${formato(u)}</text>`;
  });
  fs.writeFileSync(path.join(DIR_IMG, archivo), lienzo(ancho, alto, titulo, subtitulo, cuerpo));
}

// Barras horizontales agrupadas con valores negativos (cero en medio).
function agrupadasH({ archivo, titulo, subtitulo, grupos, series, formato = eurCorto, ancho = 760 }) {
  const etiq = 120, arriba = 80, h = 9, sep = 2, hueco = 12;
  const alto_g = series.length * (h + sep) + hueco;
  const vals = grupos.flatMap((g) => g.valores);
  const mn = Math.min(0, ...vals), mx = Math.max(0, ...vals);
  const paso = marcas(mx - mn, 6)[1];
  const lo = Math.floor(mn / paso) * paso, hi = Math.ceil(mx / paso) * paso;
  const ejes = [];
  for (let v = lo; v <= hi + paso / 1000; v += paso) ejes.push(Math.round(v * 1e6) / 1e6);
  const x0 = etiq + 60, x1 = ancho - 60;
  const x = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const fondo = arriba + grupos.length * alto_g;
  let cuerpo = leyenda(series, 0, 60);
  for (const v of ejes) {
    cuerpo += `<line class="${v === 0 ? "ax" : "g"}" x1="${x(v).toFixed(1)}" x2="${x(v).toFixed(1)}" y1="${arriba - 6}" y2="${fondo - hueco + 4}"/><text class="t v" x="${x(v).toFixed(1)}" y="${fondo + 8}" text-anchor="middle">${formato(v)}</text>`;
  }
  grupos.forEach((g, i) => {
    const y = arriba + i * alto_g;
    cuerpo += `<text class="t" x="0" y="${y + (series.length * (h + sep)) / 2 + 3}">${esc(g.etiqueta)}</text>`;
    g.valores.forEach((v, j) => {
      const yy = y + j * (h + sep);
      cuerpo += barraH(x(0), x(v), yy, h, `c${j + 1}`);
      const tx = v >= 0 ? x(v) + 5 : x(v) - 5;
      cuerpo += `<text class="t v" x="${tx.toFixed(1)}" y="${yy + h - 1}" text-anchor="${v >= 0 ? "start" : "end"}" font-size="10">${formato(v)}</text>`;
    });
  });
  fs.writeFileSync(path.join(DIR_IMG, archivo), lienzo(ancho, fondo + 16, titulo, subtitulo, cuerpo));
}

const periodo = T.periodo(T.fechaLarga(DESDE), T.fechaLarga(HASTA));

columnasDias({
  archivo: "tareas-por-dia.svg", titulo: T.dias[0], subtitulo: T.dias[1](periodo),
  dias: R.porDia.map((d) => ({ fecha: d.fecha, valor: d.tareas })), unidad: "tareas al día",
});
barrasH({
  archivo: "tareas-por-app.svg", titulo: T.app[0], subtitulo: T.app[1](num(totalTareas), periodo),
  filas: Object.entries(ordenar(R.apps)).map(([k, v]) => ({ etiqueta: L.app[k] || k, valores: [v] })),
});
{
  const lista = Object.entries(ordenar(R.tipos));
  const n = Math.min(16, lista.length);
  const filas = lista.slice(0, n).map(([k, v]) => ({ etiqueta: L.tipo[k] || k, valores: [v] }));
  const parte = Math.round(lista.slice(0, n).reduce((a, [, v]) => a + v, 0) / totalTareas * 100);
  barrasH({ archivo: "tareas-por-tipo.svg", titulo: T.tipo[0], subtitulo: T.tipo[1](n, lista.length, parte), filas });
}
if (censo) {
  barrasH({
    archivo: "tareas-por-sociedad.svg", titulo: T.sociedad[0], subtitulo: T.sociedad[1],
    filas: Object.entries(ordenar(R.sociedades)).map(([k, v]) => ({ etiqueta: L.soc[k] || k, valores: [v] })),
  });
  const lista = Object.entries(ordenar(R.areas));
  const n = Math.min(15, lista.length);
  const filas = lista.slice(0, n).map(([k, v]) => ({ etiqueta: L.area[k] || k, valores: [v] }));
  const parte = Math.round(lista.slice(0, n).reduce((a, [, v]) => a + v, 0) / totalTareas * 100);
  barrasH({ archivo: "tareas-por-area.svg", titulo: T.area[0], subtitulo: T.area[1](n, lista.length, parte), filas });
}
barrasH({
  archivo: "reacciones-economia.svg", titulo: T.reacciones[0], subtitulo: T.reacciones[1], series: T.reacciones[2],
  filas: Object.entries(reacciones).sort((a, b) => b[1].tareas - a[1].tareas).map(([k, v]) => ({ etiqueta: L.eco[k], valores: [v.mismo_dia, v.tareas - v.mismo_dia] })),
});
barrasH({
  archivo: "textos-por-mes.svg", titulo: T.textos[0], subtitulo: T.textos[1],
  series: Object.keys(ET_FUENTE).map((k) => L.fuente[k]),
  filas: MESES_TANDA.map((m) => ({
    etiqueta: `${L.meses[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}${m === mesDe(HASTA) && HASTA.slice(8) !== "31" ? T.textos[2](Number(HASTA.slice(8))) : ""}`,
    valores: Object.keys(ET_FUENTE).map((k) => R.fuentesMes[m]?.[k] || 0),
  })),
});
barrasH({
  archivo: "rechazos-por-motivo.svg", titulo: T.rechazos[0], subtitulo: T.rechazos[1],
  filas: Object.entries(ordenar(R.rechazos)).map(([k, v]) => ({ etiqueta: L.motivo(k), valores: [v] })),
});
{
  const cerradas = cuentas.filter((c) => c.cerrado).slice(-3);
  agrupadasH({
    archivo: "resultado-mensual.svg", titulo: T.resultado[0], subtitulo: T.resultado[1],
    series: cerradas.map((c) => `${L.meses[Number(c.mes.slice(5)) - 1]} ${c.mes.slice(0, 4)}`),
    grupos: SOCIEDADES.map((s) => ({ etiqueta: L.soc[s], valores: cerradas.map((c) => c.sociedades[s].resultado_antes_impuestos) })),
  });
}
lineas({
  archivo: "caja-y-existencias.svg", titulo: T.caja[0], subtitulo: T.caja[1],
  fechas: R.caja.map((f) => f.fecha),
  series: [
    { nombre: T.caja[2][0], valores: R.caja.map((f) => euros(f.caja_grupo)) },
    { nombre: T.caja[2][1], valores: R.caja.map((f) => euros(f.existencias)) },
  ],
});
{
  const v = cadenas.ventas_y_cobros, s = cadenas.servicio_tecnico, c = cadenas.compras.reposicion_de_existencias;
  const e = T.cadenas[2];
  barrasH({
    archivo: "cadenas.svg", titulo: T.cadenas[0], subtitulo: T.cadenas[1],
    filas: [
      { etiqueta: e[0], valores: [v.emitidas] },
      { etiqueta: e[1], valores: [v.cobradas] },
      { etiqueta: e[2], valores: [v.cobro_con_movimiento_de_banco] },
      { etiqueta: e[3], valores: [v.movimiento_conciliado_por_tesoreria] },
      { etiqueta: e[4], valores: [s.emitidas], separar: true },
      { etiqueta: e[5], valores: [s.con_tarea_de_cierre] },
      { etiqueta: e[6], valores: [s.cobradas] },
      { etiqueta: e[7], valores: [c.pedidos], separar: true },
      { etiqueta: e[8], valores: [c.aprobacion_con_tarea] },
      { etiqueta: e[9], valores: [c.recibidos_con_factura_de_proveedor] },
      { etiqueta: e[10], valores: [c.pago_con_movimiento_de_banco] },
    ],
  });
}

console.log(`tanda: ${DESDE} a ${HASTA} (${DIAS.length} días, ${laborables.length} laborables); ${num(totalTareas)} tareas`);
if (AVISOS.length) console.log("avisos:", AVISOS.join("; "));
const carpetaImg = LANG === "en" ? "img/datos-en/" : "img/datos/";
console.log(`escrito: tools/datos.json y ${fs.readdirSync(DIR_IMG).filter((f) => f.endsWith(".svg")).length} gráficas en ${carpetaImg}`);
if (LANG === "en") {
  const { fichero, sinTraducir: faltan } = escribirReadmeEn(datos, RAIZ);
  for (const k of faltan) sinTraducir.add(k);
  console.log(`escrito: ${fichero}`);
}
if (sinTraducir.size) console.warn(`AVISO: sin traducción al inglés (sale la clave o se omite): ${[...sinTraducir].join("; ")}`);
