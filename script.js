import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAalo8_88axc-5QAGT8Winp72A1utZwzZg",
    authDomain: "cerramientos-l2l4-b157e.firebaseapp.com",
    projectId: "cerramientos-l2l4-b157e",
    storageBucket: "cerramientos-l2l4-b157e.firebasestorage.app",
    messagingSenderId: "21699345602",
    appId: "1:21699345602:web:f715c1203b7516f0cccf5b",
    measurementId: "G-GRNDM7PZ55"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 
const provider = new GoogleAuthProvider();
let usuarioActual = "anonimo"; 

const CORREOS_MAESTROS = ["zebaxx@gmail.com", "permisosccm2l@gmail.com", "tnoriega.arq@gmail.com", "supervisor@gmail.com"]; 
const DOMINIO_PERMITIDO = "@ccmetrolima.com";

const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLoginCorp = document.getElementById('btn-login-corp');
const inputEmailCorp = document.getElementById('email-corp');
const inputPassCorp = document.getElementById('pass-corp');
const mensajeError = document.getElementById('mensaje-error');
const pantallaBloqueo = document.getElementById('pantalla-bloqueo');
const appPrincipal = document.getElementById('app-principal');

setPersistence(auth, browserLocalPersistence).then(() => {
    btnLoginGoogle.addEventListener('click', () => {
        mensajeError.style.display = 'none';
        btnLoginGoogle.innerHTML = "Conectando..."; 
        signInWithPopup(auth, provider).catch(() => {
            mensajeError.innerText = "Error de autenticación. Verifica tus permisos.";
            mensajeError.style.display = 'block';
            btnLoginGoogle.innerHTML = "Ingreso Autorizado";
        });
    });

    btnLoginCorp.addEventListener('click', () => {
        const email = inputEmailCorp.value.trim();
        const password = inputPassCorp.value;
        if (!email || !password) {
            mensajeError.innerText = "Por favor, ingresa el correo y la contraseña corporativa.";
            mensajeError.style.display = 'block';
            return;
        }
        mensajeError.style.display = 'none';
        btnLoginCorp.innerHTML = "Validando credenciales..."; 
        signInWithEmailAndPassword(auth, email, password).catch(() => {
            mensajeError.innerText = "Credenciales incorrectas o acceso denegado.";
            mensajeError.style.display = 'block';
            btnLoginCorp.innerHTML = "Ingresar al Sistema";
        });
    });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        const email = user.email.toLowerCase();
        usuarioActual = email; 
        if (email.endsWith(DOMINIO_PERMITIDO) || CORREOS_MAESTROS.includes(email)) {
            pantallaBloqueo.style.display = 'none';
            appPrincipal.style.display = 'flex';
            iniciarMotorDelMapa(); 
        } else {
            signOut(auth).then(() => {
                mensajeError.innerText = `Acceso denegado. Comunícate con la administración para solicitar permiso.`;
                mensajeError.style.display = 'block';
            });
        }
    } else {
        pantallaBloqueo.style.display = 'flex';
        appPrincipal.style.display = 'none';
    }
});

let mapaInicializado = false;
let map;
let grupoMarcadores;
let marcadoresGuardados = []; 
let filtroActualEstado = "Todos";
window.datosGlobales = [];
let chartObra = null; 
let chartDesvio = null; 

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

