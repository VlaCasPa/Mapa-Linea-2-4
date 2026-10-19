import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC1XakVAZLUDq3-240Q_KoYYPU5JKCTjzs",
    authDomain: "metrol2-iam-central.firebaseapp.com",
    projectId: "metrol2-iam-central",
    storageBucket: "metrol2-iam-central.firebasestorage.app",
    messagingSenderId: "78845391762",
    appId: "1:78845391762:web:d64611cd7c4ef65a24074b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 
const provider = new GoogleAuthProvider();

const REPO_ACTUAL = "Mapa-Linea-2-4";
const STORAGE_KEY_DISCLAIMER = "ccm2l_mapa_linea_2_4_disclaimer_accepted_v1";

document.addEventListener("DOMContentLoaded", () => {
    // Forzar visualización directa de la app y arrancar el motor para evitar pantallas en blanco
    const appPrincipal = document.getElementById('app-principal');
    if (appPrincipal) appPrincipal.style.display = 'flex';
    iniciarMotorDelMapa();
});

let map, grupoMarcadores, marcadoresGuardados = [], filtroActualEstado = "Todos";
window.dataObrasGlobal = []; window.dataDesviosGlobal = [];
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";
const normalizarTexto = (str) => str ? String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

const dataMinCultura = {
    "E13": [
        { fase: "Primera Fase", res: "RDN° 000116-2023-DGPC/MC", fecha: "09/06/2023" },
        { fase: "Segunda Fase", res: "Resolución Directoral N° 000244-2024-DGPC-VMPCIC/MC", fecha: "26/09/2024" },
        { fase: "Tercera Fase", res: "Resolución Directoral N° 000037-2026-DGPC-VMPCIC/MC", fecha: "03/07/2026" }
    ],
    "PV12": [
        { fase: "Primera Fase", res: "RDN° 000116-2023-DGPC/MC", fecha: "09/06/2023" },
        { fase: "Segunda Fase", res: "Resolución Directoral N° 000244-2024-DGPC-VMPCIC/MC", fecha: "26/09/2024" }
    ],
    "PV13": [
        { fase: "Segunda Fase", res: "Resolución Directoral N° 000244-2024-DGPC-VMPCIC/MC", fecha: "26/09/2024" }
    ]
};

