const map = L.map('map').setView([-12.055, -77.050], 12);

L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
    attribution: '&copy; Google',
    opacity: 0.75,
    className: 'mapa-google-gris'
}).addTo(map);

const grupoMarcadores = L.featureGroup().addTo(map);
let marcadoresGuardados = []; 
let filtroActualID = "Todos";
let filtroActualEstado = "Todos";
window.datosGlobales = [];

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

// BASE DE DATOS: PATRIMONIO HISTÓRICO (MIN. CULTURA)
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

// BASE DE DATOS: PROVIAS NACIONAL (RAMAL L4)
const dataProvias = {
    "PV4 01BIS": [
        { res: "RSD N° 3540-2023-MTC-20.13.2", fecha: "02/03/2023" },
        { res: "RSD N° 3542-2023-MTC-20.13.2", fecha: "03/03/2023" }
    ],
    "PV4-01": [{ res: "RSD N° 14248-2023-MTC/20.13.2", fecha: "13/09/2023" }],
    "PV4-02": [{ res: "RSD N° 15164-2023-MTC/20.13.2", fecha: "27/09/2023" }],
    "PV4-03": [{ res: "RSD N° 15390-2023-MTC/20.13.2", fecha: "28/09/2023" }],
    "PV4-04": [{ res: "RSD N° 17470-2024-MTC/20.13.2", fecha: "22/10/2024" }],
    "PV4-05": [{ res: "RSD N° 13370 -2024-MTC/20.13.2", fecha: "23/08/2024" }],
    "PV4-06": [{ res: "RSD N° 19468-2024-MTC/20.13.2", fecha: "21/11/2024" }],
    "E4-01": [{ res: "RSD N° 12571 -2023-MTC/20.13.2", fecha: "17/08/2023" }],
    "E4-02": [{ res: "RSD N° 14860-2023-MTC/20.13.2", fecha: "22/09/2023" }],
    "E4-03": [{ res: "RSD N° 14675-2023-MTC/20.13.2", fecha: "19/09/2023" }],
    "E4-04": [{ res: "RSD N° 6975-2024-MTC-20.13.2", fecha: "10/05/2024" }],
    "E4-05": [{ res: "RSD N° 6630-2024-MTC/20,13,2", fecha: "03/05/2024" }],
    "E4-06": [{ res: "RSD N° 6631-2024-MTC/20,13,2", fecha: "03/05/2024" }]
};

function obtenerClaseEstado(dias) {
    if (!dias && dias !== 0) return 'estado-critico'; 
    let d = dias.toString().trim().toLowerCase();
    if (d === "exonerado") return 'estado-exonerado';
    if (d === "indefinido") return 'estado-indefinido';
    if (d === "en trámite") return 'estado-tramite';
    if (d === "culminado" || d === "culminada") return 'estado-culminado'; 
    
    let numDias = parseInt(dias);
    if (numDias >= 29) return 'estado-optimo';
    if (numDias >= 0 && numDias < 29) return 'estado-alerta'; 
    if (numDias < 0) return 'estado-vencido'; 
    return 'estado-critico';
}

