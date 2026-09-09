const map = L.map('map').setView([-12.055, -77.050], 12);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors', subdomains: 'abcd', maxZoom: 19
}).addTo(map);

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

window.datosGlobales = [];
let marcadoresGuardados = []; 
let grupoMarcadores = L.featureGroup().addTo(map);
let filtroActualID = "Todos";
let filtroActualEstado = "Todos";

function obtenerClaseEstado(dias) {
    if (!dias && dias !== 0) return 'estado-critico'; 
    let d = dias.toString().trim().toLowerCase();
    
    if (d === "exonerado") return 'estado-exonerado';
    if (d === "indefinido") return 'estado-indefinido';
    if (d === "en trámite") return 'estado-tramite';
    if (d === "culminado") return 'estado-culminado'; 
    
    let numDias = parseInt(dias);
    if (numDias >= 29) return 'estado-optimo';
    if (numDias >= 0 && numDias < 29) return 'estado-critico'; 
    if (numDias < 0) return 'estado-vencido'; 
    return 'estado-critico';
}

function formatearDias(dias) {
    let d = dias.toString().trim().toLowerCase();
    if (d === "exonerado") return "Amparo Ley N° 31955";
    if (d === "indefinido") return "Plazo Indefinido";
    if (d === "en trámite") return "Renovación en Trámite";
    if (d === "culminado") return "Obra Finalizada"; 
    
    let num = parseInt(dias);
    if (num < 0) return `¡VENCIDO HACE ${Math.abs(num)} DÍAS!`;
    return `Quedan ${num} días`;
}

// Función para pintar y recolorear marcadores según filtros
function aplicarFiltros() {
    grupoMarcadores.clearLayers(); 
    let boundsCount = 0;

    marcadoresGuardados.forEach(obj => {
        let mostrarPorID = (filtroActualID === "Todos" || obj.datos.ID === filtroActualID);
        let mostrarPorEstado = true;

        if (filtroActualEstado === "Criticos") {
            mostrarPorEstado = (obj.estadoSeveridad === 'vencido' || obj.estadoSeveridad === 'critico');
        } else if (filtroActualEstado === "Tramite") {
            mostrarPorEstado = (obj.estadoSeveridad === 'tramite');
        } else if (filtroActualEstado === "Culminado") {
            mostrarPorEstado = (obj.estadoSeveridad === 'culminado');
        } else if (filtroActualEstado === "Ley31955") {
            // Mostrar solo si está amparado por la ley
            mostrarPorEstado = obj.esLey31955; 
        }

        if (mostrarPorID && mostrarPorEstado) {
            // LÓGICA DE COLOR DINÁMICO
            if (filtroActualEstado === "Ley31955") {
                obj.marcador.setStyle({ fillColor: "#F97316" }); // Naranja temporal
            } else {
                obj.marcador.setStyle({ fillColor: obj.colorOriginal }); // Restaura su color real
            }

            obj.marcador.addTo(grupoMarcadores);
            boundsCount++;
        }
    });

    if (boundsCount > 0) {
        map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30], maxZoom: 15 });
    }
}

