const urlCSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSz_DsP2CT07FaYNRe4MIX7cO25I01gUb9e_aboGNrIHyBzHiVCX-Ea800l6R76rQ/pub?output=csv";
const normalizarTexto = (str) => str ? String(str).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";

window.addEventListener('DOMContentLoaded', () => {
    let fecha = new Date();
    document.getElementById('dash-fecha').innerText = fecha.toLocaleDateString('es-PE');
    document.getElementById('dash-hora').innerText = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

    Papa.parse(urlCSV, {
        download: true, header: true,
        complete: function(results) {
            let tCriticos=0, tTramite=0, rankingObra=[], rankingDesvio=[];
            let totalGeneral = results.data.length * 2;

            results.data.forEach(item => {
                let obT = normalizarTexto(item.Aut_Obra_Comentarios).includes("tramite") || normalizarTexto(item.Aut_Obra_Dias_Restantes) === "en tramite";
                let obV = parseInt(item.Aut_Obra_Dias_Restantes) < 0;
                if (obV && !obT) tCriticos++; if (obT) tTramite++;
                if (obV || obT) rankingObra.push({ id: item.ID, res: item.Aut_Obra_Resolucion, tram: obT, dias: Math.abs(parseInt(item.Aut_Obra_Dias_Restantes) || 0) });

                let deT = normalizarTexto(item.Aut_Desvio_Comentarios).includes("tramite") || normalizarTexto(item.Aut_Desvio_Dias_Restantes) === "en tramite";
                let deV = parseInt(item.Aut_Desvio_Dias_Restantes) < 0;
                if (deV && !deT) tCriticos++; if (deT) tTramite++;
                if (deV || deT) rankingDesvio.push({ id: item.ID, res: item.Aut_Desvio_Resolucion, tram: deT, dias: Math.abs(parseInt(item.Aut_Desvio_Dias_Restantes) || 0) });
            });

            document.getElementById('dash-kpi-rojo').innerText = tCriticos;
            document.getElementById('dash-kpi-morado').innerText = tTramite;
            document.getElementById('dash-pct-rojo').innerText = totalGeneral > 0 ? Math.round((tCriticos/totalGeneral)*100)+'%' : '0%';
            document.getElementById('dash-pct-morado').innerText = totalGeneral > 0 ? Math.round((tTramite/totalGeneral)*100)+'%' : '0%';

            new Chart(document.getElementById('dash-chart-proporciones'), {
                type: 'doughnut',
                data: { labels: ['Críticos', 'Trámites', 'Vigentes'], datasets: [{ data: [tCriticos, tTramite, totalGeneral - tCriticos - tTramite], backgroundColor: ['#ef4444', '#d946ef', '#cbd5e1'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }
            });

            const renderTop = (idTb, dataArray) => {
                const tb = document.getElementById(idTb);
                dataArray.sort((a, b) => b.dias - a.dias).slice(0, 10).forEach(d => {
                    tb.innerHTML += `<tr><td class="p-2 font-bold border-b border-slate-200">${d.id}</td><td class="p-2 text-slate-500 border-b border-slate-200">${d.res||'S/R'}</td><td class="p-2 font-semibold border-b border-slate-200 ${d.tram?'text-fuchsia-600':'text-red-600'}">${d.tram?'Entidad Municipal':'Sin Acción'}</td><td class="p-2 text-center font-bold text-lg border-b border-slate-200">${d.dias}</td></tr>`;
                });
            };
            renderTop('dash-tabla-obra', rankingObra);
            renderTop('dash-tabla-desvio', rankingDesvio);
        }
    });

    document.getElementById('btn-exportar-pdf').addEventListener('click', (e) => {
        let b = e.target; let ori = b.innerHTML; b.innerHTML = "⏳ Procesando PDF...";
        html2pdf().set({ margin: [10, 0], filename: `Reporte_L2L4_${new Date().getTime()}.pdf`, image: { type: 'jpeg', quality: 1.0 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(document.getElementById('lienzo-pdf')).save().then(() => { b.innerHTML = "✅ PDF Listo"; setTimeout(() => b.innerHTML = ori, 2000); });
    });
});