const normalizarTexto = (str) => {
    if (!str) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

function iniciarMotorDelMapa() {
    if (mapaInicializado) return; 
    mapaInicializado = true;

    map = L.map('map', { zoomControl: false }).setView([-12.055, -77.050], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], className: 'mapa-google-gris' }).addTo(map);
    grupoMarcadores = L.featureGroup().addTo(map);

    Papa.parse(urlCSV, {
        download: true, header: true,
        complete: function(results) {
            window.datosGlobales = results.data; 
            
            window.datosGlobales.forEach(item => {
                if (item.Latitud && item.Longitud && item.ID) {
                    
                    let evalObra = evaluarRiesgo(item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Comentarios);
                    let evalDesvio = evaluarRiesgo(item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Comentarios);
                    
                    let comObra = item.Aut_Obra_Comentarios ? `<details class="popup-details mt-2"><summary class="text-blue-600 font-semibold cursor-pointer text-[0.7rem]">💬 Ver sustento...</summary><div class="mt-1 text-[0.7rem] text-gray-600 italic bg-white p-2 border rounded shadow-inner">${item.Aut_Obra_Comentarios}</div></details>` : '';
                    let comDesvio = item.Aut_Desvio_Comentarios ? `<details class="popup-details mt-2"><summary class="text-blue-600 font-semibold cursor-pointer text-[0.7rem]">💬 Ver sustento...</summary><div class="mt-1 text-[0.7rem] text-gray-600 italic bg-white p-2 border rounded shadow-inner">${item.Aut_Desvio_Comentarios}</div></details>` : '';

                    let popupContent = `
                        <div class="popup-container">
                            <h3 class="popup-title">${item.ID}: ${item.Nombre}</h3>
                            <div class="popup-subtitle">📍 ${item.Municipalidad} | ${item.Linea} - ${item.Tipo}</div>
                            <div class="auth-box ${obtenerClaseCSS(evalObra.estadoRiesgo)}">
                                <span class="font-bold block mb-1 text-slate-700">🚧 Autorización de Obra</span>
                                Res: ${item.Aut_Obra_Resolucion || 'N/A'}<br>
                                Estado: <b class="text-slate-800">${formatearTextoPopup(evalObra)}</b>
                                ${comObra}
                            </div>
                            <div class="auth-box ${obtenerClaseCSS(evalDesvio.estadoRiesgo)}">
                                <span class="font-bold block mb-1 text-slate-700">🚦 Desvío de Tránsito</span>
                                Res: ${item.Aut_Desvio_Resolucion || 'N/A'}<br>
                                Estado: <b class="text-slate-800">${formatearTextoPopup(evalDesvio)}</b>
                                ${comDesvio}
                            </div>
                        </div>
                    `;

                    let lat = parseFloat(item.Latitud.toString().trim().replace(/,/g, '.'));
                    let lon = parseFloat(item.Longitud.toString().trim().replace(/,/g, '.'));

                    if (!isNaN(lat) && !isNaN(lon)) {
                        let marker = L.circleMarker([lat, lon], { radius: 7, fillColor: "#2563EB", color: "#ffffff", weight: 2, fillOpacity: 0.95 });
                        let severidadGlobal = determinarSeveridadVisual(evalObra, evalDesvio);
                        aplicarEstiloMarcador(marker, severidadGlobal);
                        
                        marker.bindPopup(popupContent);
                        marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'font-bold bg-white/95 px-1.5 py-0.5 rounded border border-gray-300 shadow-sm text-[0.65rem] text-slate-700', offset: [5, 0] });
                        
                        marcadoresGuardados.push({ marcador: marker, datos: item, evalObra: evalObra, evalDesvio: evalDesvio, severidadGlobal: severidadGlobal });
                    }
                }
            });

            document.querySelectorAll('.filtro-seccion .btn-pill').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.filtro-seccion .btn-pill').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    filtroActualEstado = e.target.getAttribute('data-estado');
                    aplicarFiltros();
                });
            });

            aplicarFiltros(); 
            procesarTableroGerencial(); 
            configurarManejadoresReportes();
            iniciarChatInteligente();
        }
    });
}

