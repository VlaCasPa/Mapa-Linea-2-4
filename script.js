import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- 1. CREDENCIALES Y AUTENTICACIÓN FIREBASE ---
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

const CORREOS_MAESTROS = [
    "zebaxx@gmail.com", 
    "permisosccm2l@gmail.com",
    "tnoriega.arq@gmail.com",
    "supervisor@gmail.com"
]; 
const DOMINIO_PERMITIDO = "@ccmetrolima.com";

const googleBtnHTML = `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Ingreso Autorizado`;

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
            btnLoginGoogle.innerHTML = googleBtnHTML;
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
            mensajeError.innerText = "Credenciales incorrectas o acceso denegado. Contacte al administrador.";
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
            appPrincipal.style.display = 'block';
            iniciarMotorDelMapa(); 
        } else {
            signOut(auth).then(() => {
                mensajeError.innerText = `Acceso denegado. Comunícate con la administración para solicitar permiso de ingreso.`;
                mensajeError.style.display = 'block';
                btnLoginGoogle.innerHTML = googleBtnHTML;
            });
        }
    } else {
        pantallaBloqueo.style.display = 'flex';
        appPrincipal.style.display = 'none';
    }
});

// --- 2. LÓGICA ESPACIAL, KPIs Y SEMÁFORO DE RIESGOS ---
let mapaInicializado = false;
let map;
let grupoMarcadores;
let marcadoresGuardados = []; 
let filtroActualID = "Todos";
let filtroActualEstado = "Todos";
window.datosGlobales = [];
let chartInstancia = null; 

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

// Normalizador Inteligente (Ignora tildes y mayúsculas)
const normalizarTexto = (str) => {
    if (!str) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

function iniciarMotorDelMapa() {
    if (mapaInicializado) return; 
    mapaInicializado = true;

    map = L.map('map').setView([-12.055, -77.050], 12);
    L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'] }).addTo(map);
    grupoMarcadores = L.featureGroup().addTo(map);

    Papa.parse(urlCSV, {
        download: true, 
        header: true,
        complete: function(results) {
            window.datosGlobales = results.data; 
            let contenedorIDs = document.getElementById('contenedor-filtros-id');
            
            window.datosGlobales.forEach(item => {
                if (item.Latitud && item.Longitud && item.ID) {
                    
                    if (!document.querySelector(`button[data-id="${item.ID}"]`)) {
                        let btn = document.createElement('button');
                        btn.className = 'btn-pill';
                        btn.setAttribute('data-id', item.ID);
                        btn.innerText = item.ID;
                        if (contenedorIDs) contenedorIDs.appendChild(btn);
                    }

                    // Evaluación Estratégica del Riesgo
                    let evalObra = evaluarRiesgo(item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Comentarios);
                    let evalDesvio = evaluarRiesgo(item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Comentarios);
                    
                    let comObra = item.Aut_Obra_Comentarios ? `<details class="popup-details mt-2"><summary class="popup-summary text-blue-600 font-semibold cursor-pointer text-xs">💬 Ver sustento...</summary><div class="mt-1 text-xs text-gray-600 italic bg-white p-2 border rounded">${item.Aut_Obra_Comentarios}</div></details>` : '';
                    let comDesvio = item.Aut_Desvio_Comentarios ? `<details class="popup-details mt-2"><summary class="popup-summary text-blue-600 font-semibold cursor-pointer text-xs">💬 Ver sustento...</summary><div class="mt-1 text-xs text-gray-600 italic bg-white p-2 border rounded">${item.Aut_Desvio_Comentarios}</div></details>` : '';

                    let popupContent = `
                        <div class="popup-container">
                            <h3 class="popup-title">${item.ID}: ${item.Nombre}</h3>
                            <div class="popup-subtitle">📍 ${item.Municipalidad} | ${item.Linea} - ${item.Tipo}</div>
                            <div class="auth-box ${obtenerClaseCSS(evalObra.estadoRiesgo)}">
                                <span class="font-bold block mb-1">🚧 Autorización de Obra</span>
                                Resolución: ${item.Aut_Obra_Resolucion || 'N/A'}<br>
                                Estado: <b>${formatearTextoPopup(evalObra)}</b>
                                ${comObra}
                            </div>
                            <div class="auth-box ${obtenerClaseCSS(evalDesvio.estadoRiesgo)}">
                                <span class="font-bold block mb-1">🚦 Desvío de Tránsito</span>
                                Resolución: ${item.Aut_Desvio_Resolucion || 'N/A'}<br>
                                Estado: <b>${formatearTextoPopup(evalDesvio)}</b>
                                ${comDesvio}
                            </div>
                        </div>
                    `;

                    let lat = parseFloat(item.Latitud.toString().trim().replace(/,/g, '.'));
                    let lon = parseFloat(item.Longitud.toString().trim().replace(/,/g, '.'));

                    if (!isNaN(lat) && !isNaN(lon)) {
                        let marker = L.circleMarker([lat, lon], { radius: 8, fillColor: "#2563EB", color: "#ffffff", weight: 2, fillOpacity: 0.8 });
                        
                        let severidadGlobal = determinarSeveridadVisual(evalObra, evalDesvio);
                        aplicarEstiloMarcador(marker, severidadGlobal);
                        
                        marker.bindPopup(popupContent);
                        marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'font-bold bg-white/80 px-1 rounded shadow-sm text-xs', offset: [5, 0] });
                        
                        marcadoresGuardados.push({ marcador: marker, datos: item, evalObra: evalObra, evalDesvio: evalDesvio, severidadGlobal: severidadGlobal });
                    }
                }
            });

            // Listeners de Filtros
            document.querySelectorAll('#contenedor-filtros-id .btn-pill').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('#contenedor-filtros-id .btn-pill').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    filtroActualID = e.target.getAttribute('data-id');
                    aplicarFiltros();
                });
            });

            document.querySelectorAll('.filtro-seccion:nth-child(2) .btn-pill').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.filtro-seccion:nth-child(2) .btn-pill').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    filtroActualEstado = e.target.getAttribute('data-estado');
                    aplicarFiltros();
                });
            });

            aplicarFiltros(); 
            procesarTableroGerencial(); 
            configurarBotonReporte();
            iniciarChatInteligente();
        }
    });
}

