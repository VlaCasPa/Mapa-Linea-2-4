// 1. Inicializar el Mapa
const map = L.map('map');

// 2. Mapa Base Minimalista
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// 3. Tu enlace de Google Sheets
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

// 4. Lógica de Colores y Días
function obtenerClaseEstado(dias) {
    if (!dias && dias !== 0) return 'estado-critico'; 
    let d = dias.toString().trim().toLowerCase();
    
    if (d === "exonerado") return 'estado-exonerado';
    if (d === "indefinido") return 'estado-indefinido';
    if (d === "en trámite") return 'estado-tramite';
    
    let numDias = parseInt(dias);
    if (numDias >= 29) return 'estado-optimo';
    if (numDias >= 0 && numDias < 29) return 'estado-critico'; // Menos de 29 días
    if (numDias < 0) return 'estado-vencido'; // Vencido
    return 'estado-critico';
}

function formatearDias(dias) {
    let d = dias.toString().trim().toLowerCase();
    if (d === "exonerado") return "Amparo Ley N° 31955";
    if (d === "indefinido") return "Plazo Indefinido";
    if (d === "en trámite") return "Renovación en Trámite";
    
    let num = parseInt(dias);
    if (num < 0) return `¡VENCIDO HACE ${Math.abs(num)} DÍAS!`;
    return `Quedan ${num} días`;
}

// 5. Leer el CSV y crear los puntos
Papa.parse(urlCSV, {
    download: true,
    header: true,
    complete: function(results) {
        let data = results.data;
        let grupoMarcadores = L.featureGroup().addTo(map);
        
        data.forEach(item => {
            if (item.Latitud && item.Longitud) {
                
                let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);

                // Evaluar si hay comentarios para inyectarlos en el HTML
                let comObra = item.Aut_Obra_Comentarios ? `<div class="popup-comment">💬 ${item.Aut_Obra_Comentarios}</div>` : '';
                let comDesvio = item.Aut_Desvio_Comentarios ? `<div class="popup-comment">💬 ${item.Aut_Desvio_Comentarios}</div>` : '';

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
                    </div>
                `;

                // Corrección automática de coordenadas
                let latText = item.Latitud.toString().trim().replace(/,/g, '.');
                let lonText = item.Longitud.toString().trim().replace(/,/g, '.');
                let latitudCorregida = parseFloat(latText);
                let longitudCorregida = parseFloat(lonText);

                if (!isNaN(latitudCorregida) && !isNaN(longitudCorregida)) {
                    
                    // --- SISTEMA GERENCIAL DE PRIORIDAD DE COLORES EN EL MAPA ---
                    let markerColor = "#2563EB"; // Base: Azul (Estaciones)
                    if (item.Tipo && item.Tipo.toLowerCase() === "pozo") markerColor = "#475569"; // Base: Gris (Pozos)
                    
                    // Prioridad 1: Si hay gestión en trámite, pintar Morado
                    if (claseObra === 'estado-tramite' || claseDesvio === 'estado-tramite') {
                        markerColor = "#A855F7"; 
                    }
                    
                    // Prioridad Máxima: Si algo vence en < 29 días o ya venció, pintar ROJO absoluto
                    if (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido' || claseObra === 'estado-critico' || claseDesvio === 'estado-critico') {
                        markerColor = "#DC2626"; 
                    }
                    // -----------------------------------------------------------
                    
                    let marker = L.circleMarker([latitudCorregida, longitudCorregida], {
                        radius: 8,
                        fillColor: markerColor,
                        color: "#ffffff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    });

                    marker.bindPopup(popupContent);
                    marker.bindTooltip(item.ID, {
                        permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0]
                    });
                    marker.addTo(grupoMarcadores);
                }
            }
        });

        // Centrar mapa
        if (grupoMarcadores.getLayers().length > 0) {
            map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30] });
        }
    }
});
