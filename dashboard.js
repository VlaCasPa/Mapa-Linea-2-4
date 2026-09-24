import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

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

const CORREOS_MAESTROS = ["zebaxx@gmail.com", "permisosccm2l@gmail.com", "tnoriega.arq@gmail.com", "supervisor@gmail.com"]; 
const DOMINIO_PERMITIDO = "@ccmetrolima.com";
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

// 1. VIGILANTE DE SEGURIDAD
onAuthStateChanged(auth, (user) => {
    if (user) {
        const email = user.email.toLowerCase();
        if (email.endsWith(DOMINIO_PERMITIDO) || CORREOS_MAESTROS.includes(email)) {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('dashboard-content').style.display = 'block';
            procesarDatosGerenciales();
        } else {
            window.location.href = 'index.html'; 
        }
    } else {
        window.location.href = 'index.html'; 
    }
});

// 2. LÓGICA DE AGRUPACIÓN GEOGRÁFICA
function obtenerProvincia(muni) {
    let m = (muni || '').toLowerCase();
    // Diccionario rápido para el Callao
    if (m.includes('callao') || m.includes('bellavista') || m.includes('carmen de la legua') || m.includes('perla')) {
        return 'Callao';
    }
    return 'Lima';
}

// 3. PROCESAMIENTO DE MATRIZ DE RIESGOS
function procesarDatosGerenciales() {
    Papa.parse(urlCSV, {
        download: true,
        header: true,
        complete: function(results) {
            const datos = results.data;
            const matrizRiesgos = [];
            
            // Variables para Gráficos
            const conteoEstados = { optimo: 0, tramite: 0, critico: 0, vencido: 0 };
            const conteoMuniTipo = {}; // { 'Ate': { obra: 2, transito: 1 } }
            const conteoProvincias = { 'Lima': 0, 'Callao': 0 };

            datos.forEach(item => {
                if (!item.ID) return;
                evaluarPermiso(item, 'Obra', item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Resolucion, matrizRiesgos, conteoEstados, conteoMuniTipo, conteoProvincias);
                evaluarPermiso(item, 'Desvío de Tránsito', item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Resolucion, matrizRiesgos, conteoEstados, conteoMuniTipo, conteoProvincias);
            });

            renderizarTabla(matrizRiesgos);
            renderizarGraficos(conteoEstados, conteoMuniTipo, conteoProvincias);
        }
    });
}

function evaluarPermiso(item, tipo, diasStr, resolucion, matrizRiesgos, conteoEstados, conteoMuniTipo, conteoProvincias) {
    if (!diasStr && diasStr !== 0) return;
    let d = diasStr.toString().trim().toLowerCase();
    
    // Filtros de Exclusión (Sanos)
    if (d === 'culminada' || d === 'culminado' || d === 'exonerado' || d === 'indefinido') {
        conteoEstados.optimo++; return;
    }
    if (d === 'en trámite') {
        conteoEstados.tramite++; return; 
    }

    let diasNum = parseInt(diasStr);
    if (isNaN(diasNum)) return;

    let estadoCategoria = '';
    let claseBadge = '';
    let accion = '';
    let esRiesgoActivo = false;

    if (diasNum < 0) {
        estadoCategoria = 'Vencido'; claseBadge = 'bg-vencido'; accion = 'Urgente: Regularización';
        conteoEstados.vencido++; esRiesgoActivo = true;
    } else if (diasNum <= 28) {
        estadoCategoria = 'Crítico'; claseBadge = 'bg-critico'; accion = 'Alta Prioridad: Ingreso exp.';
        conteoEstados.critico++; esRiesgoActivo = true;
    } else if (diasNum <= 120) {
        estadoCategoria = 'Alerta Temprana'; claseBadge = 'bg-alerta'; accion = 'Preparar exp. técnico';
        conteoEstados.optimo++; esRiesgoActivo = true; 
    } else {
        conteoEstados.optimo++; return; 
    }

    // Llenado de métricas (Solo si entra al semáforo)
    if (esRiesgoActivo) {
        let muni = item.Municipalidad ? item.Municipalidad.trim() : 'Desconocida';
        let prov = obtenerProvincia(muni);
        
        // Asignación Provincial
        conteoProvincias[prov]++;

        // Asignación por Muni y Tipo
        if (!conteoMuniTipo[muni]) conteoMuniTipo[muni] = { obra: 0, transito: 0 };
        if (tipo === 'Obra') conteoMuniTipo[muni].obra++;
        else conteoMuniTipo[muni].transito++;
    }

    // Identificador para el CSS Pastel
    let claseFila = tipo === 'Obra' ? 'row-obra' : 'row-transito';

    matrizRiesgos.push({
        id: item.ID,
        municipalidad: item.Municipalidad || 'No especificada',
        tipo: tipo,
        resolucion: resolucion || 'S/R',
        diasRestantesNum: diasNum,
        diasHTML: `<span class="badge-riesgo ${claseBadge}">${diasNum} días (${estadoCategoria})</span>`,
        accion: accion,
        claseFila: claseFila
    });
}

