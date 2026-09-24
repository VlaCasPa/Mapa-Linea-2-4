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

Chart.register(ChartDataLabels);

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

function obtenerProvincia(muni) {
    let m = (muni || '').toLowerCase();
    if (m.includes('callao') || m.includes('bellavista') || m.includes('carmen de la legua') || m.includes('perla')) return 'Callao';
    return 'Lima';
}

function procesarDatosGerenciales() {
    Papa.parse(urlCSV, {
        download: true,
        header: true,
        complete: function(results) {
            const datos = results.data;
            const matrizRiesgos = [];
            const conteoEstados = { optimo: 0, tramite: 0, critico: 0, vencido: 0 };
            const conteoMuniTipo = {}; 
            const conteoProvincias = { 'Lima': 0, 'Callao': 0 };
            const rankingTramites = []; 

            datos.forEach(item => {
                if (!item.ID) return;
                evaluarPermiso(item, 'Obra', item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Resolucion, matrizRiesgos, conteoEstados, conteoMuniTipo, conteoProvincias, rankingTramites);
                evaluarPermiso(item, 'Desvío de Tránsito', item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Resolucion, matrizRiesgos, conteoEstados, conteoMuniTipo, conteoProvincias, rankingTramites);
            });

            renderizarTabla(matrizRiesgos);
            renderizarGraficos(conteoEstados, conteoMuniTipo, conteoProvincias, rankingTramites);
        }
    });
}

