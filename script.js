// 1. Inicializar el Mapa (Centrado en Lima/Callao)
const map = L.map('map').setView([-12.055, -77.050], 12);

// 2. Mapa Base Minimalista
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// 3. Tu enlace de Google Sheets (El enlace CSV publicado)
// NOTA: Asegúrate de que este sea el enlace terminado en /pub?output=csv
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

// 4. Lógica para colores de alerta
function obtenerClaseEstado(dias) {
    if (!dias) return 'estado-alerta'; 
    if (dias.toString().trim().toLowerCase() === "exonerado") return 'estado-exonerado';
    
    let numDias = parseInt(dias);
    if (numDias > 30) return 'estado-optimo';
    if (numDias >= 0 && numDias <= 30) return 'estado-alerta';
    if (numDias < 0) return 'estado-vencido';
    return 'estado-alerta';
}

function formatearDias(dias) {
    if (dias.toString().trim().toLowerCase() === "exonerado") return "Amparo Ley N° 31955";
    let num = parseInt(dias);
    if (num < 0) return `Vencido hace ${Math.abs(num)} días`;
    return `Quedan ${num} días`;
}

// 5. Leer el CSV y crear los puntos
Papa.parse(urlCSV, {
    download: true,
    header: true,
    complete: function(results) {
        let data = results.data;
        
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

                // CORRECCIÓN DE LA COMA:
                let latitudCorregida = parseFloat(item.Latitud.toString().replace(',', '.'));
                let longitudCorregida = parseFloat(item.Longitud.toString().replace(',', '.'));

                let markerColor = "#2563EB"; 
                if (item.Tipo && item.Tipo.toLowerCase() === "pozo") markerColor = "#475569"; 

                L.circleMarker([latitudCorregida, longitudCorregida], {
                    radius: 8,
                    fillColor: markerColor,
                    color: "#ffffff",
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(popupContent).addTo(map);
            }
        });
    }
});
