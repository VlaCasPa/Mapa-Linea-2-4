// 1. Inicializar el Mapa (Sin coordenadas fijas, se centrará automáticamente)
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
    if (!dias) return 'estado-alerta'; 
    let d = dias.toString().trim().toLowerCase();
    
    if (d === "exonerado") return 'estado-exonerado';
    if (d === "indefinido") return 'estado-indefinido';
    
    let numDias = parseInt(dias);
    if (numDias > 30) return 'estado-optimo';
    if (numDias >= 0 && numDias <= 30) return 'estado-alerta';
    if (numDias < 0) return 'estado-vencido';
    return 'estado-alerta';
}

function formatearDias(dias) {
    let d = dias.toString().trim().toLowerCase();
    if (d === "exonerado") return "Amparo Ley N° 31955";
    if (d === "indefinido") return "Plazo Indefinido";
    
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
        
        // Grupo para centrar la cámara en los marcadores
        let grupoMarcadores = L.featureGroup().addTo(map);
        
        data.forEach(item => {
            if (item.Latitud && item.Longitud) {
                
                let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);

                let popupContent = `
                    <div class="popup-container">
                        <h3 class="popup-title">${item.ID}: ${item.Nombre}</h3>
                        <div class="popup-subtitle">📍 ${item.Municipalidad} | ${item.Linea} - ${item.Tipo}</div>
                        
                        <div class="auth-box ${claseObra}">
                            <span class="auth-title">🚧 Autorización de Obra</span>
                            Resolución: ${item.Aut_Obra_Resolucion || 'N/A'}<br>
                            Estado: <b>${formatearDias(item.Aut_Obra_Dias_Restantes)}</b>
                        </div>

                        <div class="auth-box ${claseDesvio}">
                            <span class="auth-title">🚦 Desvío de Tránsito</span>
                            Resolución: ${item.Aut_Desvio_Resolucion || 'N/A'}<br>
                            Estado: <b>${formatearDias(item.Aut_Desvio_Dias_Restantes)}</b>
                        </div>
                    </div>
                `;

                // Corrección automática de comas a puntos
                let latText = item.Latitud.toString().trim().replace(/,/g, '.');
                let lonText = item.Longitud.toString().trim().replace(/,/g, '.');

                let latitudCorregida = parseFloat(latText);
                let longitudCorregida = parseFloat(lonText);

                if (!isNaN(latitudCorregida) && !isNaN(longitudCorregida)) {
                    
                    let markerColor = "#2563EB"; // Azul (Estaciones)
                    if (item.Tipo && item.Tipo.toLowerCase() === "pozo") markerColor = "#475569"; // Gris (Pozos)
                    
                    // ALERTA VISUAL: Si algo está vencido, el marcador se vuelve ROJO
                    if (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido') {
                        markerColor = "#DC2626"; 
                    }
                    
                    let marker = L.circleMarker([latitudCorregida, longitudCorregida], {
                        radius: 8,
                        fillColor: markerColor,
                        color: "#ffffff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    });

                    // Ventana emergente
                    marker.bindPopup(popupContent);
                    
                    // Etiqueta del ID siempre visible
                    marker.bindTooltip(item.ID, {
                        permanent: true, 
                        direction: 'right', 
                        className: 'id-tooltip',
                        offset: [5, 0]
                    });

                    marker.addTo(grupoMarcadores);
                }
            }
        });

        // Centrar el mapa automáticamente en todos los puntos
        if (grupoMarcadores.getLayers().length > 0) {
            map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30] });
        }
    }
});