function evaluarPermiso(item, tipo, diasStr, resolucion, matrizRiesgos, conteoEstados, conteoMuniTipo, conteoProvincias, rankingTramites) {
    if (!diasStr && diasStr !== 0) return;
    let d = diasStr.toString().trim().toLowerCase();
    
    if (d === 'en trámite') {
        conteoEstados.tramite++;
        let colDiasTramite = tipo === 'Obra' ? item.Dias_Tramite_Obra : item.Dias_Tramite_Desvio;
        let diasIngresado = parseInt(colDiasTramite);
        if (isNaN(diasIngresado)) diasIngresado = 0; 
        
        rankingTramites.push({
            etiqueta: `${item.ID} (${tipo})`,
            dias: diasIngresado
        });
        return; 
    }

    if (d === 'culminada' || d === 'culminado' || d === 'exonerado' || d === 'indefinido') {
        conteoEstados.optimo++; return;
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

    if (esRiesgoActivo) {
        let muni = item.Municipalidad ? item.Municipalidad.trim() : 'Desconocida';
        let prov = obtenerProvincia(muni);
        conteoProvincias[prov]++;

        // Recolección de IDs para la Leyenda Inferior
        if (!conteoMuniTipo[muni]) conteoMuniTipo[muni] = { obra: 0, transito: 0, idsObra: [], idsTransito: [] };
        if (tipo === 'Obra') {
            conteoMuniTipo[muni].obra++;
            conteoMuniTipo[muni].idsObra.push(item.ID);
        } else {
            conteoMuniTipo[muni].transito++;
            conteoMuniTipo[muni].idsTransito.push(item.ID);
        }
    }

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
        tr.className = fila.claseFila; 
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

function renderizarGraficos(conteoEstados, conteoMuniTipo, conteoProvincias, rankingTramites) {
    
    const pluginCircular = {
        color: '#ffffff',
        font: { weight: 'bold', size: 12 },
        textAlign: 'center',
        formatter: (value, ctx) => {
            let sum = 0;
            ctx.chart.data.datasets[0].data.map(data => { sum += data; });
            if (sum === 0 || value === 0) return null; 
            let pct = (value * 100 / sum).toFixed(1) + "%";
            return [value, pct]; 
        }
    };

    const pluginBarras = {
        color: '#475569',
        font: { weight: 'bold', size: 10 },
        textAlign: 'center',
        anchor: 'end',
        align: 'top',
        formatter: (value, ctx) => {
            if (value === 0) return null;
            let total = 0;
            ctx.chart.data.datasets.forEach(ds => { ds.data.forEach(v => { total += v; }); });
            if (total === 0) return null;
            let pct = (value * 100 / total).toFixed(1) + "%";
            return [value, pct];
        }
    };

    const ctxEstado = document.getElementById('chartEstadoGeneral').getContext('2d');
    new Chart(ctxEstado, {
        type: 'doughnut',
        data: {
            labels: ['Óptimo', 'En Trámite', 'Críticos', 'Vencidos'],
            datasets: [{ data: [conteoEstados.optimo, conteoEstados.tramite, conteoEstados.critico, conteoEstados.vencido], backgroundColor: ['#10b981', '#a855f7', '#f97316', '#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { position: 'bottom' }, datalabels: pluginCircular } }
    });

    const ctxProv = document.getElementById('chartProvincias').getContext('2d');
    new Chart(ctxProv, {
        type: 'pie',
        data: {
            labels: ['Lima', 'Callao'],
            datasets: [{ data: [conteoProvincias.Lima, conteoProvincias.Callao], backgroundColor: ['#0ea5e9', '#f43f5e'], borderWidth: 2, borderColor: '#ffffff' }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, datalabels: pluginCircular } }
    });

    rankingTramites.sort((a, b) => b.dias - a.dias); 
    const topTramites = rankingTramites.slice(0, 10); 
    const etiquetasTramites = topTramites.map(t => t.etiqueta);
    const dataTramites = topTramites.map(t => t.dias);

    const ctxRanking = document.getElementById('chartRankingTramites').getContext('2d');
    new Chart(ctxRanking, {
        type: 'bar',
        data: {
            labels: etiquetasTramites,
            datasets: [{
                label: 'Días en la Municipalidad',
                data: dataTramites,
                backgroundColor: '#f59e0b',
                borderRadius: 4,
                minBarLength: 5 // Asegura que se vea al menos una pequeña barra aunque el valor sea 0
            }]
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false, 
            layout: { padding: { right: 85 } }, 
            scales: { x: { beginAtZero: true } }, 
            plugins: { 
                legend: { display: false },
                datalabels: { 
                    color: '#475569', 
                    font: { weight: 'bold', size: 10 },
                    align: 'right', 
                    anchor: 'end', 
                    formatter: (value) => value > 0 ? value + " días" : 'Falta en Excel' 
                }
            } 
        }
    });

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
            layout: { padding: { top: 35 } }, 
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, 
            plugins: { 
                legend: { position: 'bottom' },
                datalabels: pluginBarras,
                // NUEVO: Tooltip enriquecido para mostrar IDs al pasar el mouse
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            let muni = context.label;
                            let type = context.dataset.label;
                            let ids = type === 'Obra' ? conteoMuniTipo[muni].idsObra : conteoMuniTipo[muni].idsTransito;
                            return 'Estructuras: ' + (ids.length > 0 ? ids.join(', ') : 'Ninguna');
                        }
                    }
                }
            } 
        }
    });

    // Construcción de la Leyenda HTML (Debajo del Gráfico)
    let leyendaHTML = '';
    etiquetasMuni.forEach(muni => {
        let idsO = conteoMuniTipo[muni].idsObra;
        let idsT = conteoMuniTipo[muni].idsTransito;
        if (idsO.length > 0 || idsT.length > 0) {
            leyendaHTML += `<div><b>📍 ${muni}:</b> `;
            if (idsO.length > 0) leyendaHTML += `<span class="tag-obra">Obra (${idsO.join(', ')})</span>. `;
            if (idsT.length > 0) leyendaHTML += `<span class="tag-transito">Tránsito (${idsT.join(', ')})</span>.`;
            leyendaHTML += `</div>`;
        }
    });
    document.getElementById('leyenda-estructuras').innerHTML = leyendaHTML;
}