function evaluarRiesgo(dias, comentarios) {
    let dNum = parseInt(dias);
    let dStr = normalizarTexto(dias);
    let textoComentario = normalizarTexto(comentarios);
    
    let esCulminado = dStr === "culminado" || dStr === "culminada" || textoComentario.includes("culminado");
    let esTramite = dStr === "en tramite" || textoComentario.includes("tramite");
    let esExonerado = dStr === "exonerado" || textoComentario.includes("exonerado");
    let esIndefinido = dStr === "indefinido" || textoComentario.includes("indefinido");
    
    let esVencidoMatematico = !isNaN(dNum) && dNum < 0;
    let esAlertaTemprana = !isNaN(dNum) && dNum >= 0 && dNum <= 120;

    let estadoRiesgo = 'VIGENTE';
    let accion = 'Monitorear';

    if (esCulminado) { estadoRiesgo = 'CULMINADO'; accion = 'Archivar'; }
    else if (esExonerado) { estadoRiesgo = 'LEY31955'; accion = 'Archivar'; } 
    else if (esIndefinido) { estadoRiesgo = 'INDEFINIDO'; accion = 'Archivar'; } 
    else if (esVencidoMatematico && !esTramite) { estadoRiesgo = 'CRITICO_SIN_ACCION'; accion = 'Tomar Acción'; } 
    else if (esVencidoMatematico && esTramite) { estadoRiesgo = 'CRITICO_EN_TRAMITE'; accion = 'Insistir Entidad'; } 
    else if (esAlertaTemprana && !esTramite) { estadoRiesgo = 'ALERTA_TEMPRANA'; accion = 'Preparar Exp.'; } 
    else if (esTramite) { estadoRiesgo = 'TRAMITE_EN_PLAZO'; accion = 'Seguimiento'; } 
    else if (!isNaN(dNum) && dNum === 0) { estadoRiesgo = 'CRITICO_SIN_ACCION'; accion = 'Tomar Acción'; }

    return { diasOriginal: dias, diasValor: isNaN(dNum) ? null : dNum, esTramite: esTramite, esVencido: esVencidoMatematico, estadoRiesgo: estadoRiesgo, accion: accion };
}

function obtenerClaseCSS(estado) {
    const mapa = { 'CRITICO_SIN_ACCION': 'estado-critico-sin-accion', 'CRITICO_EN_TRAMITE': 'estado-critico-en-tramite', 'ALERTA_TEMPRANA': 'estado-alerta', 'TRAMITE_EN_PLAZO': 'estado-tramite-plazo', 'LEY31955': 'estado-exonerado', 'CULMINADO': 'estado-culminado', 'INDEFINIDO': 'estado-exonerado' };
    return mapa[estado] || 'estado-tramite-plazo';
}

function formatearTextoPopup(ev) {
    if (ev.estadoRiesgo === 'CULMINADO') return "Finalizada";
    if (ev.estadoRiesgo === 'LEY31955') return "Ley N° 31955";
    if (ev.estadoRiesgo === 'INDEFINIDO') return "Indefinido";
    let textoDias = ev.diasValor !== null ? (ev.diasValor < 0 ? `Vencido (${Math.abs(ev.diasValor)}d)` : `Quedan ${ev.diasValor}d`) : "";
    if (ev.estadoRiesgo === 'CRITICO_EN_TRAMITE' || ev.estadoRiesgo === 'TRAMITE_EN_PLAZO') return `En Trámite ${textoDias ? '- ' + textoDias : ''}`;
    return textoDias || ev.diasOriginal || "S/D";
}

function aplicarEstiloMarcador(marker, estado) {
    marker.getElement()?.classList.remove('brillo-preventivo', 'brillo-tramite-vencido');
    if (estado === 'CRITICO_SIN_ACCION') marker.setStyle({ fillColor: "#dc2626", color: "#ffffff" });
    else if (estado === 'CRITICO_EN_TRAMITE') { marker.setStyle({ fillColor: "#c026d3", color: "#dc2626", weight: 2 }); marker.getElement()?.classList.add('brillo-tramite-vencido'); }
    else if (estado === 'ALERTA_TEMPRANA') { marker.setStyle({ fillColor: "#f59e0b", color: "#ffffff" }); marker.getElement()?.classList.add('brillo-preventivo'); }
    else if (estado === 'LEY31955') marker.setStyle({ fillColor: "#f97316", color: "#ffffff" });
    else if (estado === 'TRAMITE_EN_PLAZO') marker.setStyle({ fillColor: "#3b82f6", color: "#ffffff" });
    else marker.setStyle({ fillColor: "#10b981", color: "#ffffff" });
}

function determinarSeveridadVisual(obra, desvio) {
    const peso = { 'CRITICO_SIN_ACCION': 5, 'CRITICO_EN_TRAMITE': 4, 'ALERTA_TEMPRANA': 3, 'TRAMITE_EN_PLAZO': 2, 'LEY31955': 1, 'VIGENTE': 0, 'INDEFINIDO': 0, 'CULMINADO': -1 };
    return peso[obra.estadoRiesgo] > peso[desvio.estadoRiesgo] ? obra.estadoRiesgo : desvio.estadoRiesgo;
}