function formatearDias(dias) {
    let d = dias.toString().trim().toLowerCase();
    if (d === "exonerado") return "Amparo Ley N° 31955";
    if (d === "indefinido") return "Plazo Indefinido";
    if (d === "en trámite") return "Renovación en Trámite";
    if (d === "culminado" || d === "culminada") return "Obra Finalizada"; 
    
    let num = parseInt(dias);
    if (num < 0) return `¡VENCIDO HACE ${Math.abs(num)} DÍAS!`;
    return `Quedan ${num} días`;
}

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

                let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);
                
                let comObra = item.Aut_Obra_Comentarios ? `
                    <details class="popup-details">
                        <summary class="popup-summary">💬 Ver comentarios de obra...</summary>
                        <div class="popup-comment-text">${item.Aut_Obra_Comentarios}</div>
                    </details>` : '';
                    
                let comDesvio = item.Aut_Desvio_Comentarios ? `
                    <details class="popup-details">
                        <summary class="popup-summary">💬 Ver comentarios de desvío...</summary>
                        <div class="popup-comment-text">${item.Aut_Desvio_Comentarios}</div>
                    </details>` : '';

                // INYECCIÓN CULTURAL (MINCUL)
                let htmlMinCultura = '';
                if (dataMinCultura[item.ID]) {
                    let historialFases = dataMinCultura[item.ID].map(f => 
                        `<div style="margin-bottom:6px; border-bottom:1px solid #e0e7ff; padding-bottom:4px;">
                            <span style="background:#818cf8; color:white; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:bold;">${f.fase}</span><br>
                            <span style="font-size:11px; color:#334155; font-weight:600;">Res: ${f.res}</span><br>
                            <span style="font-size:10px; color:#64748b;">Emitida: ${f.fecha}</span>
                        </div>`
                    ).join('');
                    htmlMinCultura = `<div class="auth-box" style="background-color:#eef2ff; border-left:4px solid #6366f1;"><span class="auth-title" style="color:#312e81;">🏛️ Patrimonio (Min. Cultura)</span>${historialFases}</div>`;
                }

                // INYECCIÓN PROVIAS (L4)
                let htmlProvias = '';
                if (dataProvias[item.ID]) {
                    let historialProvias = dataProvias[item.ID].map(p => 
                        `<div style="margin-bottom:6px; border-bottom:1px solid #e0f2fe; padding-bottom:4px;">
                            <span style="background:#38bdf8; color:white; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:bold;">PROVIAS NACIONAL</span><br>
                            <span style="font-size:11px; color:#334155; font-weight:600;">Aut: ${p.res}</span><br>
                            <span style="font-size:10px; color:#64748b;">Emitida: ${p.fecha}</span>
                        </div>`
                    ).join('');
                    htmlProvias = `<div class="auth-box" style="background-color:#f0f9ff; border-left:4px solid #0284c7;"><span class="auth-title" style="color:#0369a1;">🛣️ Vial Nacional (Provias)</span>${historialProvias}</div>`;
                }

                let popupContent = `
                    <div class="popup-container">
                        <h3 class="popup-title">${item.ID}: ${item.Nombre}</h3>
                        <div class="popup-subtitle">📍 ${item.Municipalidad} | ${item.Linea} - ${item.Tipo}</div>
                        <div class="auth-box ${claseObra}">
                            <span class="auth-title">🚧 Autorización de Obra</span>
                            Resolución: ${item.Aut_Obra_Resolucion || 'N/A'}<br>
                            Estado: <b>${formatearDias(item.Aut_Obra_Dias_Restantes)}</b>
                            ${comObra}
                        </div>
                        <div class="auth-box ${claseDesvio}">
                            <span class="auth-title">🚦 Desvío de Tránsito</span>
                            Resolución: ${item.Aut_Desvio_Resolucion || 'N/A'}<br>
                            Estado: <b>${formatearDias(item.Aut_Desvio_Dias_Restantes)}</b>
                            ${comDesvio}
                        </div>
                        ${htmlMinCultura}
                        ${htmlProvias}
                    </div>
                `;

                let latText = item.Latitud ? item.Latitud.toString().trim().replace(/,/g, '.') : "";
                let lonText = item.Longitud ? item.Longitud.toString().trim().replace(/,/g, '.') : "";
                let lat = parseFloat(latText);
                let lon = parseFloat(lonText);

                if (!isNaN(lat) && !isNaN(lon)) {
                    let markerColor = item.Tipo && item.Tipo.toLowerCase() === "pozo" ? "#475569" : "#2563EB"; 
                    let severidad = 'normal';
                    let aplicaLey = (claseObra === 'estado-exonerado' || claseDesvio === 'estado-exonerado'); 

                    let diasObra = parseInt(item.Aut_Obra_Dias_Restantes);
                    let diasDesvio = parseInt(item.Aut_Desvio_Dias_Restantes);
                    let alertaPreventiva = ((!isNaN(diasObra) && diasObra >= 0 && diasObra <= 120) || (!isNaN(diasDesvio) && diasDesvio >= 0 && diasDesvio <= 120));

                    if (claseObra === 'estado-culminado' || claseDesvio === 'estado-culminado') {
                        markerColor = "#10B981"; severidad = 'culminado'; alertaPreventiva = false;
                    } else if (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido' || claseObra === 'estado-critico' || claseDesvio === 'estado-critico') {
                        markerColor = "#DC2626"; severidad = (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido') ? 'vencido' : 'critico'; alertaPreventiva = false;
                    } else if (claseObra === 'estado-tramite' || claseDesvio === 'estado-tramite') {
                        severidad = 'tramite';
                    }
                    
                    let marker = L.circleMarker([lat, lon], { radius: 8, fillColor: markerColor, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8 });
                    marker.bindPopup(popupContent);
                    marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });
                    
                    marcadoresGuardados.push({ marcador: marker, datos: item, estadoSeveridad: severidad, colorOriginal: markerColor, esLey31955: aplicaLey, esMenor4Meses: alertaPreventiva });
                }
            }
        });

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
        actualizarKPIs(); 
    }
});

