import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

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
const db = getFirestore(app); 
const provider = new GoogleAuthProvider();
let usuarioActual = "anonimo"; 

const btnLoginGoogle = document.getElementById('btn-login-google');
const btnLoginCorp = document.getElementById('btn-login-corp');
const inputEmailCorp = document.getElementById('email-corp');
const inputPassCorp = document.getElementById('pass-corp');
const mensajeError = document.getElementById('mensaje-error');
const pantallaBloqueo = document.getElementById('pantalla-bloqueo');
const appPrincipal = document.getElementById('app-principal');

const googleBtnHTML = `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Ingresar con Google`;

setPersistence(auth, browserLocalPersistence).catch(console.warn);

btnLoginGoogle.addEventListener('click', () => { 
    mensajeError.style.display = 'none';
    btnLoginGoogle.innerHTML = "Conectando...";
    signInWithPopup(auth, provider).catch((err) => { 
        mensajeError.innerText = "Fallo de red o ventana emergente bloqueada."; 
        mensajeError.style.display = 'block'; 
        btnLoginGoogle.innerHTML = googleBtnHTML;
    }); 
});

btnLoginCorp.addEventListener('click', () => { 
    if(!inputEmailCorp.value || !inputPassCorp.value) return;
    mensajeError.style.display = 'none';
    btnLoginCorp.innerHTML = "Validando...";
    signInWithEmailAndPassword(auth, inputEmailCorp.value.trim(), inputPassCorp.value).catch(() => { 
        mensajeError.innerText = "Credenciales incorrectas."; 
        mensajeError.style.display = 'block'; 
        btnLoginCorp.innerHTML = "Ingresar al Sistema";
    }); 
});

onAuthStateChanged(auth, (user) => {
    if (user && (user.email.endsWith("@ccmetrolima.com") || ["zebaxx@gmail.com", "permisosccm2l@gmail.com", "tnoriega.arq@gmail.com", "supervisor@gmail.com"].includes(user.email.toLowerCase()))) {
        usuarioActual = user.email.toLowerCase();
        pantallaBloqueo.style.display = 'none';
        appPrincipal.style.display = 'flex';
        iniciarMotorDelMapa(); 
    } else {
        pantallaBloqueo.style.display = 'flex';
        appPrincipal.style.display = 'none';
    }
});

let map, grupoMarcadores, marcadoresGuardados = [], filtroActualEstado = "Todos";
window.dataObrasGlobal = [];
window.dataDesviosGlobal = [];
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

const normalizarTexto = (str) => str ? String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