// --- EVALUADOR MULTIDIMENSIONAL ---
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

    if (esCulminado) {
        estadoRiesgo = 'CULMINADO'; accion = 'Ninguna';
    } else if (esExonerado) {
        estadoRiesgo = 'LEY31955'; accion = 'Archivar';
    } else if (esIndefinido) {
        estadoRiesgo = 'INDEFINIDO'; accion = 'Archivar';
    } else if (esVencidoMatematico && !esTramite) {
        estadoRiesgo = 'CRITICO_SIN_ACCION'; accion = 'Tomar Acción Inmediata'; 
    } else if (esVencidoMatematico && esTramite) {
        estadoRiesgo = 'CRITICO_EN_TRAMITE'; accion = 'Insistir a la Entidad'; 
    } else if (esAlertaTemprana && !esTramite) {
        estadoRiesgo = 'ALERTA_TEMPRANA'; accion = 'Preparar Expediente'; 
    } else if (esTramite) {
        estadoRiesgo = 'TRAMITE_EN_PLAZO'; accion = 'Seguimiento Regular';
    } else if (!isNaN(dNum) && dNum === 0) {
        estadoRiesgo = 'CRITICO_SIN_ACCION'; accion = 'Tomar Acción Inmediata';
    }

    return { diasOriginal: dias, diasValor: isNaN(dNum) ? null : dNum, esTramite: esTramite, esVencido: esVencidoMatematico, estadoRiesgo: estadoRiesgo, accion: accion };
}

