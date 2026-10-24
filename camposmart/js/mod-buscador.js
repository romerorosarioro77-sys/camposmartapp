// --- MÓDULO 2: LÓGICA DE CATEGORÍAS, BUSCADOR Y DASHBOARD (MOD-BUSCADOR.JS) ---

// 1. REFRESCA LOS DESPLEGABLES DE CATEGORÍAS EN LOS FORMULARIOS
function refrescarDesplegablesCategorias() {
    if (!dbInstancia) return;
    const tx = dbInstancia.transaction("categorias", "readonly");
    tx.objectStore("categorias").getAll().onsuccess = (e) => {
        const listado = e.target.result;
        const selectAnimales = document.getElementById("categoria-select");
        if (selectAnimales) {
            selectAnimales.innerHTML = listado.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
        }
    };
}

// 2. CREA UNA NUEVA CATEGORÍA PARAMETRIZABLE
function crearNuevaCategoriaParametrizable() {
    const input = document.getElementById("nueva-cat-nombre");
    const val = input.value.trim();
    if(!val) return;

    const tx = dbInstancia.transaction("categorias", "readwrite");
    tx.objectStore("categorias").add({ nombre: val }).onsuccess = () => {
        if (typeof emitirNotificacionToast === "function") {
            emitirNotificacionToast("Categoría añadida al registro.", "exito");
        }
        input.value = "";
        refrescarDesplegablesCategorias();
        ejecutarCalculosDashboardStock();
    };
}

// 3. DASHBOARD: TABLERO MATEMÁTICO DE STOCK GENERAL Y TOTALIZADO
function ejecutarCalculosDashboardStock() {
    if (!dbInstancia) return;
    const tx = dbInstancia.transaction(["animales", "categorias"], "readonly");
    let catalogoCategorias = [];
    
    tx.objectStore("categorias").getAll().onsuccess = (e) => {
        catalogoCategorias = e.target.result;
    };

    tx.objectStore("animales").getAll().onsuccess = (e) => {
        const animales = e.target.result;
        const panel = document.getElementById("dashboard-stock");
        if (!panel) return;
        
        const conteoMapeado = {};
        catalogoCategorias.forEach(c => conteoMapeado[c.nombre] = 0);
        
        animales.forEach(a => { 
            if(conteoMapeado[a.categoria] !== undefined) conteoMapeado[a.categoria]++; 
        });

        let tableroHtml = `
            <div class="dash-bloque completo">
                <label><i class="fa-solid fa-calculator"></i> Total Ganado Existente</label>
                <div class="dash-cifra">${animales.length} Cabezas</div>
            </div>
        `;

        for(const [nombreCat, total] of Object.entries(conteoMapeado)) {
            tableroHtml += `
                <div class="dash-bloque">
                    <label>${nombreCat}</label>
                    <div class="dash-cifra">${total}</div>
                </div>
            `;
        }
        panel.innerHTML = tableroHtml;
    };
}