function aplicarFiltros() {
    grupoMarcadores.clearLayers(); 
    let boundsCount = 0;
    
    marcadoresGuardados.forEach(obj => {
        let mostrar = true;
        if (filtroActualEstado === "Criticos") mostrar = (obj.severidadGlobal === 'CRITICO_SIN_ACCION');
        else if (filtroActualEstado === "Tramite") mostrar = (obj.evalObra.esTramite || obj.evalDesvio.esTramite);
        else if (filtroActualEstado === "Menor4Meses") mostrar = (obj.severidadGlobal === 'ALERTA_TEMPRANA');
        else if (filtroActualEstado === "Ley31955") mostrar = (obj.severidadGlobal === 'LEY31955');
        else if (filtroActualEstado === "Culminado") mostrar = (obj.severidadGlobal === 'CULMINADO');
        
        if (mostrar) { obj.marcador.addTo(grupoMarcadores); boundsCount++; }
    });
    if (boundsCount > 0) map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30], maxZoom: 15 });
}

function procesarTableroGerencial() {
    let tCriticos = 0, tTramite = 0, tAlerta = 0, tLey = 0, tCulminado = 0;
    let dataSemaforo = [];
    let rankingObra = [];
    let rankingDesvio = [];

    marcadoresGuardados.forEach(obj => {
        const { evalObra, evalDesvio, datos } = obj;

        if (evalObra.estadoRiesgo === 'CRITICO_SIN_ACCION' || evalDesvio.estadoRiesgo === 'CRITICO_SIN_ACCION') tCriticos++;
        if (evalObra.esTramite || evalDesvio.esTramite) tTramite++;
        if (obj.severidadGlobal === 'ALERTA_TEMPRANA') tAlerta++;
        if (obj.severidadGlobal === 'LEY31955') tLey++;
        if (obj.severidadGlobal === 'CULMINADO') tCulminado++;

        [ { tipo: 'Obra', ev: evalObra, res: datos.Aut_Obra_Resolucion }, { tipo: 'Desvío', ev: evalDesvio, res: datos.Aut_Desvio_Resolucion } ].forEach(item => {
            if (item.ev.estadoRiesgo === 'CRITICO_SIN_ACCION' || item.ev.estadoRiesgo === 'CRITICO_EN_TRAMITE' || item.ev.estadoRiesgo === 'ALERTA_TEMPRANA') {
                dataSemaforo.push({
                    id: datos.ID, jurisdiccion: datos.Municipalidad, tipo: item.tipo, 
                    resolucion: item.res, dias: item.ev.diasValor, estado: item.ev.estadoRiesgo, accion: item.ev.accion
                });
            }
            if (item.ev.estadoRiesgo === 'CRITICO_SIN_ACCION' || item.ev.estadoRiesgo === 'CRITICO_EN_TRAMITE') {
                if(item.ev.diasValor !== null && item.ev.diasValor < 0) {
                    let objRanking = { id: datos.ID, dias: Math.abs(item.ev.diasValor), resolucion: item.res, estado: item.ev.estadoRiesgo };
                    if(item.tipo === 'Obra') rankingObra.push(objRanking);
                    else rankingDesvio.push(objRanking);
                }
            }
        });
    });

    if(document.getElementById('kpi-rojo')) document.getElementById('kpi-rojo').innerText = tCriticos;
    if(document.getElementById('kpi-morado')) document.getElementById('kpi-morado').innerText = tTramite;
    if(document.getElementById('kpi-amarillo')) document.getElementById('kpi-amarillo').innerText = tAlerta;
    if(document.getElementById('kpi-naranja')) document.getElementById('kpi-naranja').innerText = tLey;
    if(document.getElementById('kpi-verde')) document.getElementById('kpi-verde').innerText = tCulminado;

    renderizarTablaSemaforo(dataSemaforo);
    
    rankingObra.sort((a, b) => b.dias - a.dias);
    rankingDesvio.sort((a, b) => b.dias - a.dias);
    
    window.dataRankingObra = rankingObra; 
    window.dataRankingDesvio = rankingDesvio;
    
    renderizarGraficos(rankingObra.slice(0, 10), rankingDesvio.slice(0, 10));
}