function obtenerClaseCSS(estado) {
    const mapa = {
        'CRITICO_SIN_ACCION': 'estado-critico-sin-accion',
        'CRITICO_EN_TRAMITE': 'estado-critico-en-tramite',
        'ALERTA_TEMPRANA': 'estado-alerta',
        'TRAMITE_EN_PLAZO': 'estado-tramite-plazo',
        'LEY31955': 'estado-exonerado',
        'CULMINADO': 'estado-culminado',
        'INDEFINIDO': 'estado-exonerado'
    };
    return mapa[estado] || 'estado-tramite-plazo';
}

function formatearTextoPopup(ev) {
    if (ev.estadoRiesgo === 'CULMINADO') return "Obra Finalizada";
    if (ev.estadoRiesgo === 'LEY31955') return "Amparo Ley N° 31955";
    if (ev.estadoRiesgo === 'INDEFINIDO') return "Plazo Indefinido";

    let textoDias = "";
    if (ev.diasValor !== null) {
        textoDias = ev.diasValor < 0 ? `¡Vencido hace ${Math.abs(ev.diasValor)} días!` : `Quedan ${ev.diasValor} días`;
    }

    if (ev.estadoRiesgo === 'CRITICO_EN_TRAMITE' || ev.estadoRiesgo === 'TRAMITE_EN_PLAZO') {
        return `Renovación en Trámite ${textoDias ? '(' + textoDias + ')' : ''}`;
    }
    return textoDias || ev.diasOriginal || "No definido";
}

function aplicarEstiloMarcador(marker, estado) {
    marker.getElement()?.classList.remove('brillo-preventivo', 'brillo-tramite-vencido');
    
    if (estado === 'CRITICO_SIN_ACCION') {
        marker.setStyle({ fillColor: "#dc2626", color: "#ffffff", weight: 2 });
    } else if (estado === 'CRITICO_EN_TRAMITE') {
        marker.setStyle({ fillColor: "#c026d3", color: "#dc2626", weight: 3 });
        marker.getElement()?.classList.add('brillo-tramite-vencido');
    } else if (estado === 'ALERTA_TEMPRANA') {
        marker.setStyle({ fillColor: "#f59e0b", color: "#ffffff", weight: 2 });
        marker.getElement()?.classList.add('brillo-preventivo');
    } else if (estado === 'LEY31955') {
        marker.setStyle({ fillColor: "#f97316", color: "#ffffff", weight: 2 });
    } else if (estado === 'TRAMITE_EN_PLAZO') {
        marker.setStyle({ fillColor: "#3b82f6", color: "#ffffff", weight: 2 });
    } else {
        marker.setStyle({ fillColor: "#10b981", color: "#ffffff", weight: 2 });
    }
}

function determinarSeveridadVisual(obra, desvio) {
    const peso = { 'CRITICO_SIN_ACCION': 5, 'CRITICO_EN_TRAMITE': 4, 'ALERTA_TEMPRANA': 3, 'TRAMITE_EN_PLAZO': 2, 'LEY31955': 1, 'VIGENTE': 0, 'INDEFINIDO': 0, 'CULMINADO': -1 };
    return peso[obra.estadoRiesgo] > peso[desvio.estadoRiesgo] ? obra.estadoRiesgo : desvio.estadoRiesgo;
}

function aplicarFiltros() {
    grupoMarcadores.clearLayers(); 
    let boundsCount = 0;
    
    marcadoresGuardados.forEach(obj => {
        let mostrarPorID = (filtroActualID === "Todos" || obj.datos.ID === filtroActualID);
        let mostrarPorEstado = true;
        
        if (filtroActualEstado === "Criticos") {
            mostrarPorEstado = (obj.severidadGlobal === 'CRITICO_SIN_ACCION');
        } else if (filtroActualEstado === "Tramite") {
            mostrarPorEstado = (obj.evalObra.esTramite || obj.evalDesvio.esTramite);
        } else if (filtroActualEstado === "Menor4Meses") {
            mostrarPorEstado = (obj.severidadGlobal === 'ALERTA_TEMPRANA');
        }
        
        if (mostrarPorID && mostrarPorEstado) { 
            obj.marcador.addTo(grupoMarcadores); 
            boundsCount++; 
        }
    });
    
    if (boundsCount > 0) map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30], maxZoom: 15 });
}