Papa.parse(urlCSV, {
    download: true, header: true,
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
                    if(contenedorIDs) contenedorIDs.appendChild(btn);
                }

                let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);
                let comObra = item.Aut_Obra_Comentarios ? `<div class="popup-comment">💬 ${item.Aut_Obra_Comentarios}</div>` : '';
                let comDesvio = item.Aut_Desvio_Comentarios ? `<div class="popup-comment">💬 ${item.Aut_Desvio_Comentarios}</div>` : '';

                let popupContent = `
                    <div class="popup-container">
                        <h3 class="popup-title">${item.ID}: ${item.Nombre}</h3>
                        <div class="popup-subtitle">📍 ${item.Municipalidad} | ${item.Linea} - ${item.Tipo}</div>
                        <div class="auth-box ${claseObra}">
                            <span class="auth-title">🚧 Autorización de Obra</span>
                            Resolución: ${item.Aut_Obra_Resolucion || 'N/A'}<br>
                            Estado: <b>${formatearDias(item.Aut_Obra_Dias_Restantes)}</b> ${comObra}
                        </div>
                        <div class="auth-box ${claseDesvio}">
                            <span class="auth-title">🚦 Desvío de Tránsito</span>
                            Resolución: ${item.Aut_Desvio_Resolucion || 'N/A'}<br>
                            Estado: <b>${formatearDias(item.Aut_Desvio_Dias_Restantes)}</b> ${comDesvio}
                        </div>
                    </div>
                `;

                let lat = parseFloat(item.Latitud.toString().trim().replace(/,/g, '.'));
                let lon = parseFloat(item.Longitud.toString().trim().replace(/,/g, '.'));

                if (!isNaN(lat) && !isNaN(lon)) {
                    let markerColor = item.Tipo && item.Tipo.toLowerCase() === "pozo" ? "#475569" : "#2563EB"; 
                    let severidad = 'normal';
                    let aplicaLey = (claseObra === 'estado-exonerado' || claseDesvio === 'estado-exonerado'); // ¿Aplica ley?

                    if (claseObra === 'estado-culminado' || claseDesvio === 'estado-culminado') {
                        markerColor = "#10B981"; severidad = 'culminado';
                    }
                    if (claseObra === 'estado-tramite' || claseDesvio === 'estado-tramite') {
                        markerColor = "#A855F7"; severidad = 'tramite';
                    }
                    if (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido' || claseObra === 'estado-critico' || claseDesvio === 'estado-critico') {
                        markerColor = "#DC2626"; severidad = (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido') ? 'vencido' : 'critico';
                    }
                    
                    let marker = L.circleMarker([lat, lon], {
                        radius: 8, fillColor: markerColor, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8
                    });

                    marker.bindPopup(popupContent);
                    marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });
                    
                    // Almacenamos el marcador con su color original guardado
                    marcadoresGuardados.push({ 
                        marcador: marker, 
                        datos: item, 
                        estadoSeveridad: severidad,
                        colorOriginal: markerColor, // GUARDAMOS SU COLOR REAL
                        esLey31955: aplicaLey // IDENTIFICAMOS SI USA LA LEY
                    });
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
    }
});

// --- MOTOR BLINDADO DEL REPORTE WHATSAPP ---
document.addEventListener('DOMContentLoaded', () => {
    let btnWhatsapp = document.getElementById('btn-whatsapp');
    
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => {
            if (!window.datosGlobales || window.datosGlobales.length === 0) {
                alert("Los datos aún se están cargando...");
                return;
            }

            let vencidos = [];
            let criticos = [];
            let tramite = [];
            let culminados = []; 

            window.datosGlobales.forEach(item => {
                if (item.ID && item.Latitud) {
                    let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                    let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);

                    let esVencido = (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido');
                    let esCritico = (claseObra === 'estado-critico' || claseDesvio === 'estado-critico');
                    let esTramite = (claseObra === 'estado-tramite' || claseDesvio === 'estado-tramite');
                    let esCulminado = (claseObra === 'estado-culminado' || claseDesvio === 'estado-culminado');

                    if (esVencido) vencidos.push(item.ID);
                    else if (esCritico && !esVencido) criticos.push(item.ID);
                    else if (esTramite && !esVencido && !esCritico) tramite.push(item.ID);
                    else if (esCulminado && !esVencido && !esCritico && !esTramite) culminados.push(item.ID);
                }
            });

            let fechaHoy = new Date().toLocaleDateString('es-PE');
            let texto = `📊 *REPORTE AUTORIZACIONES - LÍNEA 2 Y RAMAL L4* 🚇\n📅 Fecha: ${fechaHoy}\n\n`;

            if (vencidos.length > 0) texto += `🔴 *VENCIDOS (${vencidos.length}):*\n${vencidos.join(', ')}\n\n`;
            else texto += `🔴 *VENCIDOS:* 0\n\n`;

            if (criticos.length > 0) texto += `🟠 *CRÍTICOS <29 DÍAS (${criticos.length}):*\n${criticos.join(', ')}\n\n`;
            if (tramite.length > 0) texto += `🟣 *EN TRÁMITE (${tramite.length}):*\n${tramite.join(', ')}\n\n`;
            if (culminados.length > 0) texto += `✅ *OBRAS CULMINADAS (${culminados.length}):*\n${culminados.join(', ')}\n\n`;

            texto += `🔗 *Ver mapa interactivo:* https://vlacaspa.github.io/Mapa-Linea-2-4/`;

            let urlWhatsapp = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(texto);

            try {
                let textArea = document.createElement("textarea");
                textArea.value = texto;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            } catch (err) {
                console.error("No se pudo copiar automáticamente");
            }
            
            window.open(urlWhatsapp, '_blank');
        });
    }
});