function renderizarTablaSemaforo(data) {
    const tbody = document.getElementById('tabla-semaforo-riesgos');
    if (!tbody) return;
    tbody.innerHTML = '';

    const jerarquia = { 'CRITICO_SIN_ACCION': 1, 'CRITICO_EN_TRAMITE': 2, 'ALERTA_TEMPRANA': 3 };
    data.sort((a, b) => jerarquia[a.estado] - jerarquia[b.estado] || a.dias - b.dias);

    data.forEach(fila => {
        let claseColor = fila.estado === 'CRITICO_SIN_ACCION' ? 'bg-red-500 text-white' : 
                         fila.estado === 'CRITICO_EN_TRAMITE' ? 'bg-fuchsia-600 text-white' : 'bg-yellow-400 text-slate-800';
        let textoDias = fila.dias < 0 ? `${fila.dias} días (Vencido)` : `${fila.dias} días (Alerta)`;
        let bgFila = fila.tipo === 'Obra' ? 'bg-sky-50/50' : 'bg-fuchsia-50/40';

        tbody.innerHTML += `
            <tr class="border-b border-white hover:bg-slate-100 transition-colors ${bgFila}">
                <td class="p-2 font-bold text-slate-700 whitespace-nowrap">${fila.id}</td>
                <td class="p-2 text-slate-600 font-medium">${fila.tipo}</td>
                <td class="p-2 text-slate-800 font-bold text-[0.65rem] md:text-[0.7rem] leading-tight break-all">${fila.resolucion || 'S/N'}</td>
                <td class="p-2 text-center flex flex-col items-center justify-center gap-1.5 border-l border-white/50">
                    <span class="px-2 py-1 rounded shadow-sm font-bold text-[0.65rem] whitespace-nowrap w-full ${claseColor}">${textoDias}</span>
                    <span class="text-[0.6rem] font-bold text-slate-700 uppercase tracking-tight">${fila.accion}</span>
                </td>
            </tr>`;
    });
    window.dataSemaforoActual = data; 
}

function renderizarGraficos(dataObra, dataDesvio) {
    const ctxObra = document.getElementById('grafico-ranking-obra');
    const ctxDesvio = document.getElementById('grafico-ranking-desvio');
    
    if (chartObra) chartObra.destroy();
    if (chartDesvio) chartDesvio.destroy();

    const opcionesGlobales = {
        responsive: true, maintainAspectRatio: false, 
        plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 8, font: {size: 10} } } },
        scales: { 
            y: { beginAtZero: true, border: {display: false}, grid: { color: '#f1f5f9' }, ticks:{font:{size:9}} }, 
            x: { grid: { display: false }, ticks:{font:{size:8, weight:'bold'}, maxRotation: 45, minRotation: 45} } 
        } 
    };

    if (typeof Chart !== 'undefined') {
        if(ctxObra) chartObra = new Chart(ctxObra, {
            type: 'bar',
            data: { labels: dataObra.map(d=>d.id), datasets: [{ label: 'OBRAS: Días Vencidos (Top 10)', data: dataObra.map(d=>d.dias), backgroundColor: '#38bdf8', borderRadius: 4 }] },
            options: opcionesGlobales
        });

        if(ctxDesvio) chartDesvio = new Chart(ctxDesvio, {
            type: 'bar',
            data: { labels: dataDesvio.map(d=>d.id), datasets: [{ label: 'DESVÍOS: Días Vencidos (Top 10)', data: dataDesvio.map(d=>d.dias), backgroundColor: '#d946ef', borderRadius: 4 }] },
            options: opcionesGlobales
        });
    }
}

