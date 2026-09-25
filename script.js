<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel Gerencial - Control de Permisos L2/L4</title>
    
    <!-- Librerías Externas -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.2/papaparse.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

    <!-- Estilos Personalizados Críticos (Mapa y Chat) -->
    <style>
        #map { height: 650px; z-index: 1; border-radius: 0.5rem; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
        .brillo-preventivo { animation: pulso-amarillo 2s infinite; stroke: #f59e0b !important; }
        .brillo-tramite-vencido { animation: pulso-rojo 2s infinite; stroke: #dc2626 !important; }
        
        @keyframes pulso-amarillo { 0% { filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.4)); } 50% { filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.8)); } 100% { filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.4)); } }
        @keyframes pulso-rojo { 0% { filter: drop-shadow(0 0 2px rgba(220, 38, 38, 0.4)); } 50% { filter: drop-shadow(0 0 6px rgba(220, 38, 38, 0.8)); } 100% { filter: drop-shadow(0 0 2px rgba(220, 38, 38, 0.4)); } }

        /* Estructura del Popup de Leaflet */
        .leaflet-popup-content-wrapper { border-radius: 8px; padding: 0; overflow: hidden; }
        .popup-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10px; }
        .popup-title { font-weight: bold; font-size: 1.1rem; color: #1e293b; margin-bottom: 4px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px;}
        .popup-subtitle { font-size: 0.85rem; color: #64748b; margin-bottom: 12px; }
        .auth-box { background-color: #f8fafc; border-left: 4px solid #cbd5e1; padding: 8px; margin-bottom: 8px; border-radius: 4px; font-size: 0.9rem;}
        .estado-critico, .estado-vencido { border-left-color: #dc2626; background-color: #fef2f2; }
        .estado-tramite { border-left-color: #c026d3; background-color: #fdf4ff; }
        .estado-exonerado { border-left-color: #f97316; background-color: #fff7ed; }
        .estado-culminado { border-left-color: #10b981; background-color: #ecfdf5; }
        
        /* Controles de Filtro */
        .btn-pill { background: #f1f5f9; border: 1px solid #cbd5e1; color: #475569; padding: 4px 12px; border-radius: 9999px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .btn-pill:hover { background: #e2e8f0; }
        .btn-pill.active { background: #1e293b; color: white; border-color: #1e293b; font-weight: 500; }
        
        /* Widget del Chat NLP */
        #panel-chat { position: fixed; bottom: 20px; right: 20px; width: 350px; background: white; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); z-index: 1000; transition: height 0.3s ease; display: flex; flex-direction: column; overflow: hidden; border: 1px solid #e5e7eb;}
        .chat-minimizada { height: 48px; }
        .chat-abierta { height: 450px; }
        #chat-header { background: #1e293b; color: white; padding: 12px 16px; font-weight: bold; cursor: pointer; display: flex; justify-content: space-between; align-items: center;}
        #chat-mensajes { flex-grow: 1; overflow-y: auto; padding: 16px; background: #f8fafc; display: flex; flex-direction: column; gap: 12px;}
        .msg-user { align-self: flex-end; background: #2563eb; color: white; padding: 8px 12px; border-radius: 12px 12px 0 12px; font-size: 0.9rem; max-width: 85%; }
        .msg-bot { align-self: flex-start; background: white; color: #1e293b; padding: 8px 12px; border-radius: 12px 12px 12px 0; font-size: 0.9rem; border: 1px solid #e2e8f0; max-width: 85%; }
        #chat-input-container { display: flex; padding: 12px; background: white; border-top: 1px solid #e2e8f0; }
        #chat-input { flex-grow: 1; border: 1px solid #cbd5e1; padding: 8px 12px; border-radius: 6px; outline: none; font-size: 0.9rem; }
        #btn-enviar-chat { background: #2563eb; color: white; border: none; padding: 8px 16px; margin-left: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; }
    </style>
</head>
<body class="bg-gray-100 text-gray-800 font-sans antialiased">

    <!-- 1. PANTALLA DE AUTENTICACIÓN -->
    <div id="pantalla-bloqueo" class="fixed inset-0 bg-slate-900 flex flex-col justify-center items-center z-50">
        <div class="bg-white p-8 rounded-xl shadow-2xl w-[400px] text-center border-t-4 border-blue-600">
            <h2 class="text-2xl font-bold text-slate-800 mb-2">Sistema de Control</h2>
            <p class="text-sm text-slate-500 mb-6">Administración Contractual L2/L4</p>
            
            <div class="space-y-4">
                <input type="email" id="email-corp" placeholder="Correo Corporativo" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                <input type="password" id="pass-corp" placeholder="Contraseña" class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                
                <button id="btn-login-corp" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-md">
                    Ingresar al Sistema
                </button>
                
                <div class="relative flex items-center py-2">
                    <div class="flex-grow border-t border-gray-300"></div>
                    <span class="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase">Opciones Alternas</span>
                    <div class="flex-grow border-t border-gray-300"></div>
                </div>
                
                <button id="btn-login-google" class="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-lg flex justify-center items-center gap-2 transition duration-200">
                    <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> 
                    Ingreso Autorizado
                </button>
            </div>
            <p id="mensaje-error" class="hidden mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200"></p>
        </div>
    </div>

    <!-- 2. APLICACIÓN PRINCIPAL (DASHBOARD) -->
    <div id="app-principal" style="display: none;" class="max-w-[1800px] mx-auto p-4 lg:p-6">
        
        <!-- HEADER -->
        <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div>
                <h1 class="text-2xl font-black text-slate-800 tracking-tight">Autorizaciones Municipales</h1>
                <p class="text-sm text-slate-500 font-medium">Línea 2 y Ramal 4 - Consorcio Constructor</p>
            </div>
            <button id="btn-reporte-ejecutivo" class="mt-4 md:mt-0 bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-lg shadow font-semibold transition-colors flex items-center gap-2 text-sm">
                📋 Copiar Reporte Gerencial
            </button>
        </header>

        <!-- KPI BELT (Indicadores de Brecha) -->
        <section class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div class="bg-white p-4 rounded-xl shadow-sm border border-red-200 border-l-4 border-l-red-600 flex flex-col items-center">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Brecha Crítica (Sin Acción)</span>
                <span id="kpi-rojo" class="text-3xl font-black text-red-600">0</span>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-fuchsia-200 border-l-4 border-l-fuchsia-600 flex flex-col items-center">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Gestión En Trámite</span>
                <span id="kpi-morado" class="text-3xl font-black text-fuchsia-600">0</span>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-yellow-200 border-l-4 border-l-yellow-500 flex flex-col items-center">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Alerta Temprana (< 4 Meses)</span>
                <span id="kpi-amarillo" class="text-3xl font-black text-yellow-500">0</span>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-orange-200 border-l-4 border-l-orange-500 flex flex-col items-center">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Amparo Ley N° 31955</span>
                <span id="kpi-naranja" class="text-3xl font-black text-orange-500">0</span>
            </div>
            <div class="bg-white p-4 rounded-xl shadow-sm border border-emerald-200 border-l-4 border-l-emerald-500 flex flex-col items-center">
                <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Obras Culminadas</span>
                <span id="kpi-verde" class="text-3xl font-black text-emerald-500">0</span>
            </div>
        </section>

        <!-- SPLIT VIEW: MAPA (IZQ) Y ANALÍTICA (DER) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <!-- Columna Izquierda: Espacial -->
            <div class="col-span-1 lg:col-span-1 flex flex-col gap-4">
                <!-- Panel de Filtros -->
                <div class="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                    <div class="mb-4">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Filtro por Estructura</label>
                        <div id="contenedor-filtros-id" class="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                            <button class="btn-pill active" data-id="Todos">Todos</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Aislamiento de Riesgo</label>
                        <div class="flex flex-wrap gap-2 filtro-seccion">
                            <button class="btn-pill active" data-estado="Todos">Vista General</button>
                            <button class="btn-pill" data-estado="Criticos">🔴 Acción Inmediata</button>
                            <button class="btn-pill" data-estado="Tramite">🟣 En Trámite</button>
                            <button class="btn-pill" data-estado="Menor4Meses">🟡 Alerta Preventiva</button>
                        </div>
                    </div>
                </div>
                <!-- Mapa Leaflet -->
                <div id="map"></div>
            </div>

            <!-- Columna Derecha: Analítica de Contingencias -->
            <div class="col-span-1 lg:col-span-2 flex flex-col gap-6">
                
                <!-- Tabla: Semáforo de Riesgos -->
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex-grow">
                    <h3 class="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Semáforo de Riesgos Cronológicos</h3>
                    <div class="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table class="w-full text-left border-collapse text-sm">
                            <thead class="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th class="p-3 font-semibold">ID</th>
                                    <th class="p-3 font-semibold">Jurisdicción</th>
                                    <th class="p-3 font-semibold">Trámite</th>
                                    <th class="p-3 font-semibold">Situación Legal</th>
                                    <th class="p-3 font-semibold text-center">Contingencia</th>
                                    <th class="p-3 font-semibold">Acción Recomendada</th>
                                </tr>
                            </thead>
                            <tbody id="tabla-semaforo-riesgos" class="divide-y divide-gray-200">
                                <!-- Filas inyectadas por JS -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Gráfico: Ranking de Inacción en Trámites -->
                <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-[300px]">
                    <h3 class="text-lg font-bold text-slate-800 mb-2">Ranking Analítico: Eficiencia de Respuesta Municipal</h3>
                    <p class="text-xs text-slate-500 mb-4">Días transcurridos en trámites vigentes (mayor exposición de riesgo contractual).</p>
                    <div class="relative h-[200px] w-full">
                        <canvas id="grafico-ranking-tramites"></canvas>
                    </div>
                </div>

            </div>
        </div>
    </div>

    <!-- 3. MÓDULO NLP: CONSULTOR INTELIGENTE -->
    <div id="panel-chat" class="chat-minimizada">
        <div id="chat-header">
            <span class="flex items-center gap-2">🤖 Consultor Táctico IA</span>
            <span class="text-xs border border-slate-500 px-2 rounded">BETA</span>
        </div>
        <div id="chat-mensajes">
            <div class="msg-bot">Hola. Soy tu interfaz de consulta rápida. Pregúntame sobre el estado de alguna estación específica o indicadores de riesgo (Ej: "¿Qué obras están por vencer?").</div>
        </div>
        <div id="chat-input-container">
            <input type="text" id="chat-input" placeholder="Escribe tu consulta aquí...">
            <button id="btn-enviar-chat">Enviar</button>
        </div>
    </div>

    <!-- Vinculación del Motor Lógico (Módulo) -->
    <script type="module" src="script.js"></script>

</body>
</html>