// --- TABLERO GERENCIAL Y SEMÁFORO ---
function procesarTableroGerencial() {
    let tCriticos = 0, tTramite = 0, tAlerta = 0, tLey = 0, tCulminado = 0;
    let dataSemaforo = [];
    let dataGrafico = [];

    marcadoresGuardados.forEach(obj => {
        const { evalObra, evalDesvio, datos } = obj;

        // Sumatoria KPIs (Se mide de forma independiente para mostrar la brecha)
        if (evalObra.esVencido || evalDesvio.esVencido) tCriticos++;
        if (evalObra.esTramite || evalDesvio.esTramite) tTramite++;
        if (obj.severidadGlobal === 'ALERTA_TEMPRANA') tAlerta++;
        if (obj.severidadGlobal === 'LEY31955') tLey++;
        if (obj.severidadGlobal === 'CULMINADO') tCulminado++;

        [ { tipo: 'Obra', ev: evalObra, res: datos.Aut_Obra_Resolucion }, { tipo: 'Desvío', ev: evalDesvio, res: datos.Aut_Desvio_Resolucion } ].forEach(item => {
            if (item.ev.estadoRiesgo === 'CRITICO_SIN_ACCION' || item.ev.estadoRiesgo === 'CRITICO_EN_TRAMITE' || item.ev.estadoRiesgo === 'ALERTA_TEMPRANA') {
                dataSemaforo.push({
                    id: datos.ID, jurisdiccion: datos.Municipalidad, tipo: item.tipo, 
                    resolucion: item.res, dias: item.ev.diasValor, 
                    estado: item.ev.estadoRiesgo, accion: item.ev.accion
                });
            }
            if (item.ev.esTramite && item.ev.diasValor !== null && item.ev.diasValor < 0) {
                dataGrafico.push({ id: `${datos.ID}-${item.tipo.substring(0,3)}`, diasTranscurridos: Math.abs(item.ev.diasValor) });
            }
        });
    });

    if(document.getElementById('kpi-rojo')) document.getElementById('kpi-rojo').innerText = tCriticos;
    if(document.getElementById('kpi-morado')) document.getElementById('kpi-morado').innerText = tTramite;
    if(document.getElementById('kpi-amarillo')) document.getElementById('kpi-amarillo').innerText = tAlerta;
    if(document.getElementById('kpi-naranja')) document.getElementById('kpi-naranja').innerText = tLey;
    if(document.getElementById('kpi-verde')) document.getElementById('kpi-verde').innerText = tCulminado;

    renderizarTablaSemaforo(dataSemaforo);
    dataGrafico.sort((a, b) => b.diasTranscurridos - a.diasTranscurridos);
    renderizarGrafico(dataGrafico.slice(0, 15)); // Muestra los 15 trámites más atrasados
}

function renderizarTablaSemaforo(data) {
    const tbody = document.getElementById('tabla-semaforo-riesgos');
    if (!tbody) return;
    tbody.innerHTML = '';

    const jerarquia = { 'CRITICO_SIN_ACCION': 1, 'CRITICO_EN_TRAMITE': 2, 'ALERTA_TEMPRANA': 3 };
    data.sort((a, b) => jerarquia[a.estado] - jerarquia[b.estado] || a.dias - b.dias);

    data.forEach(fila => {
        let claseColor = fila.estado === 'CRITICO_SIN_ACCION' ? 'bg-red-600 text-white' : 
                         fila.estado === 'CRITICO_EN_TRAMITE' ? 'bg-fuchsia-600 text-white' : 'bg-yellow-400 text-black';
        let textoDias = fila.dias < 0 ? `${fila.dias} días (Vencido)` : `${fila.dias} días (Alerta)`;

        tbody.innerHTML += `
            <tr class="border-b hover:bg-slate-50 transition-colors">
                <td class="p-3 font-bold text-slate-700">${fila.id}</td>
                <td class="p-3 text-slate-600">${fila.jurisdiccion}</td>
                <td class="p-3 text-slate-600">${fila.tipo}</td>
                <td class="p-3 text-xs text-slate-500">${fila.resolucion || 'S/N'}</td>
                <td class="p-3 text-center"><span class="px-2 py-1 rounded shadow-sm font-semibold text-xs whitespace-nowrap ${claseColor}">${textoDias}</span></td>
                <td class="p-3 text-xs font-bold text-slate-700">${fila.accion}</td>
            </tr>`;
    });
    window.dataSemaforoActual = data; 
}