// --- GENERADOR DE REPORTES (TXT Y PDF) ---
function configurarManejadoresReportes() {
    const btnTxt = document.getElementById('btn-reporte-txt');
    const btnPdf = document.getElementById('btn-reporte-pdf');
    
    if (btnTxt) {
        btnTxt.addEventListener('click', () => {
            if (!window.dataSemaforoActual || window.dataSemaforoActual.length === 0) return alert("Cargando datos...");
            
            let fechaActual = new Date();
            let fechaStr = fechaActual.toLocaleDateString('es-PE');
            let horaStr = fechaActual.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
            
            let texto = `📊 *REPORTE EJECUTIVO DE PERMISOS - L2/L4*\n📅 Fecha de Corte: ${fechaStr} a las ${horaStr}\n\n`;
            
            let obras = window.dataSemaforoActual.filter(d => d.tipo === 'Obra');
            let desvios = window.dataSemaforoActual.filter(d => d.tipo === 'Desvío');
            
            texto += `🚧 *CONTINGENCIAS DE OBRA (${obras.length}):*\n`;
            if(obras.length === 0) texto += `- Ninguna pendiente.\n`;
            obras.forEach(o => {
                let est = o.estado === 'CRITICO_EN_TRAMITE' ? '[EN TRÁMITE]' : '[SIN ACCIÓN]';
                texto += `- ${o.id}: Vencido hace ${Math.abs(o.dias)}d. ${est}\n`;
            });
            
            texto += `\n🚦 *CONTINGENCIAS DE DESVÍO (${desvios.length}):*\n`;
            if(desvios.length === 0) texto += `- Ninguna pendiente.\n`;
            desvios.forEach(d => {
                let est = d.estado === 'CRITICO_EN_TRAMITE' ? '[EN TRÁMITE]' : '[SIN ACCIÓN]';
                texto += `- ${d.id}: Vencido hace ${Math.abs(d.dias)}d. ${est}\n`;
            });
            
            texto += `\n🔗 *Dashboard:* https://vlacaspa.github.io/Mapa-Linea-2-4/`;
            navigator.clipboard.writeText(texto).then(() => {
                let tOri = btnTxt.innerHTML;
                btnTxt.innerHTML = "✅ Listo";
                setTimeout(() => { btnTxt.innerHTML = tOri; }, 2500);
            });
        });
    }

    if (btnPdf) {
        btnPdf.addEventListener('click', () => {
            // 1. Preparar datos para la plantilla PDF
            let fechaActual = new Date();
            document.getElementById('pdf-fecha').innerText = fechaActual.toLocaleDateString('es-PE');
            document.getElementById('pdf-hora').innerText = fechaActual.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

            let totalTramitesTotales = window.datosGlobales.length * 2; // Obras y Desvíos sumados
            let criticos = parseInt(document.getElementById('kpi-rojo').innerText);
            let tramite = parseInt(document.getElementById('kpi-morado').innerText);
            
            document.getElementById('pdf-kpi-rojo').innerText = criticos;
            document.getElementById('pdf-kpi-morado').innerText = tramite;
            
            let pctRojo = totalTramitesTotales > 0 ? Math.round((criticos / totalTramitesTotales) * 100) : 0;
            let pctMorado = totalTramitesTotales > 0 ? Math.round((tramite / totalTramitesTotales) * 100) : 0;
            
            document.getElementById('pdf-bar-rojo').style.width = pctRojo + '%';
            document.getElementById('pdf-pct-rojo').innerText = pctRojo + '% del volumen total';
            
            document.getElementById('pdf-bar-morado').style.width = pctMorado + '%';
            document.getElementById('pdf-pct-morado').innerText = pctMorado + '% del volumen total';

            // Llenar Tablas
            const tbodyObra = document.querySelector('#pdf-tabla-obra tbody');
            tbodyObra.innerHTML = '';
            window.dataRankingObra.slice(0, 10).forEach(d => {
                let estadoStr = d.estado === 'CRITICO_EN_TRAMITE' ? 'En Trámite (Entidad)' : 'Sin Acción (Interno)';
                let barColor = d.estado === 'CRITICO_EN_TRAMITE' ? '#d946ef' : '#ef4444';
                let maxWidth = window.dataRankingObra[0]?.dias || 1;
                let widthPct = Math.max(5, (d.dias / maxWidth) * 100);
                
                tbodyObra.innerHTML += `<tr>
                    <td style="font-weight:bold">${d.id}</td>
                    <td>${d.resolucion || 'S/R'}</td>
                    <td>${estadoStr}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:5px">
                            <span style="min-width:25px; font-weight:bold">${d.dias}d</span>
                            <div style="height:10px; background-color:${barColor}; width:${widthPct}%; border-radius:3px"></div>
                        </div>
                    </td>
                </tr>`;
            });

            const tbodyDesvio = document.querySelector('#pdf-tabla-desvio tbody');
            tbodyDesvio.innerHTML = '';
            window.dataRankingDesvio.slice(0, 10).forEach(d => {
                let estadoStr = d.estado === 'CRITICO_EN_TRAMITE' ? 'En Trámite (Entidad)' : 'Sin Acción (Interno)';
                let barColor = d.estado === 'CRITICO_EN_TRAMITE' ? '#d946ef' : '#ef4444';
                let maxWidth = window.dataRankingDesvio[0]?.dias || 1;
                let widthPct = Math.max(5, (d.dias / maxWidth) * 100);
                
                tbodyDesvio.innerHTML += `<tr>
                    <td style="font-weight:bold">${d.id}</td>
                    <td>${d.resolucion || 'S/R'}</td>
                    <td>${estadoStr}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:5px">
                            <span style="min-width:25px; font-weight:bold">${d.dias}d</span>
                            <div style="height:10px; background-color:${barColor}; width:${widthPct}%; border-radius:3px"></div>
                        </div>
                    </td>
                </tr>`;
            });

            // 2. Ejecutar HTML2PDF
            let tOri = btnPdf.innerHTML;
            btnPdf.innerHTML = "⌛ Procesando...";
            
            const elementoAImprimir = document.getElementById('plantilla-pdf-container');
            elementoAImprimir.style.left = '0'; // Traerlo a pantalla pero detrás
            
            const opciones = {
                margin: 0,
                filename: `Reporte_Permisos_${fechaActual.getTime()}.pdf`,
                image: { type: 'jpeg', quality: 1.0 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            html2pdf().set(opciones).from(elementoAImprimir).save().then(() => {
                elementoAImprimir.style.left = '-9999px'; // Ocultar nuevamente
                btnPdf.innerHTML = "✅ Descargado";
                setTimeout(() => { btnPdf.innerHTML = tOri; }, 3000);
            });
        });
    }
}

function iniciarChatInteligente() {
    const chatWidget = document.getElementById('panel-chat');
    const btnToggle = document.getElementById('chat-header');
    const inputChat = document.getElementById('chat-input');
    const btnEnviar = document.getElementById('btn-enviar-chat');
    const msgContainer = document.getElementById('chat-mensajes');

    btnToggle.addEventListener('click', () => {
        if (chatWidget.classList.contains('chat-minimizada')) {
            chatWidget.classList.replace('chat-minimizada', 'chat-abierta');
            inputChat.focus();
        } else {
            chatWidget.classList.replace('chat-abierta', 'chat-minimizada');
        }
    });

    const agregarMensaje = (txt, tipo) => {
        const div = document.createElement('div');
        div.className = tipo === 'user' ? 'msg-user' : 'msg-bot';
        div.innerHTML = txt;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    };

    const procesarConsulta = (txtCons) => {
        let txt = normalizarTexto(txtCons);
        if (txt.includes('por vencer')) {
            let l = marcadoresGuardados.filter(o => o.severidadGlobal === 'ALERTA_TEMPRANA').map(o => o.datos.ID);
            return l.length > 0 ? `🟡 <b>Por vencer:</b><br>${l.join(', ')}` : `✅ Ninguna por vencer.`;
        }
        let est = marcadoresGuardados.find(o => new RegExp(`\\b${normalizarTexto(o.datos.ID)}\\b`, 'i').test(txt));
        if (!est) return "Identifica la estructura (Ej: 'PV19' o 'E12').";
        return `<b>📍 ${est.datos.ID}</b><br>🚧 <b>Obra:</b> ${formatearTextoPopup(est.evalObra)}<br>🚦 <b>Tránsito:</b> ${formatearTextoPopup(est.evalDesvio)}`;
    };

    const enviar = () => {
        let t = inputChat.value.trim();
        if (!t) return;
        agregarMensaje(t, 'user');
        inputChat.value = '';
        setTimeout(() => agregarMensaje(procesarConsulta(t), 'bot'), 400); 
    };

    btnEnviar.addEventListener('click', enviar);
    inputChat.addEventListener('keypress', (e) => { if(e.key === 'Enter') enviar(); });
}