// 4. BUSCADOR INTELIGENTE EN TIEMPO REAL CON HISTORIAL CRUZADO DEFINITIVO
function filtrarYMostrarAnimalesConHistorial() {
    if (!dbInstancia) return;
    const query = document.getElementById("input-busqueda").value.trim().toUpperCase();
    const pizarra = document.getElementById("resultados-busqueda-lista");
    if (!pizarra) return;
    pizarra.innerHTML = "";

    if (query === "") return;

    const tx = dbInstancia.transaction(["animales", "sanidad", "reproduccion", "finanzas"], "readonly");
    
    let datasetSanidad = [];
    let datasetRepro = [];
    let datasetFinanzas = [];

    tx.objectStore("sanidad").getAll().onsuccess = (e) => datasetSanidad = e.target.result;
    tx.objectStore("reproduccion").getAll().onsuccess = (e) => datasetRepro = e.target.result;
    tx.objectStore("finanzas").getAll().onsuccess = (e) => datasetFinanzas = e.target.result;

    tx.objectStore("animales").getAll().onsuccess = (e) => {
        const todos = e.target.result;
        const filtrados = todos.filter(a => a.caravana.includes(query));

        filtrados.forEach(animal => {
            const subSanidad = datasetSanidad.filter(s => s.caravana === animal.caravana);
            const subRepro = datasetRepro.filter(r => r.caravana === animal.caravana);
            const subFinanzas = datasetFinanzas.filter(f => f.caravana === animal.caravana);
            
            const div = document.createElement("div");
            div.className = "item-ganado";
            
            const renderingFoto = animal.foto 
                ? `<img src="${animal.foto}" class="miniatura-campo" onclick="ampliarVisualizacionFoto('${animal.foto}')">`
                : `<div class="miniatura-campo" style="background:#131813; display:flex; align-items:center; justify-content:center;"><i class="fa-solid fa-cow" style="color:#212e21"></i></div>`;

            // --- SECCIÓN DE ALERTAS VISUALES EN PANTALLA ---
            let marcasAlertasHtml = "";
            const hoyIso = fechaLocalISO();
            
            subSanidad.forEach(s => {
                if(s.refuerzo && s.refuerzo >= hoyIso) {
                    marcasAlertasHtml += `<div class="indicador-alerta"><i class="fa-solid fa-bell"></i> Refuerzo clínico: ${s.medicamento} programado para el ${s.refuerzo}</div>`;
                }
            });

            subRepro.forEach(r => {
                if(r.estado === "Confirmada" && r.fpp) {
                    marcasAlertasHtml += `<div class="indicador-alerta" style="border-color:var(--verde-primario); color:var(--verde-primario); background:none;"><i class="fa-solid fa-calendar-check"></i> FPP Estimada: ${r.fpp}</div>`;
                }
            });
            // --- PROCESAMIENTO PREVIO DE HISTORIALES CON CONTROLADORES DE BORRADO ---
                        // --- PROCESAMIENTO PREVIO DE HISTORIALES CON CONTROLADORES DE BORRADO ---
                       // --- PROCESAMIENTO DE HISTORIALES CON BOTONES OFFLINE NATIVOS ---
            let htmlSanidad = "";
            subSanidad.forEach(s => {
                const refuerzoTexto = s.refuerzo ? ` | Ref.: ${s.refuerzo}` : '';
                htmlSanidad += `
                    <div class="subitem-historial">
                        <span>[Sanidad] ${s.fecha} - ${s.medicamento}${refuerzoTexto}</span>
                        <button class="btn-borrar-historial-nativo" onclick="eliminarSubHistorialGenerico('sanidad', ${s.id})">Borrar</button>
                    </div>`;
            });

            let htmlRepro = "";
            subRepro.forEach(r => {
                const fppTexto = r.fpp ? ` | FPP: ${r.fpp}` : '';
                htmlRepro += `
                    <div class="subitem-historial" style="border-left-color: #ec4899;">
                        <span>[Preñez] ${r.fecha} - ${r.tipo} | Estado: <strong>${r.estado}</strong>${fppTexto}</span>
                        <button class="btn-borrar-historial-nativo" onclick="eliminarSubHistorialGenerico('reproduccion', ${r.id})">Borrar</button>
                    </div>`;
            });

            let htmlFinanzas = "";
            subFinanzas.forEach(f => {
                htmlFinanzas += `
                    <div class="subitem-historial" style="border-left-color: var(--amarillo-alerta);">
                        <span>[Finanzas] ${f.fecha} - Operación: <strong>${f.tipo}</strong> | Monto: $${f.monto.toFixed(2)}</span>
                        <button class="btn-borrar-historial-nativo" onclick="eliminarSubHistorialGenerico('finanzas', ${f.id})">Borrar</button>
                    </div>`;
            });


            // Si todos los historiales están vacíos, mostrar un aviso limpio
            const historialVacio = !htmlSanidad && !htmlRepro && !htmlFinanzas 
                ? '<div style="color:var(--texto-gris); font-size:0.85rem; padding:4px;">Sin registros en otros módulos.</div>' 
                : '';

            // --- INYECCIÓN FINAL DE LA TARJETA ---
            div.innerHTML = `
                <div style="display:flex; gap:12px; align-items:center;">
                    ${renderingFoto}
                    <div>
                        <h3 style="color:var(--verde-primario)">Cva: ${animal.caravana}</h3>
                        <p style="font-size:0.85rem; color:var(--texto-gris)">Categoría: <strong style="color:white">${animal.categoria}</strong></p>
                    </div>
                </div>
                
                <div class="contenedor-metadatos">
                    <div><strong>Linaje:</strong> M:${animal.madre || '-'} / P:${animal.padre || '-'}</div>
                    <div><strong>Peso Registrado:</strong> ${animal.peso} Kg</div>
                    <div><strong>Nacimiento:</strong> ${animal.nacimiento || '-'}</div>
                    <div><strong>Parición:</strong> ${animal.paricion || '-'}</div>
                </div>
                
                ${marcasAlertasHtml}
                
                <div style="margin-top:6px; font-size:0.8rem; color:var(--texto-gris)">
                    <strong>Notas:</strong> ${animal.observaciones || 'Sin anotaciones'}
                </div>
                
                <div style="margin-top:10px;">
                    <span style="font-size:0.75rem; font-weight:bold; color:var(--azul-caja)">Historial Clínico y Reproductivo:</span>
                    <div class="bandeja-historial">
                        ${historialVacio}
                        ${htmlSanidad}
                        ${htmlRepro}
                        ${htmlFinanzas}
                    </div>
                </div>

                <div class="controles-accion">
                    <button class="btn-accion btn-act" onclick="inyectarDatosEnFormularioEdicion('${animal.caravana}')"><i class="fa-solid fa-pencil"></i> Editar</button>
                    <button class="btn-accion btn-eli" onclick="eliminarRegistroFisicoGanado('${animal.caravana}')"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
                </div>
            `;
            pizarra.appendChild(div);
        });
    };
}

