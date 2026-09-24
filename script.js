import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

// --- 1. CREDENCIALES Y AUTENTICACIÓN FIREBASE ---
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
const provider = new GoogleAuthProvider();

const CORREOS_MAESTROS = [
    "zebaxx@gmail.com", 
    "permisosccm2l@gmail.com",
    "tnoriega.arq@gmail.com",
    "supervisor@gmail.com"
]; 
const DOMINIO_PERMITIDO = "@ccmetrolima.com";

const googleBtnHTML = `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Ingresar con Google`;

const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLoginCorp = document.getElementById('btn-login-corp');
const inputEmailCorp = document.getElementById('email-corp');
const inputPassCorp = document.getElementById('pass-corp');
const mensajeError = document.getElementById('mensaje-error');
const pantallaBloqueo = document.getElementById('pantalla-bloqueo');
const appPrincipal = document.getElementById('app-principal');

setPersistence(auth, browserLocalPersistence).then(() => {
    btnLoginGoogle.addEventListener('click', () => {
        mensajeError.style.display = 'none';
        btnLoginGoogle.innerHTML = "Conectando..."; 
        signInWithPopup(auth, provider).catch(() => {
            mensajeError.innerText = "Error de autenticación. Verifica tus permisos.";
            mensajeError.style.display = 'block';
            btnLoginGoogle.innerHTML = googleBtnHTML;
        });
    });

    btnLoginCorp.addEventListener('click', () => {
        const email = inputEmailCorp.value.trim();
        const password = inputPassCorp.value;
        if (!email || !password) {
            mensajeError.innerText = "Por favor, ingresa el correo y la contraseña corporativa.";
            mensajeError.style.display = 'block';
            return;
        }
        mensajeError.style.display = 'none';
        btnLoginCorp.innerHTML = "Validando credenciales..."; 
        signInWithEmailAndPassword(auth, email, password).catch(() => {
            mensajeError.innerText = "Credenciales incorrectas o acceso denegado. Contacte al administrador.";
            mensajeError.style.display = 'block';
            btnLoginCorp.innerHTML = "Ingresar al Sistema";
        });
    });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        const email = user.email.toLowerCase();
        if (email.endsWith(DOMINIO_PERMITIDO) || CORREOS_MAESTROS.includes(email)) {
            pantallaBloqueo.style.display = 'none';
            appPrincipal.style.display = 'block';
            iniciarMotorDelMapa(); 
        } else {
            signOut(auth).then(() => {
                mensajeError.innerText = `Acceso denegado. Comunícate con Vladimir Casas para solicitar permiso de ingreso.`;
                mensajeError.style.display = 'block';
                btnLoginGoogle.innerHTML = googleBtnHTML;
            });
        }
    } else {
        pantallaBloqueo.style.display = 'flex';
        appPrincipal.style.display = 'none';
    }
});

// --- 2. LÓGICA ESPACIAL Y PERMISOS ---
let mapaInicializado = false;
let map;
let grupoMarcadores;
let marcadoresGuardados = []; 
let filtroActualID = "Todos";
let filtroActualEstado = "Todos";
window.datosGlobales = [];

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

function iniciarMotorDelMapa() {
    if (mapaInicializado) return; 
    mapaInicializado = true;

    map = L.map('map').setView([-12.055, -77.050], 12);
    L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], attribution: '&copy; Google', opacity: 0.65, className: 'mapa-google-gris' }).addTo(map);
    grupoMarcadores = L.featureGroup().addTo(map);

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
                    
                    let comObra = item.Aut_Obra_Comentarios ? `<details class="popup-details"><summary class="popup-summary">💬 Ver comentarios de obra...</summary><div class="popup-comment-text">${item.Aut_Obra_Comentarios}</div></details>` : '';
                    let comDesvio = item.Aut_Desvio_Comentarios ? `<details class="popup-details"><summary class="popup-summary">💬 Ver comentarios de desvío...</summary><div class="popup-comment-text">${item.Aut_Desvio_Comentarios}</div></details>` : '';

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

                    let lat = parseFloat(item.Latitud.toString().trim().replace(/,/g, '.'));
                    let lon = parseFloat(item.Longitud.toString().trim().replace(/,/g, '.'));

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
                        
                        let marker = L.circleMarker([lat, lon], { radius: 8, fillColor: markerColor, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8, className: alertaPreventiva ? 'brillo-preventivo' : '' });
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
            iniciarChatInteligente(); // Habilitar el módulo NLP una vez descargada la matriz
        }
    });

    let btnWhatsapp = document.getElementById('btn-whatsapp');
    if (btnWhatsapp) {
        btnWhatsapp.addEventListener('click', () => {
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
                    else if (esCritico && !esVencido) criticos.push(item.ID);
                    if (esMenor4 && !esCulminado && !esVencido) menor4Meses.push(item.ID);
                    if (esTramite && !esVencido && !esCritico) tramite.push(item.ID);
                    if (esCulminado && !esVencido && !esCritico && !esTramite) culminados.push(item.ID);
                    if (esLey) ley31955.push(item.ID); 
                }
            });

            let fechaHoy = new Date().toLocaleDateString('es-PE');
            let texto = `📊 *REPORTE AUTORIZACIONES - LÍNEA 2 Y RAMAL L4* 🚇\n📅 Fecha: ${fechaHoy}\n\n🔴 *VENCIDOS (${vencidos.length}):*\n${vencidos.length > 0 ? vencidos.join(', ') : 'Ninguno'}\n\n🟠 *CRÍTICOS <29 DÍAS (${criticos.length}):*\n${criticos.length > 0 ? criticos.join(', ') : 'Ninguno'}\n\n🟡 *POR VENCER < 4 MESES (${menor4Meses.length}):*\n${menor4Meses.length > 0 ? menor4Meses.join(', ') : 'Ninguno'}\n\n🟣 *EN TRÁMITE (${tramite.length}):*\n${tramite.length > 0 ? tramite.join(', ') : 'Ninguno'}\n\n✅ *OBRAS CULMINADAS (${culminados.length}):*\n${culminados.length > 0 ? culminados.join(', ') : 'Ninguno'}\n\n⚖️ *AMPARO LEY N° 31955 (${ley31955.length}):*\n${ley31955.length > 0 ? ley31955.join(', ') : 'Ninguno'}\n\n🔗 *Ver mapa interactivo:* https://vlacaspa.github.io/Mapa-Linea-2-4/`;

            try {
                let textArea = document.createElement("textarea");
                textArea.value = texto; document.body.appendChild(textArea); textArea.select();
                document.execCommand('copy'); document.body.removeChild(textArea);
            } catch (err) { console.error("No se pudo copiar automáticamente"); }
            window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(texto), '_blank');
        });
    }
}