function renderizarGrafico(data) {
    const ctx = document.getElementById('grafico-ranking-tramites');
    if (!ctx) return;
    if (chartInstancia) chartInstancia.destroy();

    const etiquetas = data.map(d => d.id);
    const valores = data.map(d => d.diasTranscurridos);

    if (typeof Chart !== 'undefined') {
        chartInstancia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Días Transcurridos en Entidad (Trámite Vencido)',
                    data: valores,
                    backgroundColor: '#c026d3', 
                    borderRadius: 4
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: '#e2e8f0' } }, x: { grid: { display: false } } } 
            }
        });
    }
}

// --- GENERADOR DE REPORTE EJECUTIVO ---
function configurarBotonReporte() {
    let btn = document.getElementById('btn-reporte-ejecutivo');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (!window.dataSemaforoActual || window.dataSemaforoActual.length === 0) return alert("Cargando datos...");
        
        let fechaHoy = new Date().toLocaleDateString('es-PE');
        let texto = `📊 *CONTROL DE CONTINGENCIAS L2/L4* - ${fechaHoy}\n\n`;
        
        let urgentes = window.dataSemaforoActual.filter(d => d.estado === 'CRITICO_SIN_ACCION');
        let enTramite = window.dataSemaforoActual.filter(d => d.estado === 'CRITICO_EN_TRAMITE');
        
        texto += `🔴 *ACCIÓN INMEDIATA REQUERIDA (${urgentes.length}):*\n`;
        urgentes.forEach(u => texto += `- ${u.id} (${u.tipo}): Vencido hace ${Math.abs(u.dias)} días.\n`);
        
        texto += `\n🟣 *SEGUIMIENTO A ENTIDADES - TRÁMITES EN ESPERA (${enTramite.length}):*\n`;
        enTramite.forEach(t => texto += `- ${t.id} (${t.tipo}): En trámite, vencido hace ${Math.abs(t.dias)} días.\n`);
        
        texto += `\n🔗 *Dashboard Operativo:* https://vlacaspa.github.io/Mapa-Linea-2-4/`;

        navigator.clipboard.writeText(texto).then(() => {
            let textoOriginal = btn.innerHTML;
            btn.innerHTML = "✅ ¡Copiado con Éxito!";
            btn.classList.add('bg-emerald-600');
            setTimeout(() => { btn.innerHTML = textoOriginal; btn.classList.remove('bg-emerald-600'); }, 3000);
        });
    });
}

