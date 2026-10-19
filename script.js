import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC1XakVAZLUDq3-240Q_KoYYPU5JKCTjzs",
    authDomain: "metrol2-iam-central.firebaseapp.com",
    projectId: "metrol2-iam-central",
    storageBucket: "metrol2-iam-central.firebasestorage.app",
    messagingSenderId: "78845391762",
    appId: "1:78845391762:web:d64611cd7c4ef65a24074b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); 
const provider = new GoogleAuthProvider();

const REPO_ACTUAL = "Mapa-Linea-2-4";
const STORAGE_KEY_DISCLAIMER = "ccm2l_mapa_linea_2_4_disclaimer_accepted_v1";
let usuarioActualGlobal = null;

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
    signInWithPopup(auth, provider).catch(() => { 
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

onAuthStateChanged(auth, async (user) => {
    if (user) {
        usuarioActualGlobal = user;
        await validarPermisosYDisclaimer(user);
    } else {
        pantallaBloqueo.style.display = 'flex';
        appPrincipal.style.display = 'none';
        ocultarDisclaimer();
    }
});

async function validarPermisosYDisclaimer(user) {
    const emailUser = user.email.toLowerCase().trim();
    if (["zebaxx@gmail.com", "vcasasp@ccmetrolima.com", "permisosccm2l@gmail.com", "tnoriega.arq@gmail.com"].includes(emailUser)) {
        pantallaBloqueo.style.display = 'none';
        verificarDisclaimerUsuario();
        return;
    }
    try {
        const docRef = doc(db, "usuarios", emailUser);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const datosUsuario = docSnap.data();
            const esAdmin = datosUsuario.es_admin || false;
            const reposPermitidos = datosUsuario.repositorios_permitidos || datosUsuario.permisos_escritura || [];
            if (esAdmin || reposPermitidos.includes("todos") || reposPermitidos.includes(REPO_ACTUAL)) {
                pantallaBloqueo.style.display = 'none';
                verificarDisclaimerUsuario();
            } else {
                alert("No cuenta con autorización para acceder a este repositorio.");
                await signOut(auth);
            }
        } else {
            alert("Usuario no registrado en el sistema IAM central.");
            await signOut(auth);
        }
    } catch (error) {
        console.error("Error al validar contra Firestore:", error);
        pantallaBloqueo.style.display = 'none';
        verificarDisclaimerUsuario();
    }
}

function verificarDisclaimerUsuario() {
    if (!localStorage.getItem(STORAGE_KEY_DISCLAIMER)) mostrarDisclaimer();
    else { ocultarDisclaimer(); appPrincipal.style.display = 'flex'; iniciarMotorDelMapa(); }
}

function mostrarDisclaimer() { const modal = document.getElementById('disclaimer-modal'); if (modal) modal.style.display = 'flex'; }
function ocultarDisclaimer() { const modal = document.getElementById('disclaimer-modal'); if (modal) modal.style.display = 'none'; }

window.aceptarDisclaimer = async function() {
    if (!usuarioActualGlobal) return;
    const emailUser = usuarioActualGlobal.email.toLowerCase().trim();
    localStorage.setItem(STORAGE_KEY_DISCLAIMER, "true");
    try {
        const discRef = doc(db, "aceptaciones_disclaimer", emailUser);
        await setDoc(discRef, { email: emailUser, aceptado: true, repositorio: REPO_ACTUAL, fecha_aceptacion: serverTimestamp(), dispositivo: navigator.userAgent }, { merge: true });
        ocultarDisclaimer(); appPrincipal.style.display = 'flex'; iniciarMotorDelMapa();
    } catch (err) {
        ocultarDisclaimer(); appPrincipal.style.display = 'flex'; iniciarMotorDelMapa();
    }
};

let map, grupoMarcadores, marcadoresGuardados = [], filtroActualEstado = "Todos", filtroActualID = "Todos";
window.datosGlobales = [];
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";

// BASES DE DATOS MINCUL Y PROVIAS
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

const dataProvias = {
    "PV4 01BIS": [{ res: "RSD N° 3540-2023-MTC-20.13.2", fecha: "02/03/2023" }, { res: "RSD N° 3542-2023-MTC-20.13.2", fecha: "03/03/2023" }],
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

function iniciarMotorDelMapa() {
    if (map) return; 
    map = L.map('map', { zoomControl: false }).setView([-12.055, -77.050], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], className: 'mapa-google-gris' }).addTo(map);
    grupoMarcadores = L.featureGroup().addTo(map);

    Papa.parse(urlCSV, {
        download: true, header: true,
        complete: function(results) {
            window.datosGlobales = results.data;
            let contenedorIDs = document.getElementById('contenedor-filtros-id');
            
            window.datosGlobales.forEach(item => {
                if (item.Latitud && item.Longitud && item.ID) {
                    if (!document.querySelector(`button[data-id="${item.ID}"]`)) {
                        let btn = document.createElement('button');
                        btn.className = 'btn-pill'; btn.setAttribute('data-id', item.ID); btn.innerText = item.ID;
                        if (contenedorIDs) contenedorIDs.appendChild(btn);
                    }

                    let claseObra = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes);
                    let claseDesvio = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);
                    
                    let comObra = item.Aut_Obra_Comentarios ? `<details class="popup-details"><summary class="popup-summary">💬 Ver comentarios de obra...</summary><div class="popup-comment-text">${item.Aut_Obra_Comentarios}</div></details>` : '';
                    let comDesvio = item.Aut_Desvio_Comentarios ? `<details class="popup-details"><summary class="popup-summary">💬 Ver comentarios de desvío...</summary><div class="popup-comment-text">${item.Aut_Desvio_Comentarios}</div></details>` : '';

                    let htmlMinCultura = '';
                    if (dataMinCultura[item.ID]) {
                        let h = dataMinCultura[item.ID].map(f => `<div style="margin-bottom:6px; border-bottom:1px solid #e0e7ff; padding-bottom:4px;"><span style="background:#818cf8; color:white; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:bold;">${f.fase}</span><br><span style="font-size:11px; color:#334155; font-weight:600;">Res: ${f.res}</span><br><span style="font-size:10px; color:#64748b;">Emitida: ${f.fecha}</span></div>`).join('');
                        htmlMinCultura = `<div class="auth-box" style="background-color:#eef2ff; border-left:4px solid #6366f1;"><span class="auth-title" style="color:#312e81;">🏛️ Patrimonio (Min. Cultura)</span>${h}</div>`;
                    }

                    let htmlProvias = '';
                    if (dataProvias[item.ID]) {
                        let h = dataProvias[item.ID].map(p => `<div style="margin-bottom:6px; border-bottom:1px solid #e0f2fe; padding-bottom:4px;"><span style="background:#38bdf8; color:white; padding:1px 5px; border-radius:4px; font-size:10px; font-weight:bold;">PROVIAS NACIONAL</span><br><span style="font-size:11px; color:#334155; font-weight:600;">Aut: ${p.res}</span><br><span style="font-size:10px; color:#64748b;">Emitida: ${p.fecha}</span></div>`).join('');
                        htmlProvias = `<div class="auth-box" style="background-color:#f0f9ff; border-left:4px solid #0284c7;"><span class="auth-title" style="color:#0369a1;">🛣️ Vial Nacional (Provias)</span>${h}</div>`;
                    }

                    let popupContent = `<div class="popup-container"><h3 class="popup-title">${item.ID}: ${item.Nombre}</h3><div class="popup-subtitle">📍 ${item.Municipalidad} | ${item.Linea} - ${item.Tipo}</div><div class="auth-box ${claseObra}"><span class="auth-title">🚧 Autorización de Obra</span>Resolución: ${item.Aut_Obra_Resolucion || 'N/A'}<br>Estado: <b>${formatearDias(item.Aut_Obra_Dias_Restantes)}</b>${comObra}</div><div class="auth-box ${claseDesvio}"><span class="auth-title">🚦 Desvío de Tránsito</span>Resolución: ${item.Aut_Desvio_Resolucion || 'N/A'}<br>Estado: <b>${formatearDias(item.Aut_Desvio_Dias_Restantes)}</b>${comDesvio}</div>${htmlMinCultura}${htmlProvias}</div>`;

                    let lat = parseFloat(item.Latitud ? item.Latitud.toString().replace(/,/g, '.') : "");
                    let lon = parseFloat(item.Longitud ? item.Longitud.toString().replace(/,/g, '.') : "");

                    if (!isNaN(lat) && !isNaN(lon)) {
                        let markerColor = item.Tipo && item.Tipo.toLowerCase() === "pozo" ? "#475569" : "#2563EB"; 
                        let severidad = 'normal';
                        let aplicaLey = (claseObra === 'estado-exonerado' || claseDesvio === 'estado-exonerado'); 
                        let dObra = parseInt(item.Aut_Obra_Dias_Restantes), dDesvio = parseInt(item.Aut_Desvio_Dias_Restantes);
                        let alertaPreventiva = ((!isNaN(dObra) && dObra >= 0 && dObra <= 120) || (!isNaN(dDesvio) && dDesvio >= 0 && dDesvio <= 120));

                        if (claseObra === 'estado-culminado' || claseDesvio === 'estado-culminado') { markerColor = "#10B981"; severidad = 'culminado'; alertaPreventiva = false; }
                        else if (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido' || claseObra === 'estado-critico' || claseDesvio === 'estado-critico') { markerColor = "#DC2626"; severidad = (claseObra === 'estado-vencido' || claseDesvio === 'estado-vencido') ? 'vencido' : 'critico'; alertaPreventiva = false; }
                        else if (claseObra === 'estado-tramite' || claseDesvio === 'estado-tramite') { severidad = 'tramite'; }
                        
                        let marker = L.circleMarker([lat, lon], { radius: 8, fillColor: markerColor, color: "#ffffff", weight: 2, opacity: 1, fillOpacity: 0.8 });
                        marker.bindPopup(popupContent);
                        marker.bindTooltip(item.ID, { permanent: true, direction: 'right', className: 'id-tooltip', offset: [5, 0] });
                        
                        marcadoresGuardados.push({ id: item.ID, marcador: marker, datos: item, estadoSeveridad: severidad, colorOriginal: markerColor, esLey31955: aplicaLey, esMenor4Meses: alertaPreventiva });
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
            
            // Botón TXT universal
            const btnTxt = document.getElementById('btn-reporte-txt');
            if(btnTxt) {
                btnTxt.addEventListener('click', () => {
                    let vencidos = [], criticos = [], menor4Meses = [], tramite = [], culminados = [], ley31955 = []; 
                    window.datosGlobales.forEach(item => {
                        if (item.ID && item.Latitud) {
                            let cO = obtenerClaseEstado(item.Aut_Obra_Dias_Restantes), cD = obtenerClaseEstado(item.Aut_Desvio_Dias_Restantes);
                            let esV = (cO === 'estado-vencido' || cD === 'estado-vencido'), esC = (cO === 'estado-critico' || cD === 'estado-critico');
                            let esT = (cO === 'estado-tramite' || cD === 'estado-tramite'), esCul = (cO === 'estado-culminado' || cD === 'estado-culminado');
                            let esLey = (cO === 'estado-exonerado' || cD === 'estado-exonerado'); 
                            let dO = parseInt(item.Aut_Obra_Dias_Restantes), dD = parseInt(item.Aut_Desvio_Dias_Restantes);
                            let esM4 = ((!isNaN(dO) && dO >= 0 && dO <= 120) || (!isNaN(dD) && dD >= 0 && dD <= 120));

                            if (esV) vencidos.push(item.ID); else if (esC) criticos.push(item.ID);
                            if (esM4 && !esCul && !esV) menor4Meses.push(item.ID);
                            if (esT && !esV && !esC) tramite.push(item.ID);
                            if (esCul && !esV && !esC && !esT) culminados.push(item.ID);
                            if (esLey) ley31955.push(item.ID); 
                        }
                    });
                    let texto = `📊 *REPORTE AUTORIZACIONES - LÍNEA 2 Y RAMAL L4* 🚇\n📅 Fecha: ${new Date().toLocaleDateString('es-PE')}\n\n🔴 *VENCIDOS (${vencidos.length}):* ${vencidos.join(', ') || 'Ninguno'}\n🟠 *CRÍTICOS <29 DÍAS (${criticos.length}):* ${criticos.join(', ') || 'Ninguno'}\n🟡 *POR VENCER < 4 MESES (${menor4Meses.length}):* ${menor4Meses.join(', ') || 'Ninguno'}\n🟣 *EN TRÁMITE (${tramite.length}):* ${tramite.join(', ') || 'Ninguno'}\n🟢 *OBRAS CULMINADAS (${culminados.length}):* ${culminados.join(', ') || 'Ninguno'}\n⚖️ *AMPARO LEY N° 31955 (${ley31955.length}):* ${ley31955.join(', ') || 'Ninguno'}\n🔗 *Ver mapa:* https://vlacaspa.github.io/Mapa-Linea-2-4/`;
                    
                    let textArea = document.createElement("textarea"); textArea.value = texto; document.body.appendChild(textArea); textArea.select();
                    try { document.execCommand('copy'); alert("✅ Reporte copiado correctamente."); } catch (err) { alert("Error al copiar."); }
                    document.body.removeChild(textArea);
                });
            }
        }
    });
}

function aplicarFiltros() {
    grupoMarcadores.clearLayers(); 
    let boundsCount = 0;
    let countCriticos = 0, countPorVencer = 0, countLey = 0, countTramite = 0, countCulminados = 0;
    
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

        // Conteo general KPIs sin afectar filtro
        if (obj.estadoSeveridad === 'vencido' || obj.estadoSeveridad === 'critico') countCriticos++;
        else if (obj.esMenor4Meses && obj.estadoSeveridad !== 'culminado') countPorVencer++;
        else if (obj.esLey31955) countLey++;
        else if (obj.estadoSeveridad === 'tramite') countTramite++;
        else if (obj.estadoSeveridad === 'culminado') countCulminados++;
    });
    
    if (boundsCount > 0) map.fitBounds(grupoMarcadores.getBounds(), { padding: [30, 30], maxZoom: 15 });
    
    if (document.getElementById('kpi-rojo')) document.getElementById('kpi-rojo').innerText = countCriticos;
    if (document.getElementById('kpi-amarillo')) document.getElementById('kpi-amarillo').innerText = countPorVencer;
    if (document.getElementById('kpi-naranja')) document.getElementById('kpi-naranja').innerText = countLey;
    if (document.getElementById('kpi-morado')) document.getElementById('kpi-morado').innerText = countTramite;
    if (document.getElementById('kpi-verde')) document.getElementById('kpi-verde').innerText = countCulminados;
}
