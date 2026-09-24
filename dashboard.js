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

// 2. PROCESAMIENTO DE MATRIZ DE RIESGOS
function procesarDatosGerenciales() {
    Papa.parse(urlCSV, {
        download: true,
        header: true,
        complete: function(results) {
            const datos = results.data;
            const matrizRiesgos = [];
            const conteoEstados = { optimo: 0, tramite: 0, critico: 0, vencido: 0 };
            const conteoMunicipalidades = {};

            datos.forEach(item => {
                if (!item.ID) return;
                evaluarPermiso(item, 'Obra', item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Resolucion, matrizRiesgos, conteoEstados, conteoMunicipalidades);
                evaluarPermiso(item, 'Desvío de Tránsito', item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Resolucion, matrizRiesgos, conteoEstados, conteoMunicipalidades);
            });

            renderizarTabla(matrizRiesgos);
            renderizarGraficos(conteoEstados, conteoMunicipalidades);
        }
    });
}

function evaluarPermiso(item, tipo, diasStr, resolucion, matrizRiesgos, conteoEstados, conteoMunicipalidades) {
    if (!diasStr && diasStr !== 0) return;
    let d = diasStr.toString().trim().toLowerCase();
    
    if (d === 'culminada' || d === 'culminado' || d === 'exonerado' || d === 'indefinido') {
        conteoEstados.optimo++;
        return;
    }
    
    if (d === 'en trámite') {
        conteoEstados.tramite++;
        return; 
    }

    let diasNum = parseInt(diasStr);
    if (isNaN(diasNum)) return;

    let estadoCategoria = '';
    let claseBadge = '';
    let accion = '';

    if (diasNum < 0) {
        estadoCategoria = 'Vencido';
        claseBadge = 'bg-vencido';
        accion = 'Urgente: Regularización inmediata';
        conteoEstados.vencido++;
        registrarMunicipalidad(conteoMunicipalidades, item.Municipalidad);
    } else if (diasNum <= 28) {
        estadoCategoria = 'Crítico';
        claseBadge = 'bg-critico';
        accion = 'Alta Prioridad: Ingresar expediente';
        conteoEstados.critico++;
        registrarMunicipalidad(conteoMunicipalidades, item.Municipalidad);
    } else if (diasNum <= 120) {
        estadoCategoria = 'Alerta Temprana';
        claseBadge = 'bg-alerta';
        accion = 'Preparar expediente técnico';
        conteoEstados.optimo++; 
        registrarMunicipalidad(conteoMunicipalidades, item.Municipalidad); // Agregado para robustecer el gráfico
    } else {
        conteoEstados.optimo++;
        return; 
    }

    matrizRiesgos.push({
        id: item.ID,
        municipalidad: item.Municipalidad || 'No especificada',
        tipo: tipo,
        resolucion: resolucion || 'S/R',
        diasRestantesNum: diasNum,
        diasHTML: `<span class="badge-riesgo ${claseBadge}">${diasNum} días (${estadoCategoria})</span>`,
        accion: accion
    });
}

function registrarMunicipalidad(diccionario, municipalidad) {
    let muni = municipalidad ? municipalidad.trim() : 'Desconocida';
    if (!diccionario[muni]) diccionario[muni] = 0;
    diccionario[muni]++;
}

function renderizarTabla(matriz) {
    const tbody = document.querySelector('#tablaRiesgos tbody');
    tbody.innerHTML = '';

    matriz.forEach(fila => {
        const tr = document.createElement('tr');
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
        language: { url: 'https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json' }, // Protocolo HTTPS forzado
        order: [[4, 'asc']],
        pageLength: 10,
        bLengthChange: false
    });
}

function renderizarGraficos(conteoEstados, conteoMunicipalidades) {
    const ctxEstado = document.getElementById('chartEstadoGeneral').getContext('2d');
    new Chart(ctxEstado, {
        type: 'doughnut',
        data: {
            labels: ['Óptimo/Controlado', 'En Trámite', 'Críticos', 'Vencidos'],
            datasets: [{
                data: [conteoEstados.optimo, conteoEstados.tramite, conteoEstados.critico, conteoEstados.vencido],
                backgroundColor: ['#10b981', '#a855f7', '#f97316', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom' } } }
    });

    const ctxMuni = document.getElementById('chartMunicipalidades').getContext('2d');
    const etiquetasMuni = Object.keys(conteoMunicipalidades);
    const dataMuni = Object.values(conteoMunicipalidades);

    new Chart(ctxMuni, {
        type: 'bar',
        data: {
            labels: etiquetasMuni,
            datasets: [{
                label: 'Permisos en Riesgo o Próximos a Vencer',
                data: dataMuni,
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
    });
}