// --- MÓDULO NLP: CONSULTOR INTELIGENTE ---
function iniciarChatInteligente() {
    const chatWidget = document.getElementById('panel-chat');
    const btnToggle = document.getElementById('chat-header');
    const inputChat = document.getElementById('chat-input');
    const btnEnviar = document.getElementById('btn-enviar-chat');
    const mensajesContainer = document.getElementById('chat-mensajes');

    btnToggle.addEventListener('click', () => {
        if (chatWidget.classList.contains('chat-minimizada')) {
            chatWidget.classList.remove('chat-minimizada');
            chatWidget.classList.add('chat-abierta');
            inputChat.focus();
        } else {
            chatWidget.classList.remove('chat-abierta');
            chatWidget.classList.add('chat-minimizada');
        }
    });

    const agregarMensaje = (texto, tipo) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = tipo === 'user' ? 'msg-user' : 'msg-bot';
        msgDiv.innerHTML = texto;
        mensajesContainer.appendChild(msgDiv);
        mensajesContainer.scrollTop = mensajesContainer.scrollHeight;
    };

    const registrarConsultaEnFirebase = async (textoConsulta) => {
        try {
            await addDoc(collection(db, "historial_permisos"), {
                consulta: textoConsulta, usuario: usuarioActual, fecha: serverTimestamp()
            });
        } catch (e) { console.error("Error telemétrico: ", e); }
    };

    const procesarConsulta = (textoConsulta) => {
        let txt = normalizarTexto(textoConsulta);

        if (txt.includes('por vencer') || txt.includes('4 meses') || txt.includes('vencer')) {
            let lista = marcadoresGuardados.filter(obj => obj.severidadGlobal === 'ALERTA_TEMPRANA').map(obj => obj.datos.ID);
            return lista.length > 0 ? `🟡 <b>Estructuras por vencer (< 4 meses):</b><br>${lista.join(', ')}` : `✅ No hay estructuras por vencer.`;
        }

        if (txt.includes('accion') || txt.includes('critico') || txt.includes('sin accion')) {
            let lista = marcadoresGuardados.filter(obj => obj.severidadGlobal === 'CRITICO_SIN_ACCION').map(obj => obj.datos.ID);
            return lista.length > 0 ? `🔴 <b>Estructuras Sin Acción (Urgente):</b><br>${lista.join(', ')}` : `✅ No hay expedientes olvidados.`;
        }

        if (txt.includes('tramite') || txt.includes('entidad')) {
            let lista = marcadoresGuardados.filter(obj => obj.evalObra.esTramite || obj.evalDesvio.esTramite).map(obj => obj.datos.ID);
            return lista.length > 0 ? `🟣 <b>Estructuras en trámite:</b><br>${lista.join(', ')}` : `No hay estructuras en trámite actualmente.`;
        }

        let estacionHallada = marcadoresGuardados.find(obj => {
            let idLimpio = normalizarTexto(obj.datos.ID);
            return new RegExp(`\\b${idLimpio}\\b`, 'i').test(txt);
        });

        if (!estacionHallada) return "Asegúrate de incluir el código exacto de la estructura (Ej. 'E12' o 'PV19'), o hazme una consulta general como '¿Cuáles requieren acción inmediata?'.";

        let pideTransito = txt.includes('transito') || txt.includes('desvio');
        let pideObra = txt.includes('obra') || txt.includes('cerramiento');
        
        let respuesta = `<b>📍 ${estacionHallada.datos.ID} - ${estacionHallada.datos.Nombre}</b><br>`;

        if (pideTransito && !pideObra) {
            respuesta += `🚦 <b>Tránsito:</b> ${formatearTextoPopup(estacionHallada.evalDesvio)}`;
        } else if (pideObra && !pideTransito) {
            respuesta += `🚧 <b>Obra:</b> ${formatearTextoPopup(estacionHallada.evalObra)}`;
        } else {
            respuesta += `🚧 <b>Obra:</b> ${formatearTextoPopup(estacionHallada.evalObra)}<br>🚦 <b>Tránsito:</b> ${formatearTextoPopup(estacionHallada.evalDesvio)}`;
        }
        return respuesta;
    };

    const enviarConsulta = () => {
        let texto = inputChat.value.trim();
        if (texto !== '') {
            agregarMensaje(texto, 'user');
            inputChat.value = '';
            registrarConsultaEnFirebase(texto);
            setTimeout(() => { agregarMensaje(procesarConsulta(texto), 'bot'); }, 400); 
        }
    };

    btnEnviar.addEventListener('click', enviarConsulta);
    inputChat.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarConsulta(); });
}