// --- 3. MÓDULO NLP: CONSULTOR INTELIGENTE DE PERMISOS ---
function iniciarChatInteligente() {
    const chatWidget = document.getElementById('panel-chat');
    const btnToggle = document.getElementById('chat-header');
    const inputChat = document.getElementById('chat-input');
    const btnEnviar = document.getElementById('btn-enviar-chat');
    const mensajesContainer = document.getElementById('chat-mensajes');

    btnToggle.addEventListener('click', () => {
        if (chatWidget.classList.contains('chat-minimizada')) {
            chatWidget.classList.remove('chat-minimizada');
            chatWidget.classList.add('chat-abierta');
            inputChat.focus();
        } else {
            chatWidget.classList.remove('chat-abierta');
            chatWidget.classList.add('chat-minimizada');
        }
    });

    const agregarMensaje = (texto, tipo) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = tipo === 'user' ? 'msg-user' : 'msg-bot';
        msgDiv.innerHTML = texto;
        mensajesContainer.appendChild(msgDiv);
        mensajesContainer.scrollTop = mensajesContainer.scrollHeight;
    };

    const procesarConsulta = (textoConsulta) => {
        let txt = textoConsulta.toLowerCase().trim();
        let estacionHallada = null;

        for (let item of window.datosGlobales) {
            if (item.ID) {
                let idLimpio = item.ID.toLowerCase();
                let regexExacta = new RegExp(`\\b${idLimpio}\\b`, 'i');
                if (regexExacta.test(txt)) { estacionHallada = item; break; }
            }
        }

        if (!estacionHallada) {
            return "No he logrado identificar una estación específica. Asegúrate de incluir su código exacto (Ej. 'E12' o 'PV19').";
        }

        let pideTransito = txt.includes('transito') || txt.includes('tránsito') || txt.includes('desvio') || txt.includes('desvío');
        let pideObra = txt.includes('obra') || txt.includes('cerramiento');
        let resObra = formatearDias(estacionHallada.Aut_Obra_Dias_Restantes);
        let resDesvio = formatearDias(estacionHallada.Aut_Desvio_Dias_Restantes);

        let respuesta = `<b>📍 ${estacionHallada.ID} - ${estacionHallada.Nombre}</b><br>`;

        if (pideTransito && !pideObra) {
            respuesta += `🚦 <b>Desvío de Tránsito:</b> ${resDesvio}.<br><i>Resolución: ${estacionHallada.Aut_Desvio_Resolucion || 'N/A'}</i>`;
        } else if (pideObra && !pideTransito) {
            respuesta += `🚧 <b>Aut. de Obra:</b> ${resObra}.<br><i>Resolución: ${estacionHallada.Aut_Obra_Resolucion || 'N/A'}</i>`;
        } else {
            respuesta += `🚧 <b>Obra:</b> ${resObra}<br>🚦 <b>Tránsito:</b> ${resDesvio}`;
        }
        return respuesta;
    };

    const enviarConsulta = () => {
        let texto = inputChat.value.trim();
        if (texto !== '') {
            agregarMensaje(texto, 'user');
            inputChat.value = '';
            setTimeout(() => {
                let respuesta = procesarConsulta(texto);
                agregarMensaje(respuesta, 'bot');
            }, 400);
        }
    };

    btnEnviar.addEventListener('click', enviarConsulta);
    inputChat.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarConsulta(); });
}

// --- FUNCIONES LÓGICAS AUXILIARES ---
function obtenerClaseEstado(dias) {
    if (!dias && dias !== 0) return 'estado-critico'; 
    let d = dias.toString().trim().toLowerCase();
    if (d === "exonerado") return 'estado-exonerado';
    if (d === "indefinido") return 'estado-indefinido';
    if (d === "en trámite") return 'estado-tramite';
    if (d === "culminado" || d === "culminada") return 'estado-culminado'; 
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
    if (d === "culminado" || d === "culminada") return "Obra Finalizada"; 
    let num = parseInt(dias);
    if (num < 0) return `¡VENCIDO HACE ${Math.abs(num)} DÍAS!`;
    return `Quedan ${num} días`;
}

function aplicarFiltros() {
    grupoMarcadores.clearLayers(); let boundsCount = 0;
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

        if (mostrarPorID && mostrarPorEstado) { obj.marcador.addTo(grupoMarcadores); boundsCount++; }
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
