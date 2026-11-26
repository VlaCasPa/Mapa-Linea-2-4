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
            let usuarioAutorizado = (esAdmin || reposPermitidos.includes("todos") || reposPermitidos.includes(REPO_ACTUAL));
            if (usuarioAutorizado) {
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

let map, grupoMarcadores, marcadoresGuardados = [], filtroActualEstado = "Todos";
window.dataObrasGlobal = []; window.dataDesviosGlobal = [];
const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRq0plDLd9ROpcnA1ISpEmYlVGguEqYw9L-vUVtiQ0-hsVl_VAq4wxz0x2wURCgFQ/pub?output=csv";
const normalizarTexto = (str) => str ? String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

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

const PRIORIDAD_SEVERIDAD = {
    'CRITICO_SIN_ACCION': 5,
    'CRITICO_EN_TRAMITE': 4,
    'ALERTA_TEMPRANA': 3,
    'TRAMITE_EN_PLAZO': 2,
    'LEY31955': 1,
    'VIGENTE': 0,
    'INDEFINIDO': 0,
    'CULMINADO': -1
};

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
            window.dataObrasGlobal = []; window.dataDesviosGlobal = [];

            const agrupadosPorID = new Map();

            results.data.forEach(item => {
                if (item.Latitud && item.Longitud && item.ID) {
                    const idLimpio = item.ID.trim();
                    let evalObra = evaluarRiesgo(item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Comentarios);
                    let evalDesvio = evaluarRiesgo(item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Comentarios);
                    let sevFila = determinarSeveridadVisual(evalObra, evalDesvio);

                    window.dataObrasGlobal.push({ id: idLimpio, resolucion: item.Aut_Obra_Resolucion, dias: evalObra.diasValor, estado: evalObra.estadoRiesgo, orig: item.Aut_Obra_Dias_Restantes });
                    window.dataDesviosGlobal.push({ id: idLimpio, resolucion: item.Aut_Desvio_Resolucion, dias: evalDesvio.diasValor, estado: evalDesvio.estadoRiesgo, orig: item.Aut_Desvio_Dias_Restantes });

                    if (!agrupadosPorID.has(idLimpio)) {
                        agrupadosPorID.set(idLimpio, []);
                    }
                    agrupadosPorID.get(idLimpio).push({
                        item: item,
                        evalObra: evalObra,
                        evalDesvio: evalDesvio,
                        sev: sevFila
                    });
                }
            });

            agrupadosPorID.forEach((filas, idLimpio) => {
                const primeraFila = filas[0].item;
                let lat = parseFloat(primeraFila.Latitud.toString().replace(/,/g, '.'));
                let lon = parseFloat(primeraFila.Longitud.toString().replace(/,/g, '.'));
                if (isNaN(lat) || isNaN(lon)) return;

                let sevGrupo = filas[0].sev;
                let tieneCriticoSinAccion = false;
                let tieneTramite = false;

                filas.forEach(f => {
                    if ((PRIORIDAD_SEVERIDAD[f.sev] ?? -2) > (PRIORIDAD_SEVERIDAD[sevGrupo] ?? -2)) {
                        sevGrupo = f.sev;
                    }
                    if (f.evalObra.estadoRiesgo === 'CRITICO_SIN_ACCION' || f.evalDesvio.estadoRiesgo === 'CRITICO_SIN_ACCION') {
                        tieneCriticoSinAccion = true;
                    }
                    if (f.evalObra.esTramite || f.evalDesvio.esTramite) {
                        tieneTramite = true;
                    }
                });

                if (tieneCriticoSinAccion) tCriticos++;
                if (tieneTramite) tTramite++;
                if (sevGrupo === 'ALERTA_TEMPRANA') tAlerta++;
                if (sevGrupo === 'LEY31955') tLey++;
                if (sevGrupo === 'CULMINADO') tCulminado++;

                let marker = L.circleMarker([lat, lon], { radius: 7, fillColor: "#2563EB", color: "#ffffff", weight: 2, fillOpacity: 0.95 });
                aplicarEstiloMarcador(marker, sevGrupo);

                let htmlExpedientes = filas.map((f, idx) => {
                    let it = f.item;
                    let comObra = it.Aut_Obra_Comentarios ? `<details class="popup-details mt-2"><summary class="text-blue-600 font-semibold cursor-pointer text-[0.7rem]">💬 Ver sustento...</summary><div class="mt-1 text-[0.7rem] text-gray-600 italic bg-white p-2 border rounded shadow-inner">${it.Aut_Obra_Comentarios}</div></details>` : '';
                    let comDesvio = it.Aut_Desvio_Comentarios ? `<details class="popup-details mt-2"><summary class="text-blue-600 font-semibold cursor-pointer text-[0.7rem]">💬 Ver sustento...</summary><div class="mt-1 text-[0.7rem] text-gray-600 italic bg-white p-2 border rounded shadow-inner">${it.Aut_Desvio_Comentarios}</div></details>` : '';

                    let etiquetaExpediente = filas.length > 1
                        ? `<div class="text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-600 bg-slate-100 px-2 py-0.5 rounded mb-1.5 mt-2 border border-slate-200">📁 Expediente ${idx + 1} de ${filas.length}</div>`
                        : '';

                    return `
                        ${etiquetaExpediente}
                        <div class="auth-box ${obtenerClaseCSS(f.evalObra.estadoRiesgo)}"><span class="font-bold block mb-1 text-slate-700">🚧 Autorización de Obra</span>Res: ${it.Aut_Obra_Resolucion || 'N/A'}<br>Estado: <b class="text-slate-800">${formatearTextoPopup(f.evalObra)}</b>${comObra}</div>
                        <div class="auth-box ${obtenerClaseCSS(f.evalDesvio.estadoRiesgo)}"><span class="font-bold block mb-1 text-slate-700">🚦 Desvío de Tránsito</span>Res: ${it.Aut_Desvio_Resolucion || 'N/A'}<br>Estado: <b class="text-slate-800">${formatearTextoPopup(f.evalDesvio)}</b>${comDesvio}</div>
                    `;
                }).join('');

                let htmlMinCultura = '';
                if (dataMinCultura[idLimpio]) {
                    let historialFases = dataMinCultura[idLimpio].map(f => 
                        `<div class="mb-2 border-b border-indigo-100 pb-1 last:border-0 last:mb-0 last:pb-0">
                            <span class="etiqueta-fase">${f.fase}</span><br>
                            <span class="text-[0.7rem] text-slate-700 font-bold break-all">Res: ${f.res}</span><br>
                            <span class="text-[0.65rem] text-slate-500">Emitida: ${f.fecha}</span>
                        </div>`
                    ).join('');
                    htmlMinCultura = `<div class="auth-box estado-patrimonio mt-2"><span class="font-bold block mb-1 text-indigo-900">🏛️ Patrimonio (Min. Cultura)</span>${historialFases}</div>`;
                }

                let htmlProvias = '';
                if (dataProvias[idLimpio]) {
                    let historialProvias = dataProvias[idLimpio].map(p => 
                        `<div class="mb-2 border-b border-sky-100 pb-1 last:border-0 last:mb-0 last:pb-0">
                            <span class="etiqueta-provias">PROVIAS NACIONAL</span><br>
                            <span class="text-[0.7rem] text-slate-700 font-bold break-all">Aut: ${p.res}</span><br>
                            <span class="text-[0.65rem] text-slate-500">Emitida: ${p.fecha}</span>
                        </div>`
                    ).join('');
                    htmlProvias = `<div class="auth-box estado-provias mt-2"><span class="font-bold block mb-1 text-sky-900">🛣️ Vial Nacional (Provias)</span>${historialProvias}</div>`;
                }

                marker.bindPopup(`
                    <div class="popup-container">
                        <h3 class="popup-title font-bold text-slate-800">${idLimpio}: ${primeraFila.Nombre}</h3>
                        <div class="popup-subtitle text-xs text-slate-500 mb-2">📍 ${primeraFila.Municipalidad} | ${primeraFila.Linea} - ${primeraFila.Tipo}</div>
                        ${htmlExpedientes}
                        ${htmlMinCultura}
                        ${htmlProvias}
                    </div>
                `);
                marker.bindTooltip(idLimpio, { permanent: true, direction: 'right', className: 'font-bold bg-white/90 px-1 rounded shadow-sm text-[0.65rem]' });

                marcadoresGuardados.push({
                    id: idLimpio,
                    marcador: marker,
                    datos: primeraFila,
                    filasEvaluadas: filas,
                    severidadGlobal: sevGrupo,
                    tieneCriticoSinAccion: tieneCriticoSinAccion,
                    tieneTramite: tieneTramite,
                    lat: lat,
                    lon: lon
                });
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
    let esC = dStr === "culminado" || tc.includes("culminado"); let esT = dStr === "en tramite" || tc.includes("tramite"); let esE = dStr === "exonerado" || tc.includes("exonerado");
    let vMat = !isNaN(dNum) && dNum < 0; let aTemp = !isNaN(dNum) && dNum >= 0 && dNum <= 120;
    let estado = 'VIGENTE', accion = 'Monitorear';
    if (esC) { estado = 'CULMINADO'; accion = 'Arch
