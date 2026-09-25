import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- 1. CREDENCIALES Y AUTENTICACIÓN FIREBASE ---
const firebaseConfig = { /* Tus credenciales exactas aquí */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 
const provider = new GoogleAuthProvider();
let usuarioActual = "anonimo"; 

const CORREOS_MAESTROS = ["zebaxx@gmail.com", "permisosccm2l@gmail.com", "tnoriega.arq@gmail.com", "supervisor@gmail.com"]; 
const DOMINIO_PERMITIDO = "@ccmetrolima.com";

// (Omito la lógica visual del login para mantener concisión; mantén tu bloque de login idéntico)

// --- 2. LÓGICA ESPACIAL, KPIs Y SEMÁFORO DE RIESGOS ---
let mapaInicializado = false;
let map;
let grupoMarcadores;
let marcadoresGuardados = []; 
let filtroActualID = "Todos";
let filtroActualEstado = "Todos";
window.datosGlobales = [];
let chartInstancia = null; // Para destruir/recrear el gráfico

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

// --- NORMALIZADOR DE TEXTO ---
const normalizarTexto = (str) => {
    if (!str) return "";
    return String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

// --- MOTOR PRINCIPAL ---
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
            
            window.datosGlobales.forEach(item => {
                if (item.Latitud && item.Longitud && item.ID) {
                    // Evaluación Multidimensional (Tiempo vs Administrativo)
                    let evalObra = evaluarRiesgo(item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Comentarios);
                    let evalDesvio = evaluarRiesgo(item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Comentarios);
                    
                    let lat = parseFloat(item.Latitud.toString().trim().replace(/,/g, '.'));
                    let lon = parseFloat(item.Longitud.toString().trim().replace(/,/g, '.'));

                    if (!isNaN(lat) && !isNaN(lon)) {
                        let marker = L.circleMarker([lat, lon], { radius: 8, fillColor: "#2563EB", color: "#ffffff", weight: 2, fillOpacity: 0.8 });
                        
                        // Determinar severidad principal del marcador
                        let severidadGlobal = determinarSeveridadVisual(evalObra, evalDesvio);
                        aplicarEstiloMarcador(marker, severidadGlobal);
                        
                        marcadoresGuardados.push({ marcador: marker, datos: item, evalObra: evalObra, evalDesvio: evalDesvio, severidadGlobal: severidadGlobal });
                    }
                }
            });

            aplicarFiltros(); 
            procesarTableroGerencial(); // Ejecuta KPIs, Tabla y Gráfico
            configurarBotonReporte();
        }
    });
}

// --- EVALUADOR MULTIDIMENSIONAL ---
function evaluarRiesgo(dias, comentarios) {
    let dNum = parseInt(dias);
    let textoComentario = normalizarTexto(comentarios);
    
    let esCulminado = normalizarTexto(dias) === "culminado" || textoComentario.includes("culminado");
    let esTramite = textoComentario.includes("tramite");
    let esExonerado = textoComentario.includes("exonerado");
    
    let esVencidoMatematico = !isNaN(dNum) && dNum < 0;
    let esAlertaTemprana = !isNaN(dNum) && dNum >= 0 && dNum <= 120;

    // Matriz de Estados de Riesgo
    let estadoRiesgo = 'VIGENTE';
    let accion = 'Monitorear';

    if (esCulminado) {
        estadoRiesgo = 'CULMINADO'; accion = 'Ninguna';
    } else if (esExonerado) {
        estadoRiesgo = 'LEY31955'; accion = 'Archivar';
    } else if (esVencidoMatematico && !esTramite) {
        estadoRiesgo = 'CRITICO_SIN_ACCION'; accion = 'Tomar Acción Inmediata'; // Rojo
    } else if (esVencidoMatematico && esTramite) {
        estadoRiesgo = 'CRITICO_EN_TRAMITE'; accion = 'Insistir a la Entidad'; // Morado/Fucsia
    } else if (esAlertaTemprana && !esTramite) {
        estadoRiesgo = 'ALERTA_TEMPRANA'; accion = 'Preparar Expediente'; // Amarillo
    } else if (esTramite) {
        estadoRiesgo = 'TRAMITE_EN_PLAZO'; accion = 'Seguimiento Regular';
    }

    return { dias: dNum, esTramite: esTramite, esVencido: esVencidoMatematico, estadoRiesgo: estadoRiesgo, accion: accion };
}