function iniciarMotorDelMapa() {
    if (map) return; 
    map = L.map('map', { zoomControl: false }).setView([-12.055, -77.050], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], className: 'mapa-google-gris' }).addTo(map);
    grupoMarcadores = L.featureGroup().addTo(map);

    Papa.parse(urlCSV, {
        download: true, header: true,
        complete: function(results) {
            let tCriticos=0, tTramite=0, tAlerta=0, tLey=0, tCulminado=0;
            
            // Reiniciar arreglos por si ocurre una recarga
            window.dataObrasGlobal = [];
            window.dataDesviosGlobal = [];

            results.data.forEach(item => {
                if (item.Latitud && item.Longitud && item.ID) {
                    let evalObra = evaluarRiesgo(item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Comentarios);
                    let evalDesvio = evaluarRiesgo(item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Comentarios);
                    
                    if (evalObra.estadoRiesgo === 'CRITICO_SIN_ACCION' || evalDesvio.estadoRiesgo === 'CRITICO_SIN_ACCION') tCriticos++;
                    if (evalObra.esTramite || evalDesvio.esTramite) tTramite++;
                    
                    let sev = determinarSeveridadVisual(evalObra, evalDesvio);
                    if (sev === 'ALERTA_TEMPRANA') tAlerta++;
                    if (sev === 'LEY31955') tLey++;
                    if (sev === 'CULMINADO') tCulminado++;

                    window.dataObrasGlobal.push({ id: item.ID, resolucion: item.Aut_Obra_Resolucion, dias: evalObra.diasValor, estado: evalObra.estadoRiesgo, orig: item.Aut_Obra_Dias_Restantes });
                    window.dataDesviosGlobal.push({ id: item.ID, resolucion: item.Aut_Desvio_Resolucion, dias: evalDesvio.diasValor, estado: evalDesvio.estadoRiesgo, orig: item.Aut_Desvio_Dias_Restantes });

                    let lat = parseFloat(item.Latitud.toString().replace(/,/g, '.'));
                    let lon = parseFloat(item.Longitud.toString().replace(/,/g, '.'));
                    if (!isNaN(lat)) {
                        let marker = L.circleMarker([lat, lon], { radius: 7, fillColor: "#2563EB", color: "#ffffff", weight: 2, fillOpacity: 0.95 });
                        aplicarEstiloMarcador(marker, sev);
                        
                        let comObra = item.Aut_Obra_Comentarios ? `<details class="popup-details mt-2"><summary class="text-blue-600 font-semibold cursor-pointer text-[0.7rem]">💬 Ver sustento...</summary><div class="mt-1 text-[0.7rem] text-gray-600 italic bg-white p-2 border rounded shadow-inner">${item.Aut_Obra_Comentarios}</div></details>` : '';
                        let comDesvio = item.Aut_Desvio_Comentarios ? `<details class="popup-details mt-2"><summary class="text-blue-600 font-semibold cursor-pointer text-[0.7rem]">💬 Ver sustento...</summary><div class="mt-1 text-[0.7rem] text-gray-600 italic bg-white p-2 border rounded shadow-inner">${item.Aut_Desvio_Comentarios}</div></details>` : '';

                        marker.bindPopup(`
                            <div class="popup-container">
                                <h3 class="popup-title">${item.ID}: ${item.Nombre}</h3>
                                <div class="popup-subtitle">📍 ${item.Municipalidad} | ${item.Linea} - ${item.Tipo}</div>
                                <div class="auth-box ${obtenerClaseCSS(evalObra.estadoRiesgo)}"><span class="font-bold block mb-1 text-slate-700">🚧 Autorización de Obra</span>Res: ${item.Aut_Obra_Resolucion || 'N/A'}<br>Estado: <b class="text-slate-800">${formatearTextoPopup(evalObra)}</b>${comObra}</div>
                                <div class="auth-box ${obtenerClaseCSS(evalDesvio.estadoRiesgo)}"><span class="font-bold block mb-1 text-slate-700">🚦 Desvío de Tránsito</span>Res: ${item.Aut_Desvio_Resolucion || 'N/A'}<br>Estado: <b class="text-slate-800">${formatearTextoPopup(evalDesvio)}</b>${comDesvio}</div>
                            </div>
                        `);
                        marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'font-bold bg-white/90 px-1 rounded shadow-sm text-[0.65rem]' });
                        marcadoresGuardados.push({ marcador: marker, datos: item, evalObra: evalObra, evalDesvio: evalDesvio, severidadGlobal: sev });
                    }
                }
            });

            document.getElementById('kpi-rojo').innerText = tCriticos;
            document.getElementById('kpi-morado').innerText = tTramite;
            document.getElementById('kpi-amarillo').innerText = tAlerta;
            document.getElementById('kpi-naranja').innerText = tLey;
            document.getElementById('kpi-verde').innerText = tCulminado;

            renderizarTablasCompletas(window.dataObrasGlobal, 'tabla-obras-global');
            renderizarTablasCompletas(window.dataDesviosGlobal, 'tabla-desvios-global');

            document.querySelectorAll('.filtro-seccion .btn-pill').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.filtro-seccion .btn-pill').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    filtroActualEstado = e.target.getAttribute('data-estado');
                    aplicarFiltros();
                });
            });
            aplicarFiltros(); 
            configurarBotonTXT();
            iniciarChatInteligente();
        }
    });
}