function iniciarMotorDelMapa() {
    if (map) return; 
    map = L.map('map', { zoomControl: false }).setView([-12.055, -77.050], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], className: 'mapa-google-gris' }).addTo(map);
    grupoMarcadores = L.featureGroup().addTo(map);

    Papa.parse(urlCSV, {
        download: true, header: true,
        complete: function(results) {
            let tCriticos=0, tTramite=0, tAlerta=0, tLey=0, tCulminado=0;
            window.dataObrasGlobal = []; window.dataDesviosGlobal = [];

            results.data.forEach(item => {
                if (item.Latitud && item.Longitud && item.ID) {
                    let evalObra = evaluarRiesgo(item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Comentarios);
                    let evalDesvio = evaluarRiesgo(item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Comentarios);
                    
                    if (evalObra.estadoRiesgo === 'CRITICO_SIN_ACCION' || evalDesvio.estadoRiesgo === 'CRITICO_SIN_ACCION') tCriticos++;
                    if (evalObra.esTramite || evalDesvio.esTramite) tTramite++;
                    
                    let sev = determinarSeveridadVisual(evalObra, evalDesvio);
                    if (sev === 'ALERTA_TEMPRANA') tAlerta++;
                    if (sev === 'LEY31955') tLey++;
                    if (sev === 'CULMINADO') tCulminado++;

                    window.dataObrasGlobal.push({ id: item.ID, resolucion: item.Aut_Obra_Resolucion, dias: evalObra.diasValor, estado: evalObra.estadoRiesgo, orig: item.Aut_Obra_Dias_Restantes });
                    window.dataDesviosGlobal.push({ id: item.ID, resolucion: item.Aut_Desvio_Resolucion, dias: evalDesvio.diasValor, estado: evalDesvio.estadoRiesgo, orig: item.Aut_Desvio_Dias_Restantes });

                    let lat = parseFloat(item.Latitud.toString().replace(/,/g, '.'));
                    let lon = parseFloat(item.Longitud.toString().replace(/,/g, '.'));
                    
                    if (!isNaN(lat)) {
                        let marker = L.circleMarker([lat, lon], { radius: 7, fillColor: "#2563EB", color: "#ffffff", weight: 2, fillOpacity: 0.95 });
                        aplicarEstiloMarcador(marker, sev);
                        
                        let htmlMinCultura = '';
                        if (dataMinCultura[item.ID]) {
                            let historialFases = dataMinCultura[item.ID].map(f => 
                                `<div class="mb-2 border-b border-indigo-100 pb-1 last:border-0">
                                    <span class="etiqueta-fase">${f.fase}</span><br>
                                    <span class="text-[0.7rem] text-slate-700 font-bold">Res: ${f.res}</span><br>
                                    <span class="text-[0.65rem] text-slate-500">Emitida: ${f.fecha}</span>
                                </div>`
                            ).join('');
                            htmlMinCultura = `<div class="auth-box estado-patrimonio mt-2"><span class="font-bold block mb-1 text-indigo-900">🏛️ Patrimonio (Min. Cultura)</span>${historialFases}</div>`;
                        }

                        marker.bindPopup(`
                            <div class="popup-container">
                                <h3 class="popup-title font-bold text-sm">${item.ID}: ${item.Nombre}</h3>
                                <div class="popup-subtitle text-xs text-gray-500 mb-2">📍 ${item.Municipalidad}</div>
                                <div class="auth-box ${obtenerClaseCSS(evalObra.estadoRiesgo)}"><b>Obra:</b> ${formatearTextoPopup(evalObra)}</div>
                                <div class="auth-box ${obtenerClaseCSS(evalDesvio.estadoRiesgo)}"><b>Desvío:</b> ${formatearTextoPopup(evalDesvio)}</div>
                                ${htmlMinCultura}
                            </div>
                        `);
                        marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'font-bold bg-white/90 px-1 rounded shadow-sm text-[0.65rem]' });
                        marcadoresGuardados.push({ id: item.ID, marcador: marker, datos: item, evalObra: evalObra, evalDesvio: evalDesvio, severidadGlobal: sev, lat: lat, lon: lon });
                    }
                }
            });

            document.getElementById('kpi-rojo').innerText = tCriticos;
            document.getElementById('kpi-morado').innerText = tTramite;
            document.getElementById('kpi-amarillo').innerText = tAlerta;
            document.getElementById('kpi-naranja').innerText = tLey;
            document.getElementById('kpi-verde').innerText = tCulminado;

            renderizarTablasCompletas(window.dataObrasGlobal, 'tabla-obras-global');
            renderizarTablasCompletas(window.dataDesviosGlobal, 'tabla-desvios-global');

            document.querySelectorAll('.filtro-seccion .btn-pill').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.filtro-seccion .btn-pill').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    filtroActualEstado = e.target.getAttribute('data-estado');
                    aplicarFiltros();
                });
            });
            aplicarFiltros(); 
        }
    });
}

function evaluarRiesgo(dias, comentarios) {
    let dNum = parseInt(dias); let dStr = normalizarTexto(dias); let tc = normalizarTexto(comentarios);
    let esC = dStr === "culminado" || tc.includes("culminado"); let esT = dStr === "en tramite" || tc.includes("tramite"); let esE = dStr === "exonerado" || tc.includes("exonerado");
    let vMat = !isNaN(dNum) && dNum < 0; let aTemp = !isNaN(dNum) && dNum >= 0 && dNum <= 120;
    let estado = 'VIGENTE';
    if (esC) estado = 'CULMINADO'; else if (esE) estado = 'LEY31955'; else if (vMat && !esT) estado = 'CRITICO_SIN_ACCION'; else if (vMat && esT) estado = 'CRITICO_EN_TRAMITE'; else if (aTemp && !esT) estado = 'ALERTA_TEMPRANA'; else if (esT) estado = 'TRAMITE_EN_PLAZO'; else if (!isNaN(dNum) && dNum === 0) estado = 'CRITICO_SIN_ACCION';
    return { diasValor: isNaN(dNum) ? null : dNum, esTramite: esT, estadoRiesgo: estado };
}