// --- TABLERO GERENCIAL (KPIs, TABLA Y GRÁFICO) ---
function procesarTableroGerencial() {
    let totalCriticos = 0; // Vencidos matemáticamente (independiente de si hay trámite o no)
    let totalEnTramite = 0; // Tienen trámite activo
    let dataSemaforo = [];
    let dataGrafico = [];

    marcadoresGuardados.forEach(obj => {
        const { evalObra, evalDesvio, datos } = obj;

        // Sumatoria para KPIs (Permite superposición lógica)
        if (evalObra.esVencido || evalDesvio.esVencido) totalCriticos++;
        if (evalObra.esTramite || evalDesvio.esTramite) totalEnTramite++;

        // Extracción para Semáforo y Gráfico
        [ { tipo: 'Obra', ev: evalObra, res: datos.Aut_Obra_Resolucion }, 
          { tipo: 'Desvío', ev: evalDesvio, res: datos.Aut_Desvio_Resolucion } ].forEach(item => {
            
            if (item.ev.estadoRiesgo === 'CRITICO_SIN_ACCION' || item.ev.estadoRiesgo === 'CRITICO_EN_TRAMITE' || item.ev.estadoRiesgo === 'ALERTA_TEMPRANA') {
                dataSemaforo.push({
                    id: datos.ID, jurisdiccion: datos.Municipalidad, tipo: item.tipo, 
                    resolucion: item.res, dias: item.ev.dias, 
                    estado: item.ev.estadoRiesgo, accion: item.ev.accion
                });
            }

            if (item.ev.esTramite && !isNaN(item.ev.dias)) {
                // Días transcurridos = Valor absoluto de los días negativos (vencidos)
                let diasTranscurridos = item.ev.dias < 0 ? Math.abs(item.ev.dias) : 0; 
                dataGrafico.push({ id: `${datos.ID}-${item.tipo.substring(0,3)}`, diasTranscurridos: diasTranscurridos });
            }
        });
    });

    // 1. Actualizar KPIs Visuales
    if(document.getElementById('kpi-rojo')) document.getElementById('kpi-rojo').innerText = totalCriticos;
    if(document.getElementById('kpi-morado')) document.getElementById('kpi-morado').innerText = totalEnTramite;
    console.log(`Auditoría: Críticos (${totalCriticos}) - En Trámite (${totalEnTramite}). Brecha de Inacción: ${totalCriticos > totalEnTramite ? totalCriticos - totalEnTramite : 0}`);

    // 2. Renderizar Semáforo de Riesgos (Ordenado por severidad)
    renderizarTablaSemaforo(dataSemaforo);

    // 3. Renderizar Gráfico de Ranking (Ordenado de mayor a menor tiempo transcurrido)
    dataGrafico.sort((a, b) => b.diasTranscurridos - a.diasTranscurridos);
    renderizarGrafico(dataGrafico);
}

function renderizarTablaSemaforo(data) {
    const tbody = document.getElementById('tabla-semaforo-riesgos');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Orden de prioridad: 1. Crítico Sin Acción, 2. Crítico En Trámite, 3. Alerta Temprana
    const jerarquia = { 'CRITICO_SIN_ACCION': 1, 'CRITICO_EN_TRAMITE': 2, 'ALERTA_TEMPRANA': 3 };
    data.sort((a, b) => jerarquia[a.estado] - jerarquia[b.estado] || a.dias - b.dias);

    data.forEach(fila => {
        let claseColor = fila.estado === 'CRITICO_SIN_ACCION' ? 'bg-red-600 text-white font-bold' : 
                         fila.estado === 'CRITICO_EN_TRAMITE' ? 'bg-fuchsia-600 text-white font-bold' : 'bg-yellow-500 text-black';
        let textoDias = fila.dias < 0 ? `${fila.dias} días (Vencido)` : `${fila.dias} días (Alerta)`;

        tbody.innerHTML += `
            <tr class="border-b">
                <td class="p-2 font-bold">${fila.id}</td>
                <td class="p-2">${fila.jurisdiccion}</td>
                <td class="p-2">${fila.tipo}</td>
                <td class="p-2">${fila.resolucion || 'S/N'}</td>
                <td class="p-2 text-center"><span class="px-2 py-1 rounded ${claseColor}">${textoDias}</span></td>
                <td class="p-2 font-semibold">${fila.accion}</td>
            </tr>`;
    });
    window.dataSemaforoActual = data; // Guardar para el botón de reporte
}