function evaluarRiesgo(dias, comentarios) {
    let dNum = parseInt(dias); let dStr = normalizarTexto(dias); let tc = normalizarTexto(comentarios);
    let esC = dStr === "culminado" || tc.includes("culminado");
    let esT = dStr === "en tramite" || tc.includes("tramite");
    let esE = dStr === "exonerado" || tc.includes("exonerado");
    let vMat = !isNaN(dNum) && dNum < 0; let aTemp = !isNaN(dNum) && dNum >= 0 && dNum <= 120;
    
    let estado = 'VIGENTE', accion = 'Monitorear';
    if (esC) { estado = 'CULMINADO'; accion = 'Archivar'; }
    else if (esE) { estado = 'LEY31955'; accion = 'Archivar'; } 
    else if (vMat && !esT) { estado = 'CRITICO_SIN_ACCION'; accion = 'Tomar Acción'; } 
    else if (vMat && esT) { estado = 'CRITICO_EN_TRAMITE'; accion = 'Insistir Entidad'; } 
    else if (aTemp && !esT) { estado = 'ALERTA_TEMPRANA'; accion = 'Preparar Exp.'; } 
    else if (esT) { estado = 'TRAMITE_EN_PLAZO'; accion = 'Seguimiento'; } 
    else if (!isNaN(dNum) && dNum === 0) { estado = 'CRITICO_SIN_ACCION'; accion = 'Tomar Acción'; }
    else if (isNaN(dNum) && !esC && !esT && !esE) { estado = 'INDEFINIDO'; accion = 'Regularizar'; }
    
    return { diasValor: isNaN(dNum) ? null : dNum, esTramite: esT, estadoRiesgo: estado, accion: accion };
}

function obtenerClaseCSS(estado) {
    const mapa = { 'CRITICO_SIN_ACCION': 'estado-critico-sin-accion', 'CRITICO_EN_TRAMITE': 'estado-critico-en-tramite', 'ALERTA_TEMPRANA': 'estado-alerta', 'TRAMITE_EN_PLAZO': 'estado-tramite-plazo', 'LEY31955': 'estado-exonerado', 'CULMINADO': 'estado-culminado', 'INDEFINIDO': 'estado-exonerado' };
    return mapa[estado] || 'estado-tramite-plazo';
}

function formatearTextoPopup(ev) {
    if (ev.estadoRiesgo === 'CULMINADO') return "Finalizada";
    if (ev.estadoRiesgo === 'LEY31955') return "Ley N° 31955";
    if (ev.estadoRiesgo === 'INDEFINIDO') return "Indefinido";
    let textoDias = ev.diasValor !== null ? (ev.diasValor < 0 ? `Vencido (${Math.abs(ev.diasValor)}d)` : `Quedan ${ev.diasValor}d`) : "";
    if (ev.estadoRiesgo === 'CRITICO_EN_TRAMITE' || ev.estadoRiesgo === 'TRAMITE_EN_PLAZO') return `En Trámite ${textoDias ? '- ' + textoDias : ''}`;
    return textoDias || ev.diasOriginal || "S/D";
}

function aplicarEstiloMarcador(marker, estado) {
    marker.getElement()?.classList.remove('brillo-preventivo', 'brillo-tramite-vencido');
    if (estado === 'CRITICO_SIN_ACCION') marker.setStyle({ fillColor: "#dc2626", color: "#ffffff" });
    else if (estado === 'CRITICO_EN_TRAMITE') { marker.setStyle({ fillColor: "#c026d3", color: "#dc2626" }); marker.getElement()?.classList.add('brillo-tramite-vencido'); }
    else if (estado === 'ALERTA_TEMPRANA') { marker.setStyle({ fillColor: "#f59e0b", color: "#ffffff" }); marker.getElement()?.classList.add('brillo-preventivo'); }
    else if (estado === 'LEY31955') marker.setStyle({ fillColor: "#f97316", color: "#ffffff" });
    else marker.setStyle({ fillColor: "#10b981", color: "#ffffff" });
}

