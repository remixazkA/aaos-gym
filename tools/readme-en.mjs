#!/usr/bin/env node
// English README of the showcase, written from tools/datos.json so that every figure of the run
// comes from the script (none is typed by hand). estadisticas.mjs --lang en calls it after writing
// datos.json; it can also be run on its own to rewrite the text from an existing datos.json:
//
//   node tools/readme-en.mjs [--salida <showcase root>] [--readme <file name>]
//
// Only the "Earlier tests" section carries fixed figures: they come from runs before this one and
// are not in datos.json.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EN, PUESTO_EN, FAMILIA_EN, ELIMINACION_EN } from "./etiquetas-en.mjs";

export const README_EN = "README.en-borrador.md";

const SOCIEDADES = ["matriz", "logistica", "tienda", "sat", "taller", "maquinaria", "academia", "financiera", "inmobiliaria"];
const SOC_PROSA = {
  matriz: "the holding company", logistica: "logistics", tienda: "retail", sat: "field service", taller: "the workshop",
  maquinaria: "machinery rental", academia: "the academy", financiera: "the finance company", inmobiliaria: "real estate",
};
const SOC_ADJ = {
  matriz: "holding company", logistica: "logistics", tienda: "retail", sat: "field service", taller: "workshop",
  maquinaria: "machinery rental", academia: "academy", financiera: "finance company", inmobiliaria: "real estate",
};
const APP_PROSA = { correo: "email", documentos: "documents", hoja: "spreadsheets", telefono: "phone", banco: "bank", erp: "ERP", crm: "CRM" };
const TIPO_PROSA = {
  correo_interno_coordinacion: ["internal coordination email", "internal coordination emails"],
  correo_al_jefe_avance: ["progress email to a manager", "progress emails to managers"],
  correo_suplente_traspaso: ["handover to a stand-in", "handovers to stand-ins"],
  correo_peticion_documento: ["document request", "document requests"],
  correo_cliente_seguimiento: ["customer follow-up", "customer follow-ups"],
  correo_proveedor_consulta: ["supplier enquiry", "supplier enquiries"],
  correo_confirmacion_pedido: ["wholesale order confirmation", "wholesale order confirmations"],
  correo_aviso_sat_cliente: ["service call acknowledgement", "service call acknowledgements"],
  doc_nota_reunion: ["meeting note", "meeting notes"],
  doc_parte_trabajo: ["work report", "work reports"],
  doc_procedimiento_borrador: ["draft procedure", "draft procedures"],
  doc_resumen_pedidos_web: ["online order summary", "online order summaries"],
  doc_registro_factura_proveedor: ["supplier invoice entry", "supplier invoice entries"],
  banco_conciliacion: ["daily transaction reconciliation", "daily transaction reconciliations"],
  crm_actividad_llamada: ["customer call in the CRM", "customer calls in the CRM"],
  crm_actividad_nota: ["customer note in the CRM", "customer notes in the CRM"],
  tel_nota_llamada: ["call note", "call notes"],
  erp_nota_incidencia: ["ERP issue note", "ERP issue notes"],
  erp_consulta_stock: ["stock check", "stock checks"],
  hoja_control_diario: ["daily control sheet", "daily control sheets"],
  hoja_cuadre: ["balancing sheet", "balancing sheets"],
  erp_aprobar_pedido_borrador: ["purchase order approval", "purchase order approvals"],
  compras_reclamar_proveedor: ["late-delivery chase to a supplier", "late-delivery chases to suppliers"],
  tesoreria_conciliar_banco: ["bank reconciliation", "bank reconciliations"],
  tesoreria_reclamar_cobro: ["payment reminder", "payment reminders"],
  comercial_seguir_moroso: ["delinquent customer follow-up", "delinquent customer follow-ups"],
  direccion_revisar_desviacion: ["budget variance review", "budget variance reviews"],
  academia_matricula: ["academy enrolment", "academy enrolments"],
  taller_cerrar_reparacion: ["workshop repair close-out", "workshop repair close-outs"],
  sat_cerrar_y_facturar: ["service call close-out", "service call close-outs"],
};
const ECO_TIPO = {
  eco_compras_aprobar: "erp_aprobar_pedido_borrador", eco_compras_retrasos: "compras_reclamar_proveedor",
  eco_conciliar_banco: "tesoreria_conciliar_banco", eco_reclamar_cobros: "tesoreria_reclamar_cobro",
  eco_seguir_morosos: "comercial_seguir_moroso", eco_revisar_desviacion: "direccion_revisar_desviacion",
  eco_matricular: "academia_matricula", eco_cerrar_reparacion: "taller_cerrar_reparacion", eco_cerrar_aviso_sat: "sat_cerrar_y_facturar",
};
const ECO_TAREA_TABLA = {
  eco_conciliar_banco: "Bank reconciliation", eco_cerrar_aviso_sat: "Close-out and invoice of the call",
  eco_reclamar_cobros: "Payment reminder", eco_compras_aprobar: "Order approval", eco_cerrar_reparacion: "Repair close-out",
  eco_seguir_morosos: "Delinquent customer follow-up", eco_matricular: "Enrolment", eco_compras_retrasos: "Chase the supplier",
  eco_revisar_desviacion: "Variance review",
};
const MOTIVO_PROSA = {
  vacio: "the text is empty", corto: "the text is too short", largo: "the text is too long", marcador: "a placeholder is malformed",
  llaves: "braces are left unfilled", ruta_local: "a file path appears", nombre_persona: "someone in the census is named",
  nombre_sociedad: "a company name appears", iban: "a bank account is written out", telefono: "a phone number is written out",
  identificador: "an ID number appears", cifra_literal: "a figure is hard-coded", dominio: "a domain is not allowed",
  salud_emocion: "health or emotion vocabulary appears", ranking: "people are compared or scored", palabra_vetada: "a banned word appears",
  referencia_ajena: "a reference unrelated to the task appears", marcador_perdido: "a required placeholder is missing",
  duplicado: "the text nearly duplicates a recent one", json_invalido: "the response is not valid JSON",
  falta_texto: "the text for a task is missing", fallo_escritor: "the text request failed",
};
const MOTIVOS_PRIVACIDAD = new Set(["nombre_persona", "nombre_sociedad", "salud_emocion", "ranking", "iban", "telefono", "identificador", "ruta_local", "dominio", "palabra_vetada"]);
const SITUACION_FACTURA = { cobrada: "have been collected", vigente: "are not yet due", vencida: "are overdue", impagada: "are unpaid" };
const SITUACION_COMPRA = { aprobado: "delivery", facturado: "the payment due date", borrador: "approval" };
const SUCESO_FRASE = {
  pedidos_mayorista: (s) => `${n(s.eventos)} wholesale orders go to sales reps${s.tareas !== s.eventos ? ` as ${n(s.tareas)} tasks` : ""}`,
  pedidos_web: (s) => `${n(s.eventos)} online orders are summarised in ${n(s.tareas)} customer service and catalogue tasks`,
  avisos_sat: (s) => `${n(s.eventos)} service calls go to field technicians${s.tareas !== s.eventos ? ` as ${n(s.tareas)} tasks` : ""}`,
  facturas_proveedor: (s) => `${n(s.eventos)} supplier invoices are entered in ${n(s.tareas)} accounts payable and accounting tasks`,
  movimientos_banco: (s) => `${n(s.eventos)} bank transactions are reconciled in ${n(s.tareas)} treasury tasks`,
};
// Calendar notes for days that stand out in the run.
const NOTA_DIA = { "2026-11-09": "because it was a holiday at some of the sites" };