function renderizarGrafico(data) {
    const ctx = document.getElementById('grafico-ranking-tramites');
    if (!ctx) return;
    if (chartInstancia) chartInstancia.destroy();

    const etiquetas = data.map(d => d.id);
    const valores = data.map(d => d.diasTranscurridos);

    // Asumiendo que usas Chart.js en tu proyecto
    if (typeof Chart !== 'undefined') {
        chartInstancia = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: etiquetas,
                datasets: [{
                    label: 'Días Transcurridos en Trámite',
                    data: valores,
                    backgroundColor: '#c026d3', // Morado/Fucsia corporativo
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
        });
    }
}

// --- GENERADOR DE REPORTE EJECUTIVO ---
function configurarBotonReporte() {
    let btn = document.getElementById('btn-reporte-ejecutivo');
    if (!btn) return;

    btn.addEventListener('click', () => {
        if (!window.dataSemaforoActual || window.dataSemaforoActual.length === 0) return;
        
        let fechaHoy = new Date().toLocaleDateString('es-PE');
        let texto = `📊 *CONTROL DE CONTINGENCIAS L2/L4* - ${fechaHoy}\n\n`;
        
        let urgentes = window.dataSemaforoActual.filter(d => d.estado === 'CRITICO_SIN_ACCION');
        let enTramite = window.dataSemaforoActual.filter(d => d.estado === 'CRITICO_EN_TRAMITE');
        
        texto += `🔴 *ACCIÓN INMEDIATA REQUERIDA (${urgentes.length}):*\n`;
        urgentes.forEach(u => texto += `- ${u.id} (${u.tipo}): ${u.dias} días sin iniciar gestión.\n`);
        
        texto += `\n🟣 *SEGUIMIENTO A ENTIDADES - TRÁMITES VENCIDOS (${enTramite.length}):*\n`;
        enTramite.forEach(t => texto += `- ${t.id} (${t.tipo}): ${t.dias} días. Insistir resolución.\n`);
        
        texto += `\n🔗 *Dashboard Operativo:* https://vlacaspa.github.io/Mapa-Linea-2-4/`;

        navigator.clipboard.writeText(texto).then(() => {
            btn.innerText = "✅ Reporte Copiado";
            setTimeout(() => btn.innerText = "📋 Copiar Reporte Gerencial", 3000);
        });
    });
}

// (Las funciones de estilo visual de marcadores y filtros se mantienen adaptadas a estas nuevas validaciones)
function aplicarEstiloMarcador(marker, estado) {
    if (estado === 'CRITICO_SIN_ACCION') marker.setStyle({ fillColor: "#dc2626", color: "#ffffff", weight: 2 });
    else if (estado === 'CRITICO_EN_TRAMITE') marker.setStyle({ fillColor: "#c026d3", color: "#dc2626", weight: 3, dashArray: "5, 5" }); // Diferenciador visual
    else if (estado === 'ALERTA_TEMPRANA') marker.setStyle({ fillColor: "#f59e0b", color: "#ffffff", weight: 2 });
    else marker.setStyle({ fillColor: "#10b981", color: "#ffffff", weight: 2 });
}

function determinarSeveridadVisual(obra, desvio) {
    const peso = { 'CRITICO_SIN_ACCION': 4, 'CRITICO_EN_TRAMITE': 3, 'ALERTA_TEMPRANA': 2, 'TRAMITE_EN_PLAZO': 1, 'VIGENTE': 0, 'CULMINADO': -1 };
    return peso[obra.estadoRiesgo] > peso[desvio.estadoRiesgo] ? obra.estadoRiesgo : desvio.estadoRiesgo;
}

function aplicarFiltros() { /* Lógica existente de renderizado geoespacial según selección de botones */ }