function obtenerClaseCSS(estado) {
    const mapa = { 'CRITICO_SIN_ACCION': 'estado-critico-sin-accion', 'CRITICO_EN_TRAMITE': 'estado-critico-en-tramite', 'ALERTA_TEMPRANA': 'estado-alerta', 'TRAMITE_EN_PLAZO': 'estado-tramite-plazo', 'LEY31955': 'estado-exonerado', 'CULMINADO': 'estado-culminado' };
    return mapa[estado] || 'estado-tramite-plazo';
}

function formatearTextoPopup(ev) {
    if (ev.estadoRiesgo === 'CULMINADO') return "Finalizada";
    if (ev.estadoRiesgo === 'LEY31955') return "Ley N° 31955";
    let textoDias = ev.diasValor !== null ? (ev.diasValor < 0 ? `Vencido (${Math.abs(ev.diasValor)}d)` : `Quedan ${ev.diasValor}d`) : "";
    return textoDias || "S/D";
}

function aplicarEstiloMarcador(marker, estado) {
    if (estado === 'CRITICO_SIN_ACCION') marker.setStyle({ fillColor: "#dc2626", color: "#ffffff" });
    else if (estado === 'CRITICO_EN_TRAMITE') marker.setStyle({ fillColor: "#c026d3", color: "#dc2626" });
    else if (estado === 'ALERTA_TEMPRANA') marker.setStyle({ fillColor: "#f59e0b", color: "#ffffff" });
    else if (estado === 'LEY31955') marker.setStyle({ fillColor: "#f97316", color: "#ffffff" });
    else marker.setStyle({ fillColor: "#10b981", color: "#ffffff" });
}

function determinarSeveridadVisual(o, d) {
    const p = { 'CRITICO_SIN_ACCION': 5, 'CRITICO_EN_TRAMITE': 4, 'ALERTA_TEMPRANA': 3, 'TRAMITE_EN_PLAZO': 2, 'LEY31955': 1, 'VIGENTE': 0, 'CULMINADO': -1 };
    return p[o.estadoRiesgo] > p[d.estadoRiesgo] ? o.estadoRiesgo : d.estadoRiesgo;
}

function aplicarFiltros() {
    grupoMarcadores.clearLayers(); 
    let boundsCount = 0;
    marcadoresGuardados.forEach(obj => {
        let m = true;
        if (filtroActualEstado === "Criticos") m = (obj.severidadGlobal === 'CRITICO_SIN_ACCION'); 
        else if (filtroActualEstado === "Tramite") m = (obj.evalObra.esTramite || obj.evalDesvio.esTramite); 
        else if (filtroActualEstado === "Menor4Meses") m = (obj.severidadGlobal === 'ALERTA_TEMPRANA'); 
        else if (filtroActualEstado === "Ley31955") m = (obj.severidadGlobal === 'LEY31955'); 
        else if (filtroActualEstado === "Culminado") m = (obj.severidadGlobal === 'CULMINADO');
        else if (filtroActualEstado === "Mincul") m = !!dataMinCultura[obj.id]; 

        if (m) { obj.marcador.addTo(grupoMarcadores); boundsCount++; }
    });
    if (boundsCount > 0) map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30], maxZoom: 15 });
}

function renderizarTablasCompletas(data, tableId) {
    const tbody = document.getElementById(tableId); if (!tbody) return;
    tbody.innerHTML = '';
    data.forEach(fila => {
        let etiquetaHTML = `<span class="px-2 py-1 rounded font-bold text-[0.65rem] bg-slate-200 text-slate-600">${fila.estado}</span>`;
        let tr = document.createElement('tr'); 
        tr.className = `border-b border-gray-200/60 bg-white hover:bg-blue-50 cursor-pointer`;
        tr.innerHTML = `
            <td class="p-2 font-bold text-slate-800 whitespace-nowrap celda-divisoria">${fila.id}</td>
            <td class="p-2 text-slate-800 font-bold text-[0.65rem] md:text-[0.7rem] celda-divisoria">${fila.resolucion || 'S/N'}</td>
            <td class="p-2 text-center flex items-center justify-center">${etiquetaHTML}</td>
        `;
        tr.addEventListener('mouseenter', () => { 
            let encontrado = marcadoresGuardados.find(m => m.id === fila.id); 
            if (encontrado) { map.setView([encontrado.lat, encontrado.lon], 15, { animate: true }); encontrado.marcador.openPopup(); }
        });
        tbody.appendChild(tr);
    });
}