// Figures from runs before this one; they are not in datos.json.
const ANUAL = [
  ["matriz", 1496558.32, 69065.61, 51799.21], ["logistica", 36400932.16, 1495767.2, 1121825.4],
  ["tienda", 19696429.71, 1045503.76, 784127.82], ["sat", 1315754.81, 123443.2, 92582.4],
  ["taller", 1619370.01, 92421.75, 69316.31], ["maquinaria", 762733.25, 44821.54, 33616.15],
  ["academia", 262804.93, 21087.2, 15815.4], ["financiera", 2310019.13, 1070085.36, 802564.02],
  ["inmobiliaria", 564017.77, 149244.42, 111933.31],
];

// -- formats ------------------------------------------------------------------------------- //

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n = (x) => nf0.format(x);
const eur0 = (x) => { const r = Math.round(x); return (r < 0 ? "−" : "") + "€" + nf0.format(Math.abs(r)); };
const eur2 = (x) => (Math.round(x * 100) < 0 ? "−" : "") + "€" + nf2.format(Math.abs(x));
const eurA = (x) => (Math.round(x * 100) % 100 === 0 ? eur0(x) : eur2(x));
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const ordinal = (k) => k + (k % 100 >= 11 && k % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][k % 10] || "th");
const mes = (f) => EN.meses[Number(f.slice(5, 7)) - 1];
const fecha = (f) => `${Number(f.slice(8, 10))} ${mes(f)} ${f.slice(0, 4)}`;
const fechaCorta = (f) => `${Number(f.slice(8, 10))} ${mes(f)}`;
const diaSemana = (f) => EN.dias[new Date(f + "T12:00:00Z").getUTCDay()];
const diasDelMes = (m) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate();
const mesCompleto = (m, hasta) => !hasta || hasta.slice(0, 7) !== m || Number(hasta.slice(8)) === diasDelMes(m);
const plural = (k, uno, varios) => `${n(k)} ${k === 1 ? uno : varios}`;
const lista = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const listaO = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs.at(-1)}`);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const un = (s) => (/^[aeiou]/i.test(s) ? "An" : "A");
const PALABRAS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const palabra = (k) => PALABRAS[k] || n(k);
function duracion(min) {
  if (min == null) return "—";
  const m = Math.round(min), h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}

// -- the README ------------------------------------------------------------------------------ //

export function textoReadmeEn(d) {
  const faltan = new Set();
  const tr = (mapa, k) => (k in mapa ? mapa[k] : (faltan.add(k), k));
  const puesto = (k) => (k in PUESTO_EN ? PUESTO_EN[k] : (faltan.add(k), null));
  const puestos = (xs) => xs.map((x) => puesto(x.puesto)).filter(Boolean);
  const claveDe = (obj, etiqueta) => Object.keys(obj).find((k) => obj[k].etiqueta === etiqueta);
  const tipoProsa = (k, cuantas) => { const p = TIPO_PROSA[k]; if (!p) faltan.add(k); return p ? (cuantas === 1 ? p[0] : p[1]) : k; };

  const t = d.tanda, ta = d.tareas, ap = d.apps, tx = d.textos, ca = d.cadenas, cy = d.caja_y_existencias, u = d.un_dia_cualquiera;
  const enCurso = t.hasta < t.fin_previsto;
  const meses = Object.keys(d.por_mes).sort();
  const cuentas = d.cuentas_de_resultados;
  const abierto = cuentas.find((c) => !c.cerrado);
  const out = [];
  const p = (...xs) => out.push(...xs, "");

  out.push("<!-- Generated by tools/estadisticas.mjs --lang en (tools/readme-en.mjs) from tools/datos.json. Edit tools/readme-en.mjs, not this file. -->", "");
  p("**English** · [Español](README.es.md)");
  p("# AAOS GYM — A virtual training company");
  p("AAOS is a **simulated** company that serves as a gym and test bench for Ariamir, a local, private AI assistant that uses tools. The company generates working days, documents and transactions so that Ariamir can help from a specific desk and be evaluated in a reproducible environment.");
  // Pictures: label-free crops of the isometric scenes, kept in img/en/.
  p("![Isometric view of an AAOS office](img/en/office.png)"); p("*One of the simulated offices.*");

  p("## Why it exists");
  p("Using office tools takes more than answering questions: an assistant has to understand a task, look up the right information and act within its permissions. AAOS makes it possible to train and measure those skills in a realistic, reproducible workplace, without using anyone's real data.");
  p("What is being evaluated is **Ariamir**. AAOS provides the context and the tasks to test it with.");

  p("## How it works");
  p("### A simulated group");
  p("AAOS represents a group of several companies, with **154 synthetic people** and about **20 rooms**. Its activities cover retail, logistics, field service, a workshop, training, machinery rental, finance and real estate.");
  p("### Working days and tools");
  p("Each person has a schedule generated from their role and the software they use. Tasks leave a trace in tools such as email, documents, spreadsheets, CRM, ERP, bank and phone. Calls are logged with their details and notes.");
  p("### Texts with context");
  p("A local model, running on our own GPU, writes emails and documents from the tasks and their data. A rule-based validator checks the texts before they are saved; for rejected texts, the reasons and a fingerprint are kept, but not the content.");
  p("### An economy that moves hour by hour");
  p("The economic simulation advances in steps of 30, 60 or 120 minutes and uses double-entry accounting. It covers inventory, purchasing, collections and payments, payroll with extra pay, budgets and income statements. It includes quarterly VAT, income tax withholding, Social Security and corporate income tax. The ERP records transactions and their status.");
  p("The holding company provides central services to the subsidiaries, and a shared cash pool collects surpluses and advances cash to cover shortfalls. Demand reacts to stock shortages, and technical jobs wait when there is not enough capacity.");
  p("Transactions between companies are recorded on both sides and eliminated to the cent when the group is consolidated.");
  p("![AAOS workshop](img/en/workshop.png)"); p("*The workshop generates jobs, material use and economic activity.*");
  p("![AAOS machinery yard](img/en/machinery.png)"); p("*Machinery activity is also reflected in the simulated economy.*");
  p("### Ariamir at its desk");
  p("Ariamir is designed to sit at one desk and help the person in that role with the tools and information that reach that desk. Its scope is set by the seat and its permissions. Its full connection to the apps and its actual help during a working day have yet to be verified.");

  // -- the run
  const tick = t.tick_minutos === 60 ? "one-hour steps" : `${t.tick_minutos}-minute steps`;
  p("## A three-month run");
  p(`A long run takes the group **from ${fecha(t.desde)} to ${fecha(t.fin_previsto)}** with the same seed, the economy in ${tick} and the texts written by the local model. `
    + (enCurso
      ? `The run is still going: **the figures in this section go up to ${fecha(t.hasta)}**, the last complete, verified day.`
      : `The run is complete: **the figures in this section cover every day up to ${fecha(t.hasta)}**, all complete and verified.`)
    + " All of them come from [`tools/datos.json`](tools/datos.json), which the script [`tools/estadisticas.mjs`](tools/estadisticas.mjs) generates by reading the run.");
  p("These figures describe a simulated company: they are a training environment, not results from a real company or a measure of the help Ariamir provides.");
  const sit = d.facturas.situacion_al_final;
  const sitTxt = Object.entries(sit).map(([k, v]) => `${n(v)} ${tr(SITUACION_FACTURA, k)}`);
  const rr = d.reacciones_resumen;
  p(`- **${n(t.dias_simulados)} calendar days** simulated, **${n(t.dias_laborables)} of them working days** (at weekends and on holidays only the economy runs).`,
    `- **${n(ta.total)} tasks**, about **${n(Math.round(ta.media_por_dia_laborable))} per working day**, spread across **${n(ta.personas_por_dia_laborable_media)} people** on an average working day and **${n(ta.puestos_distintos)} different roles**.`,
    `- **${n(ap.correos)} emails** (${n(ap.correos_internos)} internal and ${n(ap.correos_externos)} to customers and suppliers), **${n(ap.documentos)} documents**, **${n(ap.libros_de_hoja)} spreadsheets**, **${n(ap.llamadas)} logged calls**, **${n(ap.actividades_crm)} CRM activities** and **${n(ap.movimientos_banco)} bank transactions**.`,
    `- **${n(d.facturas.emitidas_a_terceros)} invoices** to third parties worth **${eur2(d.facturas.importe_emitido_a_terceros)}**; at the end of the period, ${lista(sitTxt)}.`,
    `- **${n(rr.tareas)} tasks** arise in reaction to something that happens in the economy; ${rr.mismo_dia_pct}% arrive on the same day and ${rr.tick_siguiente_pct}% in the tick right after the event.`);

  p("### The work of each day");
  p("![Tasks per calendar day](img/datos-en/tareas-por-dia.svg)");
  const frasesMes = meses.map((m, i) => {
    const x = d.por_mes[m];
    const hasta = mesCompleto(m, x.hasta) ? "" : `, up to the ${ordinal(Number(x.hasta.slice(8)))}`;
    return i === 0 ? `${mes(m + "-01")}${hasta} had ${n(x.laborables)} working days and ${n(x.tareas)} tasks` : `${mes(m + "-01")}${hasta}, ${n(x.laborables)} and ${n(x.tareas)}`;
  });
  const minimo = ta.por_dia.filter((x) => x.tareas > 0).sort((a, b) => a.tareas - b.tareas || a.fecha.localeCompare(b.fecha))[0];
  p(`${frasesMes.join("; ")}. On the quietest working day, ${fechaCorta(minimo.fecha)}, only ${n(minimo.personas)} people worked and there were ${n(minimo.tareas)} tasks${NOTA_DIA[minimo.fecha] ? `, ${NOTA_DIA[minimo.fecha]}` : ""}.`);
  p(`Of the ${n(ta.total)} tasks, **${n(ta.rutina)}** are routine work for the role (coordination emails, work reports, control sheets, calls), **${n(ta.por_sucesos_del_dia)}** come from the day's events (orders, service calls, supplier invoices, transactions) and **${n(ta.por_reaccion_a_la_economia)}** react to the economy tick by tick.`);
  p("![Tasks by app](img/datos-en/tareas-por-app.svg)");
  p("![Tasks by type](img/datos-en/tareas-por-tipo.svg)");
  p("![Tasks by company](img/datos-en/tareas-por-sociedad.svg)");
  p("![Tasks by area](img/datos-en/tareas-por-area.svg)");
  const topPuestos = ta.por_puesto_principales.map((x) => [puesto(x.puesto), x.tareas]).filter(([k]) => k).slice(0, 5);
  p(`The roles with the most tasks are ${lista(topPuestos.map(([k, v]) => `${k} (${n(v)})`))}.`);

  p("### The texts");
  const fu = tx.por_fuente, totalF = Object.values(fu).reduce((a, b) => a + b, 0);
  p(`Every task leaves a text in its app. Of the ${n(totalF)}, **${n(fu.modelo || 0)}** (${pct(fu.modelo || 0, totalF)}) were written by the model at the first attempt, **${n(fu.reintento || 0)}** (${pct(fu.reintento || 0, totalF)}) after a retry with the reasons for the rejection, and **${n(fu.plantilla || 0)}** (${pct(fu.plantilla || 0, totalF)}) are the fixed template for their type, which is used when the model fails twice.`);
  p("![Where the texts come from](img/datos-en/textos-por-mes.svg)");
  const motivos = Object.entries(tx.rechazos_por_motivo);
  const top3 = motivos.slice(0, 3);
  const tecnicos = top3.every(([k]) => !MOTIVOS_PRIVACIDAD.has(k));
  const rech = (k) => tx.rechazos_por_motivo[k]?.rechazos || 0;
  p(`The validator logged **${n(tx.rechazos_total)} rejection reasons**. The most frequent are ${tecnicos ? "technical" : "these"}: ${listaO(top3.map(([k, v]) => `${tr(MOTIVO_PROSA, k)} (${n(v.rechazos)})`))}. The privacy rules also kick in: there were ${n(rech("nombre_persona"))} rejections for naming someone in the census and ${n(rech("salud_emocion"))} for health or emotion vocabulary, and none of those texts was saved.`);
  p("![Responses rejected by the validator](img/datos-en/rechazos-por-motivo.svg)");

  // -- chains
  const reac = d.reacciones_a_la_economia;
  p("## How it all links together");
  p(`Nothing happens in isolation. Events that move money leave their entry in the books of the companies involved and, depending on the case, documents in the ERP and transactions in the bank; the others (an order drafted or approved, a delay, a reminder, a customer flagged as delinquent) carry no entry. ${cap(palabra(Object.keys(reac).length))} kinds of event, the ones in the table [below](#from-event-to-task), also create a task for someone with the right role, company, app and, where needed, approval limit: in the next tick or, if nobody has room, first thing on the next day with someone available. Bank transactions are grouped in batches, so many of them produce a single task.`);
  p("```mermaid",
    "flowchart LR",
    "  subgraph V[\"Sales and collections\"]",
    "    PED[\"Customer order\"] --> ALB[\"Delivery note\"] --> FAC[\"Invoice\"] --> COB[\"Collection\"] --> MOV[\"Bank transaction\"] --> CON[\"Reconciliation\"]",
    "    FAC -.->|falls due unpaid| REC[\"Payment reminder\"]",
    "    REC -.->|still unpaid| MOR[\"Delinquent customer\"]",
    "    FAC -.->|default| PRV[\"Provision and write-off\"]",
    "  end",
    "  subgraph C[\"Purchasing\"]",
    "    STK[\"Stock below the reorder point\"] --> BOR[\"Draft order\"] --> APR[\"Approval by limit\"] --> RCP[\"Receipt\"] --> FPV[\"Supplier invoice\"] --> PAG[\"Payment at 30-60 days\"]",
    "    APR -.->|delayed| RET[\"Chase the supplier\"]",
    "  end",
    "  subgraph S[\"Field service\"]",
    "    AVI[\"Customer service call\"] --> INT[\"Job: hours and, sometimes, spare parts\"] --> FSA[\"Service invoice\"] --> CIE[\"Call closed\"]",
    "  end",
    "  RCP -->|restocks| STK",
    "  PAG --> MOV",
    "  FSA --> COB",
    "  INT -.->|if it uses parts, bought from the supplier| FPV",
    "```");
  p("- **Sale → invoice → collection → bank → reconciliation.** The shop is paid up front through the payment gateway, which settles the receipts in a single transaction per tick; business customers pay at 30, 45 or 60 days, and some pay late. Every bank transaction goes into the reconciliation task of its company's treasury or of the cash pool. If an invoice falls due unpaid, treasury chases it; if the delay continues, the sales rep follows up the delinquent customer. Among invoices that stay with the selling company, only those that end up unpaid are provisioned: 50% at 20 days past the due date, and at 60 days they are written off. Invoices sold through factoring are provisioned by the finance company by age, on the same schedule, and the provision is reversed if they are collected in the end.",
    "- **Low stock → purchase order → approval → receipt → supplier invoice → payment.** Items that end a tick below their reorder point come out as drafts in the next one; the economy then assigns the approval to someone with a limit for that amount and, in the next tick, the task reaches them. If the supplier is late, purchasing chases them. Receipt increases inventory and records the supplier's invoice, which is paid on its terms.",
    "- **Service call → repair → invoice.** The day's service calls reach the field technician, who acknowledges them to the customer. In the economy, each job uses hours and sometimes spare parts (bought from the supplier) and is invoiced; in the next tick, field service administration closes the call and its invoice. Maintenance contracts add monthly fees.",
    "- **Taxes, payroll and structure.** Payroll is paid on the last working day of each month and the extra pay in December; Social Security is settled every month, VAT and income tax withholding every quarter, and corporate income tax is accrued at each month-end.");
  p("```mermaid",
    "flowchart TB",
    "  MAT[\"Holding company<br/>management, administration, IT and cash pool\"]",
    "  FIL[\"Subsidiaries\"]",
    "  MAT -->|monthly central services invoice| FIL",
    "  MAT <-->|\"cash surpluses and advances, with interest\"| FIL",
    "  MAT -->|loan with interest| FIN[\"Finance\"]",
    "  FIN -->|\"purchases at 0% and with interest\"| TIE[\"Retail\"]",
    "  TIE -->|\"subsidises the 0%\"| FIN",
    "  LOG[\"Logistics\"] -->|\"sells invoices (factoring)\"| FIN",
    "  FIN -->|renting for rental customers| MAQ[\"Machinery rental\"]",
    "  TAL[\"Workshop\"] -->|\"repairs the fleet (internal invoice)\"| MAQ",
    "  ACA[\"Academy\"] -->|\"trains the group's staff\"| FIL",
    "```");
  const formacion = d.facturas.intragrupo.formacion_interna;
  p("- **Central services:** every month the holding company invoices the eight subsidiaries for the group's management, administration and IT.",
    "- **Cash pool:** the subsidiaries deposit their surpluses with the holding company and receive advances when a tick leaves their cash negative; balances earn daily interest both ways.",
    "- **Finance:** it finances retail purchases at 0% (retail pays the subsidy) or with interest, buys logistics invoices at 30-60 days (non-recourse factoring), provides renting to machinery customers and personal loans, and is funded by a loan from the holding company and a bank credit line.",
    "- **Workshop ↔ machinery rental:** breakdowns in the rental fleet go to the workshop, which issues an internal invoice; the machine is out of service for a few days.",
    `- **Academy:** besides its own students, it trains the group's staff in February, May and October with internal invoices; ${formacion ? `this run includes ${plural(formacion, "internal training invoice", "internal training invoices")}` : "none of those sessions falls within this run"}.`);
  p("All these internal transactions appear in both companies for the same amount and are eliminated on consolidation (see the economy, below).");

  p("### From event to task");
  p("```mermaid",
    "flowchart LR",
    "  T1[\"Tick N<br/>the economy records the event\"] --> REG[\"Event rule<br/>company, area, role, app and limit\"]",
    "  REG --> T2[\"Tick N+1<br/>task for a person in that role\"]",
    "  REG -.->|nobody available| T3[\"First thing on the next day<br/>with someone in the role, up to 7 days\"]",
    "```");
  const filasEco = Object.entries(reac).sort((a, b) => b[1].tareas - a[1].tareas);
  p("| Event in the economy | Task it creates | Who gets it (main roles) | Events | Tasks | Same day | Median delay |",
    "|---|---|---|---:|---:|---:|---:|",
    ...filasEco.map(([k, v]) => `| ${tr(EN.eco, k)} | ${tr(ECO_TAREA_TABLA, k)} | ${puestos(v.puestos).join(", ")} | ${n(v.eventos)} | ${n(v.tareas)} | ${pct(v.mismo_dia, v.tareas)} | ${duracion(v.retraso_mediano_min)} |`));
  const horasMax = Math.round(Math.max(...filasEco.map(([, v]) => v.retraso_mediano_min || 0)) / 60);
  p(`Bank transactions are reconciled in batches. Whatever happens late in the day, at the weekend or at month-end moves to first thing on the next working day, hence median delays of up to about ${n(horasMax)} hours.`);
  p("![Tasks that react to the economy](img/datos-en/reacciones-economia.svg)");
  const frasesSuceso = Object.entries(d.sucesos_del_dia).map(([k, s]) => (SUCESO_FRASE[k] ? SUCESO_FRASE[k](s) : (faltan.add(k), `${n(s.eventos)} ${k}`)));
  p(`On top of that, the seed's daily events are handed out by fixed rules: ${lista(frasesSuceso)}.`);

  p("### Complete chains");
  p("![Complete chains](img/datos-en/cadenas.svg)");
  const v = ca.ventas_y_cobros, s = ca.servicio_tecnico, c = ca.compras.reposicion_de_existencias, ms = ca.compras.materiales_de_servicios;
  const ta_ = ca.taller, tm = ca.taller_a_maquinaria, ac = ca.academia, mq = ca.maquinaria_alquileres;
  const albaran = d.facturas.con_albaran_de_pedido;
  const todas = (k, total) => (k === total ? "all" : n(k));
  const esperan = Object.entries(c.por_situacion_al_final).filter(([k]) => k !== "pagado").map(([k, x]) => `${tr(SITUACION_COMPRA, k)} (${n(x)})`);
  p(`- **Logistics and retail sales:** ${n(v.emitidas)} invoices, ${albaran >= v.emitidas ? "all" : n(albaran)} with the delivery note of their order; ${n(v.cobradas)} collected, ${todas(v.cobro_con_movimiento_de_banco, v.cobradas)} with their bank transaction, and ${n(v.movimiento_conciliado_por_tesoreria)} of those transactions already reconciled by treasury. That makes **${n(v.movimiento_conciliado_por_tesoreria)} complete chains** (${pct(v.movimiento_conciliado_por_tesoreria, v.emitidas)}); for the rest, the invoice has not been collected yet or its transaction is waiting for reconciliation.`,
    `- **Field service:** ${n(s.emitidas)} service invoices, ${n(s.con_tarea_de_cierre)} with their close-out task and ${s.movimiento_conciliado_por_tesoreria === s.cobradas ? `${n(s.cobradas)} collected and reconciled` : `${n(s.cobradas)} collected (${n(s.movimiento_conciliado_por_tesoreria)} reconciled)`}.`,
    `- **Restocking:** ${n(c.pedidos)} draft orders, ${c.aprobacion_con_tarea === c.pedidos ? `all ${n(c.pedidos)}` : n(c.aprobacion_con_tarea)} approved with their task, ${n(c.recibidos_con_factura_de_proveedor)} received with the supplier's invoice and **${n(c.pago_con_movimiento_de_banco)} paid** with their bank transaction: the whole chain from low stock to payment.${esperan.length ? ` The rest are waiting for ${listaO(esperan)}.` : ""}`,
    `- **Other chains:** the workshop issued ${n(ta_.emitidas)} invoices (${n(ta_.con_tarea_de_cierre)} with their close-out and ${n(ta_.cobradas)} collected, because its customers pay on terms) and ${n(tm.emitidas)} internal invoices to machinery rental; the academy, ${n(ac.emitidas)} invoices with their ${n(ac.con_tarea_de_cierre)} enrolments, ${ac.cobradas === ac.emitidas ? "all collected" : `${n(ac.cobradas)} collected`}; machinery rental, ${n(mq.emitidas)} rental invoices with ${n(mq.cobradas)} collected. Field service and the workshop bought materials in ${n(ms.pedidos)} orders received on the spot, of which ${n(ms.pagados)} have already been paid.`);

  // -- economy
  p("## The run's economy");
  const cab = cuentas.map((x) => `${mes(x.mes + "-01")}${x.cerrado ? "" : " *"}`);
  p("Revenue by company and month, in rounded euros."
    + (abierto ? ` ${mes(abierto.mes + "-01")} (*) runs to the ${ordinal(Number(abierto.hasta.slice(8)))} and is not closed: it is still missing payroll, central services and tax, which are booked on the last working day or at month-end.` : ""));
  p(`| Company | ${cab.join(" | ")} |`, `|---|${cab.map(() => "---:").join("|")}|`,
    ...SOCIEDADES.map((k) => `| ${EN.soc[k]} | ${cuentas.map((x) => eur0(x.sociedades[k].ingresos)).join(" | ")} |`),
    `| Sum of companies | ${cuentas.map((x) => eur0(x.consolidado.ingresos_sumados)).join(" | ")} |`,
    `| Intragroup eliminations | ${cuentas.map((x) => eur0(-x.consolidado.eliminaciones_intragrupo)).join(" | ")} |`,
    `| **Consolidated group** | ${cuentas.map((x) => `**${eur0(x.consolidado.ingresos_consolidados)}**`).join(" | ")} |`);
  p("Pre-tax profit by company and month:");
  p(`| Company | ${cab.join(" | ")} |`, `|---|${cab.map(() => "---:").join("|")}|`,
    ...SOCIEDADES.map((k) => `| ${EN.soc[k]} | ${cuentas.map((x) => eur0(x.sociedades[k].resultado_antes_impuestos)).join(" | ")} |`),
    `| **Consolidated group** | ${cuentas.map((x) => `**${eur0(x.consolidado.resultado_antes_impuestos)}**`).join(" | ")} |`,
    `| Corporate income tax | ${cuentas.map((x) => (x.cerrado ? eur0(x.consolidado.impuesto_sociedades) : "not yet accrued")).join(" | ")} |`,
    `| **Group result** | ${cuentas.map((x) => (x.cerrado ? `**${eur0(x.consolidado.resultado)}**` : "not closed")).join(" | ")} |`);
  p("![Pre-tax profit by company](img/datos-en/resultado-mensual.svg)");
  const frases = [];
  const diciembre = cuentas.find((x) => x.cerrado && x.mes.endsWith("-12"));
  if (diciembre) {
    const perdidas = SOCIEDADES.filter((k) => diciembre.sociedades[k].resultado_antes_impuestos < 0).map((k) => SOC_PROSA[k]);
    frases.push(`December includes the extra pay${perdidas.length ? `: ${lista(perdidas)} close the month at a loss` : ""}.`);
  }
  const primero = cuentas.find((x) => x.cerrado);
  if (primero) {
    const cuadran = cuentas.every((x) => x.consolidado.detalle_eliminaciones.every((e) => e.contrapartida_cuadra !== false));
    const partidas = primero.consolidado.detalle_eliminaciones.filter((e) => Math.round(e.importe) !== 0).sort((a, b) => b.importe - a.importe)
      .map((e) => `${eur0(e.importe)} of ${tr(ELIMINACION_EN, e.concepto)}`);
    frases.push(`${cuadran ? "Intragroup eliminations match their counterpart to the cent" : "Not every intragroup elimination matches its counterpart"}: in ${mes(primero.mes + "-01")}, ${lista(partidas)}. The consolidated result does not change when they are eliminated.`);
  }
  if (frases.length) p(frases.join(" "));
  p("![Group cash and inventory](img/datos-en/caja-y-existencias.svg)");
  const cajaM = cy.caja_final_por_sociedad.matriz;
  const pequenas = SOCIEDADES.filter((k) => k !== "matriz").every((k) => cy.caja_final_por_sociedad[k] < cajaM * 0.05);
  const lo = cy.comercial_final.logistica, ti = cy.comercial_final.tienda;
  const fin = d.financiera, np = fin.operaciones_nuevas_por_producto, arr = fin.cartera_de_arranque_por_producto;
  const prod = (o, k) => o[k] || { operaciones: 0, principal: 0 };
  const fam = (k) => d.banco.por_familia[k] || { movimientos: 0, entradas: 0, salidas: 0 };
  const colaFin = cy.cola_servicios_final;
  p(`- **Cash:** across the nine companies it goes from ${eur0(cy.caja_grupo_inicio)} to ${eur0(cy.caja_grupo_final)}; the holding company's cash pool holds ${eur0(cajaM)}${pequenas ? " and the subsidiaries keep small balances" : ""}.`,
    `- **Inventory:** logistics and retail inventory ${cy.existencias_final <= cy.existencias_inicio ? "falls" : "rises"} from ${eur0(cy.existencias_inicio)} to ${eur0(cy.existencias_final)} at cost, with ${n(cy.unidades_final)} units at the end.`,
    `- **Unserved demand:** logistics left ${plural(lo.ventas_perdidas_unidades, "unit", "units")} unserved (${eur2(lo.ventas_perdidas)}; it served ${lo.nivel_de_servicio_pct}% of what was ordered) and retail ${n(ti.ventas_perdidas_unidades)} (${eur2(ti.ventas_perdidas)}; ${ti.nivel_de_servicio_pct}%). The queue of orders waiting for stock peaked at ${n(cy.cola_stock_maxima_unidades)} units and the queue of technical jobs at ${n(cy.cola_servicios_maxima)}; on ${fechaCorta(t.hasta)}, ${plural(colaFin.sat.cola, "call was", "calls were")} still open at field service and ${plural(colaFin.taller.cola, "job", "jobs")} at the workshop.`,
    `- **Finance:** ${n(prod(np, "tienda_cero").operaciones)} retail purchases at 0% (${eurA(prod(np, "tienda_cero").principal)}), ${n(prod(np, "tienda").operaciones)} with interest (${eurA(prod(np, "tienda").principal)}), ${plural(prod(np, "personales").operaciones, "personal loan", "personal loans")} (${eurA(prod(np, "personales").principal)}) and ${plural(prod(np, "renting").operaciones, "renting deal", "renting deals")} (${eurA(prod(np, "renting").principal)}), all granted within the run (the starting portfolio of ${plural(prod(arr, "personales").operaciones, "personal loan", "personal loans")} and ${plural(prod(arr, "renting").operaciones, "renting deal", "renting deals")} is counted separately); ${n(fin.factoring.facturas_cedidas)} logistics invoices sold through factoring for ${eurA(fin.factoring.cedido)}, of which ${eurA(fin.factoring.cobrado)} has already been collected.`,
    `- **Payroll and taxes in the bank:** ${plural(fam("Nóminas").movimientos, "payroll payment", "payroll payments")} (${eurA(fam("Nóminas").salidas)}), ${plural(fam("Pagas extra").movimientos, "extra-pay payment", "extra-pay payments")} (${eurA(fam("Pagas extra").salidas)}), ${plural(fam("Seguridad Social").movimientos, "Social Security settlement", "Social Security settlements")} (${eurA(fam("Seguridad Social").salidas)}), ${plural(fam("Retenciones de IRPF").movimientos, "income tax withholding payment", "income tax withholding payments")} (${eurA(fam("Retenciones de IRPF").salidas)}) and ${plural(fam("IVA trimestral").movimientos, "VAT transaction", "VAT transactions")} (${eurA(fam("IVA trimestral").salidas)} paid and ${eurA(fam("IVA trimestral").entradas)} received).`,
    `- **Other:** ${plural(cy.alquileres_de_maquinaria_activos_final, "active machinery rental", "active machinery rentals")} and ${plural(cy.inmuebles_ocupados_final, "occupied property", "occupied properties")} at the end of the period.`);

  // -- an ordinary day
  p("## An ordinary day");
  p(`**${diaSemana(u.fecha)} ${fecha(u.fecha)}** was the working day closest to the average (${n(u.tareas)} tasks against ${n(u.media_laborable)}).`);
  const tiposDia = u.tipos_principales.map((x) => { const k = claveDe(ta.por_tipo, x.tipo); return `${tipoProsa(k ?? x.tipo, x.tareas)} (${n(x.tareas)})`; });
  const reacDia = Object.entries(u.reacciones_a_la_economia);
  const ec = u.economia;
  const sinServir = Object.entries(ec.unidades_no_servidas).filter(([, x]) => x > 0);
  const textoSinServir = sinServir.length
    ? `${cap(SOC_PROSA[sinServir[0][0]])} left ${plural(sinServir[0][1], "unit", "units")} unserved${sinServir.slice(1).map(([k, x]) => ` and ${SOC_PROSA[k]} ${n(x)}`).join("")}.`
    : "All demand was served.";
  const lineasDia = [
    `- **People and tasks:** ${n(u.personas)} people worked in ${n(u.puestos_distintos)} roles. Tasks were split across ${lista(Object.entries(u.por_app).map(([k, x]) => `${tr(APP_PROSA, k)} (${n(x)})`))}. The most frequent were ${lista(tiposDia)}.`,
    `- **Reactions to the economy:** ${n(reacDia.reduce((a, [, x]) => a + x, 0))} tasks: ${lista(reacDia.map(([k, x]) => `${n(x)} ${tipoProsa(ECO_TIPO[k], x)}`))}.`,
    `- **Economy:** ${n(ec.ticks)} ${t.tick_minutos === 60 ? "one-hour" : `${t.tick_minutos}-minute`} ticks with ${n(ec.sucesos)} events, mostly ${lista(ec.familias_principales.slice(0, 5).map((x) => `${tr(FAMILIA_EN, x.familia)} (${n(x.sucesos)})`))}. ${cap(plural(ec.facturas_nuevas, "invoice was", "invoices were"))} issued for ${eurA(ec.importe_facturado)}, there were ${plural(ec.movimientos_banco, "bank transaction", "bank transactions")} (${n(ec.cobros_de_clientes)} of them customer receipts) and group cash went from ${eur0(ec.caja_grupo_inicio)} to ${eur0(ec.caja_grupo_fin)}. ${textoSinServir}`,
  ];
  const cadenasDia = [];
  if (u.ejemplo_sat) {
    const e = u.ejemplo_sat, quien = puesto(e.cierre.puesto) || "the right role";
    cadenasDia.push(`a field service invoice issued in the ${e.factura_a_las} tick reached ${quien}${e.cierre.fecha !== u.fecha ? ` on ${fechaCorta(e.cierre.fecha)}` : ""} at ${e.cierre.hora} as a close-out task, and ${e.cobrada ? "it has been collected" : "it is still awaiting payment"}.`);
  }
  if (u.ejemplo_compra) {
    const e = u.ejemplo_compra, k = claveDe(ta.por_sociedad || {}, e.sociedad), adj = k ? SOC_ADJ[k] : "group";
    const quien = puesto(e.puesto);
    cadenasDia.push(`${un(adj)} ${adj} purchase order that went to approval in the ${e.causa_a_las} tick${e.causa_fecha !== u.fecha ? ` on ${fechaCorta(e.causa_fecha)}` : ""} reached ${quien ? `the ${quien}` : "an approver"} at ${e.tarea_a_las} as a task; that role has the approval limit for the amount.`);
  }
  if (cadenasDia.length) lineasDia.push(`- **${cadenasDia.length === 2 ? "Two chains" : "One chain"}:** ${cadenasDia[0]}${cadenasDia[1] ? ` ${cadenasDia[1]}` : ""}`);
  p(...lineasDia);

  // -- earlier tests (fixed figures)
  p("## Earlier tests");
  p("These figures come from runs and tests before the three-month run.");
  p("- **Size:** 154 synthetic people, nine companies and about 20 rooms.",
    "- **Activity:** one test day generated **800 tasks**. A longer run produced **15,310 tasks over 19 working days**, about **806 per working day** on average.",
    "- **Pace:** that run produced **25 simulated calendar days in 10.9 real hours**, about **55 simulated days per real day** with that setup.",
    "- **Automated tests:** a later suite for the economy and the working days completed **389 tests**, with no failures and none skipped.");
  p("A simulated full-year run gave the following figures by company. Amounts include transactions between companies, and the results reflect costs and depreciation, before and after corporate income tax. Revenue should not be added up without eliminating internal transactions.");
  p("| Company | Revenue | Pre-tax profit | Profit after tax |", "|---|---:|---:|---:|",
    ...ANUAL.map(([k, a, b, c2]) => `| ${EN.soc[k]} | ${eur2(a)} | ${eur2(b)} | ${eur2(c2)} |`));

  // -- privacy, status, regeneration
  p("## Privacy and red lines");
  p("The people, organisations and data in AAOS are synthetic. Ariamir is designed to help with work, not to monitor people.");
  p("- It does not score or profile people and does not make employment decisions.",
    "- Any text that puts a person or role placeholder in the same sentence as a term from the health vocabulary is rejected without exception, even when negated. It is a text rule, not a general understanding of language.",
    "- It does not use cameras or biometrics, and it does not infer emotions.",
    "- Its scope must be visible and limited to the role and the authorised purpose.",
    "- The person must be able to switch the assistant off.");
  p("The figures in this document are counted by role, area and company, never by person. Some roles, such as the cash-pool treasurer, the managing director or the workshop manager, are held by a single synthetic person, so their figures are that person's.");

  p("## Status");
  p("- The simulated group, the working days, text generation and the tick-based economy are built, with automated tests.",
    `- The code went through six rounds of independent audit and was closed except for a minor robustness detail when resuming, with no effect on the data. ${enCurso
      ? `The long run with the audited code is advancing to ${fecha(t.fin_previsto)}; this document covers its complete days up to ${fechaCorta(t.hasta)}.`
      : `The long run with the audited code reached ${fecha(t.fin_previsto)}; this document covers all its days.`}`,
    "- Tasks that come from the seed's daily events are not yet linked to the documents of the tick-based economy: their references do not appear in the run's ERP or bank.",
    "- Ariamir's full connection to the apps, its permissions and its effects over a working day still have to be verified.",
    "- A measurement campaign is still needed that compares working days with and without help and records usefulness, failures and compute cost.",
    "- A collaboration with a supercomputing centre is being considered to extend and repeat the experiments; it is a proposal, not a result.");

  p("## How the figures are regenerated");
  p("```", "node tools/estadisticas.mjs --tanda <run folder> --censo <people census> --lang en", "```");
  p("The script only uses Node. It reads the days that have a complete manifest and follow on from the first one, checks the fingerprint of every file and rewrites `tools/datos.json`, the charts in `img/datos-en/` and this document (as the draft `README.en-borrador.md`; `node tools/readme-en.mjs --readme README.md` writes it straight here from `tools/datos.json`). The census is required, and only each person's company and area are taken from it; without it, the script stops with a warning and writes nothing, so the charts by company and area linked here are never missing. `--hasta YYYY-MM-DD` stops at a given day. Field names in `tools/datos.json` are in Spanish."
    + (enCurso ? ` When the run reaches ${fecha(t.fin_previsto)}, running it again updates every figure in this document.` : ""));
  out.push("---", "");
  out.push("The project code is in a private repository of the organisation. AAOS and Ariamir are built with the help of AI agents and of Ariamir itself.");

  return { texto: out.join("\n") + "\n", sinTraducir: [...faltan] };
}

export function escribirReadmeEn(datos, raiz, nombre = README_EN) {
  const { texto, sinTraducir } = textoReadmeEn(datos);
  fs.writeFileSync(path.join(raiz, nombre), texto);
  return { fichero: nombre, sinTraducir };
}

// -- standalone ------------------------------------------------------------------------------- //

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = {};
  for (let i = 2; i < process.argv.length; i++) if (process.argv[i].startsWith("--")) args[process.argv[i].slice(2)] = process.argv[++i];
  const raiz = path.resolve(args.salida || path.join(path.dirname(fileURLToPath(import.meta.url)), ".."));
  const datos = JSON.parse(fs.readFileSync(path.join(raiz, "tools", "datos.json"), "utf8"));
  const { fichero, sinTraducir } = escribirReadmeEn(datos, raiz, args.readme || README_EN);
  console.log(`escrito: ${fichero} (datos hasta ${datos.tanda.hasta})`);
  if (sinTraducir.length) console.warn(`AVISO: sin traducción al inglés (sale la clave o se omite): ${sinTraducir.join("; ")}`);
}