// 5. PREPARA Y TRASLADA LOS DATOS AL FORMULARIO DE EDICIÓN DE FORMA BLINDADA
function inyectarDatosEnFormularioEdicion(caravana) {
    const tx = dbInstancia.transaction("animales", "readonly");
    tx.objectStore("animales").get(caravana).onsuccess = (e) => {
        const a = e.target.result;
        if(!a) return;

        document.getElementById("edit-id").value = a.caravana;
        document.getElementById("caravana").value = a.caravana;
        document.getElementById("caravana").disabled = true; // Congela la caja de texto para blindar la llave primaria en edición
        document.getElementById("categoria-select").value = a.categoria;
        document.getElementById("peso").value = a.peso;
        document.getElementById("madre").value = a.madre;
        document.getElementById("padre").value = a.padre;
        document.getElementById("f-nacimiento").value = a.nacimiento;
        document.getElementById("f-paricion").value = a.paricion;
        document.getElementById("observaciones").value = a.observaciones;

        document.getElementById("btn-guardar-animal").innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> Actualizar Ficha';
        
        // Redirección ergonómica a la pestaña de carga
        if (typeof rutearFocoModulo === "function") rutearFocoModulo('mod-animales');
        if (typeof emitirNotificacionToast === "function") {
            emitirNotificacionToast("Ficha copiada. Modifique los campos necesarios.", "exito");
        }
    };
}

// 6. CONTROLADOR DEL MODAL DE FOTO EN PANTALLA COMPLETA
function ampliarVisualizacionFoto(src) {
    const modal = document.getElementById("modal-imagen");
    const imgModal = document.getElementById("img-fullscreen-target");
    if (modal && imgModal) {
        imgModal.src = src;
        modal.style.display = "flex";
    }
}

// 7. PURGA INDIVIDUOS DE LA BASE DE DATOS
function eliminarRegistroFisicoGanado(caravana) {
    if(confirm(`¿Está seguro que desea eliminar la caravana ${caravana}? La operación es permanente.`)) {
        const tx = dbInstancia.transaction("animales", "readwrite");
        tx.objectStore("animales").delete(caravana).onsuccess = () => {
            if (typeof emitirNotificacionToast === "function") {
                emitirNotificacionToast("Registro purgado con éxito.", "exito");
            }
            filtrarYMostrarAnimalesConHistorial();
            ejecutarCalculosDashboardStock();
        };
    }
}