function aplicarFiltros() {
    grupoMarcadores.clearLayers(); 
    let boundsCount = 0;
    
    marcadoresGuardados.forEach(obj => {
        let mostrarPorID = (filtroActualID === "Todos" || obj.datos.ID === filtroActualID);
        let mostrarPorEstado = true;
        
        if (filtroActualEstado === "Criticos") mostrarPorEstado = (obj.estadoSeveridad === 'vencido' || obj.estadoSeveridad === 'critico');
        else if (filtroActualEstado === "Menor4Meses") mostrarPorEstado = obj.esMenor4Meses;
        else if (filtroActualEstado === "Tramite") mostrarPorEstado = (obj.estadoSeveridad === 'tramite');
        else if (filtroActualEstado === "Culminado") mostrarPorEstado = (obj.estadoSeveridad === 'culminado');
        else if (filtroActualEstado === "Ley31955") mostrarPorEstado = obj.esLey31955; 

        if (filtroActualEstado === "Ley31955" && obj.esLey31955) obj.marcador.setStyle({ fillColor: "#F97316" }); 
        else if (filtroActualEstado === "Tramite" && obj.estadoSeveridad === 'tramite') obj.marcador.setStyle({ fillColor: "#A855F7" }); 
        else if (filtroActualEstado === "Menor4Meses" && obj.esMenor4Meses) obj.marcador.setStyle({ fillColor: "#EAB308" }); 
        else obj.marcador.setStyle({ fillColor: obj.colorOriginal }); 

        if (mostrarPorID && mostrarPorEstado) { 
            obj.marcador.addTo(grupoMarcadores); 
            boundsCount++; 
        }
    });
    
    if (boundsCount > 0) map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30], maxZoom: 15 });
}

function actualizarKPIs() {
    let countCriticos = 0, countPorVencer = 0, countLey = 0, countTramite = 0, countCulminados = 0;
    
    marcadoresGuardados.forEach(obj => {
        if (obj.estadoSeveridad === 'vencido' || obj.estadoSeveridad === 'critico') countCriticos++;
        else if (obj.esMenor4Meses && obj.estadoSeveridad !== 'culminado') countPorVencer++;
        else if (obj.esLey31955) countLey++;
        else if (obj.estadoSeveridad === 'tramite') countTramite++;
        else if (obj.estadoSeveridad === 'culminado') countCulminados++;
    });

    if (document.getElementById('kpi-rojo')) document.getElementById('kpi-rojo').innerText = countCriticos;
    if (document.getElementById('kpi-amarillo')) document.getElementById('kpi-amarillo').innerText = countPorVencer;
    if (document.getElementById('kpi-naranja')) document.getElementById('kpi-naranja').innerText = countLey;
    if (document.getElementById('kpi-morado')) document.getElementById('kpi-morado').innerText = countTramite;
    if (document.getElementById('kpi-verde')) document.getElementById('kpi-verde').innerText = countCulminados;
}