function renderizarTabla(matriz) {
    const tbody = document.querySelector('#tablaRiesgos tbody');
    tbody.innerHTML = '';

    matriz.forEach(fila => {
        const tr = document.createElement('tr');
        tr.className = fila.claseFila; // Aplica el color pastel (Azul o Morado)
        tr.innerHTML = `
            <td><b>${fila.id}</b></td>
            <td>${fila.municipalidad}</td>
            <td>${fila.tipo}</td>
            <td>${fila.resolucion}</td>
            <td data-order="${fila.diasRestantesNum}">${fila.diasHTML}</td>
            <td>${fila.accion}</td>
        `;
        tbody.appendChild(tr);
    });

    $('#tablaRiesgos').DataTable({
        language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' },
        order: [[4, 'asc']],
        pageLength: 10,
        bLengthChange: false
    });
}

function renderizarGraficos(conteoEstados, conteoMuniTipo, conteoProvincias) {
    // 1. Salud General
    const ctxEstado = document.getElementById('chartEstadoGeneral').getContext('2d');
    new Chart(ctxEstado, {
        type: 'doughnut',
        data: {
            labels: ['Óptimo', 'En Trámite', 'Críticos', 'Vencidos'],
            datasets: [{
                data: [conteoEstados.optimo, conteoEstados.tramite, conteoEstados.critico, conteoEstados.vencido],
                backgroundColor: ['#10b981', '#a855f7', '#f97316', '#ef4444'], borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    });

    // 2. Lima vs Callao
    const ctxProv = document.getElementById('chartProvincias').getContext('2d');
    new Chart(ctxProv, {
        type: 'pie',
        data: {
            labels: ['Lima', 'Callao'],
            datasets: [{
                data: [conteoProvincias.Lima, conteoProvincias.Callao],
                backgroundColor: ['#0ea5e9', '#f43f5e'], borderWidth: 2, borderColor: '#ffffff'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });

    // 3. Cuellos de Botella Agrupados (Obra vs Tránsito)
    const ctxMuni = document.getElementById('chartMunicipalidades').getContext('2d');
    const etiquetasMuni = Object.keys(conteoMuniTipo);
    const dataObra = etiquetasMuni.map(muni => conteoMuniTipo[muni].obra);
    const dataTransito = etiquetasMuni.map(muni => conteoMuniTipo[muni].transito);

    new Chart(ctxMuni, {
        type: 'bar',
        data: {
            labels: etiquetasMuni,
            datasets: [
                { label: 'Obra', data: dataObra, backgroundColor: '#3b82f6', borderRadius: 4 },
                { label: 'Desvío de Tránsito', data: dataTransito, backgroundColor: '#a855f7', borderRadius: 4 }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, 
            plugins: { legend: { position: 'bottom' } } 
        }
    });
}
