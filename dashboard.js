Chart.register(window.ChartDataLabels);

const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";
const normalizarTexto = (str) => str ? String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

window.addEventListener('DOMContentLoaded', () => {
    let fecha = new Date();
    document.getElementById('dash-fecha').innerText = fecha.toLocaleDateString('es-PE');
    document.getElementById('dash-hora').innerText = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    Papa.parse(urlCSV, {
        download: true, header: true,
        complete: function(results) {
            
            let st = { critico: 0, tramite: 0, alerta: 0, ley: 0, culminado: 0 };
            let jur = { obraLima: 0, obraCallao: 0, desvioLima: 0, desvioCallao: 0 };
            let look = { d30: 0, d60: 0, d90: 0, d120: 0 };
            
            let tablaUrgente = [], tablaObraTramite = [], tablaDesvioTramite = [];
            let consolidadoObras = [], consolidadoDesvios = [];

            results.data.forEach(item => {
                if (!item.ID) return;

                let loc = normalizarTexto(item.Municipalidad);
                let esCallao = loc.includes('callao') || loc.includes('carmen de la legua') || loc.includes('bellavista') || loc.includes('la perla');

                const evaluar = (dias, comentarios) => {
                    let dNum = parseInt(dias); let dStr = normalizarTexto(dias); let tc = normalizarTexto(comentarios);
                    let esC = dStr === "culminado" || tc.includes("culminado");
                    let esT = dStr === "en tramite" || tc.includes("tramite");
                    let esE = dStr === "exonerado" || tc.includes("exonerado");
                    let estado = 'VIGENTE';
                    if (esC) estado = 'CULMINADO'; else if (esE) estado = 'LEY31955'; else if (dNum < 0 && !esT) estado = 'CRITICO'; else if (dNum < 0 && esT) estado = 'TRAMITE'; else if (dNum >= 0 && dNum <= 120 && !esT) estado = 'ALERTA'; else if (esT) estado = 'TRAMITE'; else if (dNum === 0) estado = 'CRITICO';
                    return { estado, dNum };
                };

                let evO = evaluar(item.Aut_Obra_Dias_Restantes, item.Aut_Obra_Comentarios);
                let evD = evaluar(item.Aut_Desvio_Dias_Restantes, item.Aut_Desvio_Comentarios);

                [evO, evD].forEach(ev => {
                    if (ev.estado === 'CRITICO') st.critico++;
                    if (ev.estado === 'TRAMITE') st.tramite++;
                    if (ev.estado === 'ALERTA') st.alerta++;
                    if (ev.estado === 'LEY31955') st.ley++;
                    if (ev.estado === 'CULMINADO') st.culminado++;

                    if (ev.estado === 'ALERTA' || ev.estado === 'VIGENTE') {
                        if (ev.dNum >= 0 && ev.dNum <= 30) look.d30++;
                        else if (ev.dNum > 30 && ev.dNum <= 60) look.d60++;
                        else if (ev.dNum > 60 && ev.dNum <= 90) look.d90++;
                        else if (ev.dNum > 90 && ev.dNum <= 120) look.d120++;
                    }
                });

                if (evO.estado !== 'CULMINADO') { if (esCallao) jur.obraCallao++; else jur.obraLima++; }
                if (evD.estado !== 'CULMINADO') { if (esCallao) jur.desvioCallao++; else jur.desvioLima++; }

                if (evO.estado === 'CRITICO') tablaUrgente.push({ id: item.ID, tipo: 'Obra', res: item.Aut_Obra_Resolucion, dias: evO.dNum });
                if (evD.estado === 'CRITICO') tablaUrgente.push({ id: item.ID, tipo: 'Desvío', res: item.Aut_Desvio_Resolucion, dias: evD.dNum });
                
                if (evO.estado === 'TRAMITE' && evO.dNum !== null && evO.dNum < 0) tablaObraTramite.push({ id: item.ID, res: item.Aut_Obra_Resolucion, dias: evO.dNum });
                if (evD.estado === 'TRAMITE' && evD.dNum !== null && evD.dNum < 0) tablaDesvioTramite.push({ id: item.ID, res: item.Aut_Desvio_Resolucion, dias: evD.dNum });

                // Almacenar todos los expedientes medibles para el Ranking (Vencidos y Por Vencer)
                if (evO.dNum !== null && evO.estado !== 'CULMINADO' && evO.estado !== 'LEY31955') {
                    consolidadoObras.push({ id: item.ID, dias: evO.dNum, tipo: 'Obra' }); 
                }
                if (evD.dNum !== null && evD.estado !== 'CULMINADO' && evD.estado !== 'LEY31955') {
                    consolidadoDesvios.push({ id: item.ID, dias: evD.dNum, tipo: 'Desvío' }); 
                }
            });

            let totalGeneral = st.critico + st.tramite + st.alerta + st.ley + st.culminado;
            new Chart(document.getElementById('chart-portafolio'), {
                type: 'doughnut',
                data: {
                    labels: ['Sin Acción', 'En Trámite', '< 4 Meses', 'Ley 31955', 'Culminadas'],
                    datasets: [{ data: [st.critico, st.tramite, st.alerta, st.ley, st.culminado], backgroundColor: ['#dc2626', '#c026d3', '#f59e0b', '#f97316', '#10b981'], borderWidth: 1 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, cutout: '65%',
                    plugins: {
                        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 9, family: 'Inter' } } },
                        datalabels: {
                            color: '#1e293b', font: { weight: 'bold', size: 10 },
                            formatter: (value) => value > 0 ? Math.round((value / totalGeneral) * 100) + '%' : '',
                            anchor: 'end', align: 'end', offset: 2
                        }
                    },
                    layout: { padding: { top: 10, bottom: 10, left: 10, right: 30 } }
                }
            });

            new Chart(document.getElementById('chart-jurisdiccion'), {
                type: 'bar',
                data: {
                    labels: ['Obras', 'Desvíos'],
                    datasets: [
                        { label: 'Lima', data: [jur.obraLima, jur.desvioLima], backgroundColor: '#3b82f6', borderRadius: 2 },
                        { label: 'Callao', data: [jur.obraCallao, jur.desvioCallao], backgroundColor: '#f59e0b', borderRadius: 2 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, indexAxis: 'y', 
                    plugins: { 
                        legend: { display: true, position: 'top', labels: { boxWidth: 8, font: {size: 8} } },
                        datalabels: { 
                            display: true, color: 'white', font: { weight: 'bold', size: 8 },
                            formatter: (value, ctx) => {
                                let totalFila = ctx.chart.data.datasets[0].data[ctx.dataIndex] + ctx.chart.data.datasets[1].data[ctx.dataIndex];
                                return (totalFila > 0 && value > 0) ? Math.round((value / totalFila) * 100) + '%' : '';
                            }
                        }
                    },
                    scales: { x: { stacked: true, display: false }, y: { stacked: true, ticks: { font: { size: 9, weight: 'bold' } } } }
                }
            });

            new Chart(document.getElementById('chart-lookahead'), {
                type: 'bar',
                data: {
                    labels: ['0-30 d', '31-60 d', '61-90 d', '91-120 d'],
                    datasets: [{ label: 'Vencimientos Previstos', data: [look.d30, look.d60, look.d90, look.d120], backgroundColor: '#fcd34d', borderRadius: 4 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, datalabels: { anchor: 'end', align: 'top', color: '#1e293b', font: { weight: 'bold', size: 9 } } },
                    scales: { y: { display: false }, x: { ticks: { font: { size: 9 } }, grid: { display: false } } }
                }
            });

            // GRÁFICO DINÁMICO OBRAS (Rojo si <0, Amarillo si >=0)
            let top10Obras = consolidadoObras.sort((a,b) => a.dias - b.dias).slice(0, 10);
            let maxObras = top10Obras.length > 0 ? Math.max(...top10Obras.map(d => Math.abs(d.dias))) : 10;
            new Chart(document.getElementById('chart-obras-criticas'), {
                type: 'bar',
                data: {
                    labels: top10Obras.map(d => d.id),
                    datasets: [{ 
                        data: top10Obras.map(d => Math.abs(d.dias)), 
                        backgroundColor: top10Obras.map(d => d.dias < 0 ? '#dc2626' : '#eab308'), 
                        borderRadius: 3 
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false }, 
                        tooltip: { callbacks: { label: (ctx) => { let realD = top10Obras[ctx.dataIndex].dias; return realD < 0 ? ` Vencido por ${Math.abs(realD)} días` : ` Quedan ${realD} días`; } } },
                        datalabels: { anchor: 'end', align: 'top', font: { size: 7, weight: 'bold' }, formatter: (v, ctx) => { let realD = top10Obras[ctx.dataIndex].dias; return realD < 0 ? `-${v}d` : `${v}d`; }, color: (ctx) => top10Obras[ctx.dataIndex].dias < 0 ? '#b91c1c' : '#ca8a04' } 
                    },
                    scales: { y: { display: false, suggestedMax: maxObras + 20 }, x: { grid: { display: false }, ticks: { font: { size: 7, weight: 'bold' }, maxRotation: 45, minRotation: 45 } } }
                }
            });

            // GRÁFICO DINÁMICO DESVÍOS (Fucsia si <0, Amarillo si >=0)
            let top10Desvios = consolidadoDesvios.sort((a,b) => a.dias - b.dias).slice(0, 10);
            let maxDesvios = top10Desvios.length > 0 ? Math.max(...top10Desvios.map(d => Math.abs(d.dias))) : 10;
            new Chart(document.getElementById('chart-desvios-criticos'), {
                type: 'bar',
                data: {
                    labels: top10Desvios.map(d => d.id),
                    datasets: [{ 
                        data: top10Desvios.map(d => Math.abs(d.dias)), 
                        backgroundColor: top10Desvios.map(d => d.dias < 0 ? '#c026d3' : '#eab308'), 
                        borderRadius: 3 
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { 
                        legend: { display: false }, 
                        tooltip: { callbacks: { label: (ctx) => { let realD = top10Desvios[ctx.dataIndex].dias; return realD < 0 ? ` Vencido por ${Math.abs(realD)} días` : ` Quedan ${realD} días`; } } },
                        datalabels: { anchor: 'end', align: 'top', font: { size: 7, weight: 'bold' }, formatter: (v, ctx) => { let realD = top10Desvios[ctx.dataIndex].dias; return realD < 0 ? `-${v}d` : `${v}d`; }, color: (ctx) => top10Desvios[ctx.dataIndex].dias < 0 ? '#a21caf' : '#ca8a04' } 
                    },
                    scales: { y: { display: false, suggestedMax: maxDesvios + 20 }, x: { grid: { display: false }, ticks: { font: { size: 7, weight: 'bold' }, maxRotation: 45, minRotation: 45 } } }
                }
            });

            const poblarTabla = (idTbody, data, isUrgente) => {
                const tb = document.querySelector(`#${idTbody} tbody`);
                data.sort((a, b) => a.dias - b.dias).slice(0, 5).forEach(d => { 
                    let colorDias = isUrgente ? 'text-red-700' : 'text-fuchsia-700';
                    let cont = isUrgente ? `<span class="bg-red-100 px-2 py-0.5 rounded text-red-700 font-bold text-[9px]">-Vencido ${Math.abs(d.dias)}d</span>` : `<span class="text-[10px] font-black ${colorDias}">- ${Math.abs(d.dias)} días</span>`;
                    
                    let fila = `<tr><td class="text-slate-800">${d.id}</td>`;
                    if (isUrgente) fila += `<td class="text-slate-500">${d.tipo}</td>`;
                    fila += `<td class="text-slate-500 truncate max-w-[150px]">${d.res || 'S/N'}</td><td class="text-right">${cont}</td></tr>`;
                    tb.innerHTML += fila;
                });
            };

            poblarTabla('tb-urgente', tablaUrgente, true);
            poblarTabla('tb-obra-tramite', tablaObraTramite, false);
            poblarTabla('tb-desvio-tramite', tablaDesvioTramite, false);
        }
    });

    document.getElementById('btn-exportar-pdf').addEventListener('click', (e) => {
        let btn = e.target; let ori = btn.innerHTML; btn.innerHTML = "⏳ Procesando PDF...";
        window.scrollTo(0, 0);
        const el = document.getElementById('lienzo-pdf');
        el.classList.add('modo-impresion');

        const opt = {
            margin: 0,
            filename: `Informe_Estrategico_L2L4_${new Date().getTime()}.pdf`,
            image: { type: 'jpeg', quality: 1.0 },
            html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0, windowWidth: 794 }, 
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(el).save().then(() => {
            el.classList.remove('modo-impresion'); 
            btn.innerHTML = "✅ Informe Descargado";
            setTimeout(() => btn.innerHTML = ori, 3000);
        });
    });
});