// Motor de Reporte WhatsApp (Corregido y consolidado)
const btnWhatsApp = document.getElementById('btn-whatsapp');
if (btnWhatsApp) {
    btnWhatsApp.addEventListener('click', () => {
        if (!window.datosGlobales || window.datosGlobales.length === 0) return alert("Los datos aún se están cargando...");
        
        let vencidos = [], criticos = [], menor4Meses = [], tramite = [], culminados = [], ley31955 = []; 

        window.datosGlobales.forEach(item => {
            if (item.ID && item.Latitud) {
                let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);
                let esVencido = (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido');
                let esCritico = (claseObra === 'estado-critico' || claseDesvio === 'estado-critico');
                let esTramite = (claseObra === 'estado-tramite' || claseDesvio === 'estado-tramite');
                let esCulminado = (claseObra === 'estado-culminado' || claseDesvio === 'estado-culminado');
                let esLey = (claseObra === 'estado-exonerado' || claseDesvio === 'estado-exonerado'); 
                
                let dObra = parseInt(item.Aut_Obra_Dias_Restantes), dDesvio = parseInt(item.Aut_Desvio_Dias_Restantes);
                let esMenor4 = ((!isNaN(dObra) && dObra >= 0 && dObra <= 120) || (!isNaN(dDesvio) && dDesvio >= 0 && dDesvio <= 120));

                if (esVencido) vencidos.push(item.ID);
                else if (esCritico) criticos.push(item.ID);
                if (esMenor4 && !esCulminado && !esVencido) menor4Meses.push(item.ID);
                if (esTramite && !esVencido && !esCritico) tramite.push(item.ID);
                if (esCulminado && !esVencido && !esCritico && !esTramite) culminados.push(item.ID);
                if (esLey) ley31955.push(item.ID); 
            }
        });

        let fechaHoy = new Date().toLocaleDateString('es-PE');
        let texto = `📊 *REPORTE AUTORIZACIONES - LÍNEA 2 Y RAMAL L4* 🚇\n📅 Fecha: ${fechaHoy}\n\n` +
                    `🔴 *VENCIDOS (${vencidos.length}):* ${vencidos.length > 0 ? vencidos.join(', ') : 'Ninguno'}\n\n` +
                    `🟠 *CRÍTICOS <29 DÍAS (${criticos.length}):* ${criticos.length > 0 ? criticos.join(', ') : 'Ninguno'}\n\n` +
                    `🟡 *POR VENCER < 4 MESES (${menor4Meses.length}):* ${menor4Meses.length > 0 ? menor4Meses.join(', ') : 'Ninguno'}\n\n` +
                    `🟣 *EN TRÁMITE (${tramite.length}):* ${tramite.length > 0 ? tramite.join(', ') : 'Ninguno'}\n\n` +
                    `🟢 *OBRAS CULMINADAS (${culminados.length}):* ${culminados.length > 0 ? culminados.join(', ') : 'Ninguno'}\n\n` +
                    `⚖️ *AMPARO LEY N° 31955 (${ley31955.length}):* ${ley31955.length > 0 ? ley31955.join(', ') : 'Ninguno'}\n\n` +
                    `🔗 *Ver mapa interactivo:* https://vlacaspa.github.io/Mapa-Linea-2-4/`;

        let textArea = document.createElement("textarea");
        textArea.value = texto; 
        document.body.appendChild(textArea); 
        textArea.select();
        try {
            document.execCommand('copy');
            const originalHTML = btnWhatsApp.innerHTML;
            btnWhatsApp.innerHTML = `<span class="btn-text-main">✅ ¡Copiado!</span><span class="btn-text-sub">listo para pegar</span>`;
            btnWhatsApp.style.backgroundColor = '#10B981';
            setTimeout(() => { 
                btnWhatsApp.innerHTML = originalHTML; 
                btnWhatsApp.style.backgroundColor = ''; 
            }, 2500);
        } catch (err) {
            alert("No se pudo copiar automáticamente. Intente nuevamente.");
        }
        document.body.removeChild(textArea);
    });
}