function determinarSeveridadVisual(o, d) {
    const p = { 'CRITICO_SIN_ACCION': 5, 'CRITICO_EN_TRAMITE': 4, 'ALERTA_TEMPRANA': 3, 'TRAMITE_EN_PLAZO': 2, 'LEY31955': 1, 'VIGENTE': 0, 'INDEFINIDO': 0, 'CULMINADO': -1 };
    return p[o.estadoRiesgo] > p[d.estadoRiesgo] ? o.estadoRiesgo : d.estadoRiesgo;
}

function aplicarFiltros() {
    grupoMarcadores.clearLayers(); let boundsCount = 0;
    marcadoresGuardados.forEach(obj => {
        let m = true;
        if (filtroActualEstado === "Criticos") m = (obj.severidadGlobal === 'CRITICO_SIN_ACCION');
        else if (filtroActualEstado === "Tramite") m = (obj.evalObra.esTramite || obj.evalDesvio.esTramite);
        else if (filtroActualEstado === "Menor4Meses") m = (obj.severidadGlobal === 'ALERTA_TEMPRANA');
        else if (filtroActualEstado === "Ley31955") m = (obj.severidadGlobal === 'LEY31955');
        else if (filtroActualEstado === "Culminado") m = (obj.severidadGlobal === 'CULMINADO');
        if (m) { obj.marcador.addTo(grupoMarcadores); boundsCount++; }
    });
    if (boundsCount > 0) map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30], maxZoom: 15 });
}

function renderizarTablasCompletas(data, tableId) {
    const tbody = document.getElementById(tableId);
    if (!tbody) return;
    
    const jerarquia = { 'CRITICO_SIN_ACCION': 1, 'CRITICO_EN_TRAMITE': 2, 'ALERTA_TEMPRANA': 3, 'TRAMITE_EN_PLAZO': 4, 'VIGENTE': 5, 'INDEFINIDO': 6, 'LEY31955': 7, 'CULMINADO': 8 };
    
    // Corrección matemática robusta para evitar NaNs que colapsan el renderizado
    data.sort((a, b) => (jerarquia[a.estado] || 99) - (jerarquia[b.estado] || 99) || (a.dias || 0) - (b.dias || 0));

    tbody.innerHTML = '';
    data.forEach(fila => {
        let etiquetaHTML = "";
        let colorFila = "bg-white";

        if (fila.estado === 'CRITICO_SIN_ACCION') {
            etiquetaHTML = `<span class="px-2 py-1 rounded shadow-sm font-bold text-[0.65rem] w-full bg-red-500 text-white">- ${Math.abs(fila.dias)}d (Vencido)</span>`;
            colorFila = "bg-red-50/50";
        } else if (fila.estado === 'CRITICO_EN_TRAMITE') {
            etiquetaHTML = `<span class="px-2 py-1 rounded shadow-sm font-bold text-[0.65rem] w-full bg-fuchsia-600 text-white">- ${Math.abs(fila.dias)}d (En Trámite)</span>`;
            colorFila = "bg-fuchsia-50/40";
        } else if (fila.estado === 'ALERTA_TEMPRANA' || fila.estado === 'TRAMITE_EN_PLAZO' || fila.estado === 'VIGENTE') {
            etiquetaHTML = `<span class="px-2 py-1 rounded shadow-sm font-bold text-[0.65rem] w-full bg-yellow-400 text-slate-800">Quedan ${fila.dias}d</span>`;
        } else if (fila.estado === 'LEY31955') {
            etiquetaHTML = `<span class="px-2 py-1 rounded shadow-sm font-bold text-[0.65rem] w-full bg-orange-500 text-white">Ley 31955</span>`;
        } else if (fila.estado === 'CULMINADO') {
            etiquetaHTML = `<span class="px-2 py-1 rounded shadow-sm font-bold text-[0.65rem] w-full bg-emerald-500 text-white">Culminada</span>`;
        } else {
            etiquetaHTML = `<span class="px-2 py-1 rounded shadow-sm font-bold text-[0.65rem] w-full bg-slate-200 text-slate-600">${fila.orig || 'S/D'}</span>`;
        }

        tbody.innerHTML += `
            <tr class="border-b border-slate-100 hover:bg-slate-100 transition-colors ${colorFila}">
                <td class="p-2 font-bold text-slate-700 whitespace-nowrap">${fila.id}</td>
                <td class="p-2 text-slate-800 font-bold text-[0.65rem] md:text-[0.7rem] leading-tight break-all">${fila.resolucion || 'S/N'}</td>
                <td class="p-2 text-center flex items-center justify-center">${etiquetaHTML}</td>
            </tr>`;
    });
}

function configurarBotonTXT() {
    document.getElementById('btn-reporte-txt').addEventListener('click', (e) => {
        let t = `📊 *REPORTE PERMISOS - L2/L4*\n📅 ${new Date().toLocaleString('es-PE')}\n\n`;
        let ob = window.dataObrasGlobal.filter(d => ['CRITICO_SIN_ACCION', 'CRITICO_EN_TRAMITE'].includes(d.estado));
        let de = window.dataDesviosGlobal.filter(d => ['CRITICO_SIN_ACCION', 'CRITICO_EN_TRAMITE'].includes(d.estado));
        t += `🚧 *OBRAS CRÍTICAS (${ob.length}):*\n`; ob.forEach(o => t += `- ${o.id}: Vencido ${Math.abs(o.dias)}d.\n`);
        t += `\n🚦 *DESVÍOS CRÍTICOS (${de.length}):*\n`; de.forEach(d => t += `- ${d.id}: Vencido ${Math.abs(d.dias)}d.\n`);
        navigator.clipboard.writeText(t).then(() => { let ori = e.target.innerHTML; e.target.innerHTML = "✅ Copiado"; setTimeout(() => e.target.innerHTML = ori, 2000); });
    });
}

function iniciarChatInteligente() {
    const chat = document.getElementById('panel-chat');
    document.getElementById('chat-header').addEventListener('click', () => { chat.classList.toggle('chat-abierta'); chat.classList.toggle('chat-minimizada'); });
    
    const msgContainer = document.getElementById('chat-mensajes');
    const inputChat = document.getElementById('chat-input');
    const agregarMensaje = (txt, tipo) => {
        const div = document.createElement('div');
        div.className = tipo === 'user' ? 'msg-user' : 'msg-bot';
        div.innerHTML = txt;
        msgContainer.appendChild(div);
        msgContainer.scrollTop = msgContainer.scrollHeight;
    };
    
    const enviar = () => {
        let txt = inputChat.value.trim();
        if (!txt) return;
        agregarMensaje(txt, 'user');
        inputChat.value = '';
        setTimeout(() => {
            let res = "Consulta genérica.";
            let nTxt = normalizarTexto(txt);
            if (nTxt.includes('por vencer')) {
                let l = marcadoresGuardados.filter(o => o.severidadGlobal === 'ALERTA_TEMPRANA').map(o => o.datos.ID);
                res = l.length > 0 ? `🟡 <b>Por vencer:</b><br>${l.join(', ')}` : `✅ Ninguna por vencer.`;
            } else {
                let est = marcadoresGuardados.find(o => new RegExp(`\\b${normalizarTexto(o.datos.ID)}\\b`, 'i').test(nTxt));
                if (est) res = `<b>📍 ${est.datos.ID}</b><br>🚧 <b>Obra:</b> ${formatearTextoPopup(est.evalObra)}<br>🚦 <b>Tránsito:</b> ${formatearTextoPopup(est.evalDesvio)}`;
                else res = "Identifica la estructura (Ej: 'PV19').";
            }
            agregarMensaje(res, 'bot');
        }, 400); 
    };

    document.getElementById('btn-enviar-chat').addEventListener('click', enviar);
    inputChat.addEventListener('keypress', (e) => { if(e.key === 'Enter') enviar(); });
}
