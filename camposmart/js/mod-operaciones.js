// --- MÓDULOS 3, 4, 5 Y 6: CONTROL CLÍNICO, REPRODUCCIÓN Y FINANZAS (MOD-OPERACIONES.JS) ---

// ==========================================================
// MÓDULO 3: SANIDAD Y ALERTAS PROGRAMADAS
// ==========================================================
document.getElementById("form-sanidad").addEventListener("submit", function(e) {
    e.preventDefault();
    const caravana = document.getElementById("san-caravana").value.trim().toUpperCase();
    
    // Verificación relacional defensiva: impide imputar tratamientos a animales inexistentes
    const txValidar = dbInstancia.transaction("animales", "readonly");
    txValidar.objectStore("animales").get(caravana).onsuccess = (ev) => {
        if(!ev.target.result) {
            if (typeof emitirNotificacionToast === "function") {
                emitirNotificacionToast("Error: La caravana indicada no se encuentra registrada.", "error");
            }
            return;
        }

        // Armado del objeto clínico sanitario
        const dataSanidad = {
            caravana: caravana,
            medicamento: document.getElementById("san-medicamento").value.trim(),
            dosis: document.getElementById("san-dosis").value.trim(),
            fecha: document.getElementById("san-fecha").value,
            refuerzo: document.getElementById("san-refuerzo").value
        };

        // Inserción transaccional atómica en el almacén clínico
        const txInsertar = dbInstancia.transaction("sanidad", "readwrite");
        txInsertar.objectStore("sanidad").add(dataSanidad).onsuccess = () => {
            if (typeof emitirNotificacionToast === "function") {
                emitirNotificacionToast("Evento clínico/vacunación guardado con éxito.", "exito");
            }
            document.getElementById("form-sanidad").reset();
            
            // Forzar fecha de hoy por defecto tras el reseteo
            const hoy = fechaLocalISO();
            document.getElementById("san-fecha").value = hoy;
        };
    };
});

// ==========================================================
// MÓDULO 4: GESTIÓN DE PREÑEZ Y PARTO (CÁLCULO AUTOMÁTICO)
// ==========================================================

// Algoritmo Cronológico Veterinario Avanzado: Suma exactamente 283 días de gestación bovina
function calcularPartoBovinoEstimado() {
    const fServicio = document.getElementById("rep-fecha").value;
    const estado = document.getElementById("rep-estado").value;
    const displayFPP = document.getElementById("rep-fpp");

    if (!displayFPP) return;

    if(fServicio && estado === "Confirmada") {
        // Corrección de huso horario local mediante inicialización explícita
        const conversionFecha = new Date(fServicio + "T00:00:00");
        conversionFecha.setDate(conversionFecha.getDate() + 283); 
        
        const yyyy = conversionFecha.getFullYear();
        const mm = String(conversionFecha.getMonth() + 1).padStart(2, '0');
        const dd = String(conversionFecha.getDate()).padStart(2, '0');
        
        displayFPP.value = `${yyyy}-${mm}-${dd}`;
    } else {
        displayFPP.value = "No aplica / Pendiente";
    }
}

// Guardar el registro reproductivo en la base de datos local
document.getElementById("form-repro").addEventListener("submit", function(e) {
    e.preventDefault();
    const caravana = document.getElementById("rep-caravana").value.trim().toUpperCase();

    // Verificación relacional: El animal hembra debe existir para registrar servicios
    const txValidar = dbInstancia.transaction("animales", "readonly");
    txValidar.objectStore("animales").get(caravana).onsuccess = (ev) => {
        if(!ev.target.result) {
            if (typeof emitirNotificacionToast === "function") {
                emitirNotificacionToast("Error: La caravana hembra no existe en el sistema.", "error");
            }
            return;
        }

        const dataRepro = {
            caravana: caravana,
            tipo: document.getElementById("rep-tipo").value,
            fecha: document.getElementById("rep-fecha").value,
            estado: document.getElementById("rep-estado").value,
            fpp: document.getElementById("rep-estado").value === "Confirmada" ? document.getElementById("rep-fpp").value : ""
        };

        const txInsertar = dbInstancia.transaction("reproduccion", "readwrite");
        txInsertar.objectStore("reproduccion").add(dataRepro).onsuccess = () => {
            if (typeof emitirNotificacionToast === "function") {
                emitirNotificacionToast("Historial de cría/reproducción guardado.", "exito");
            }
            document.getElementById("form-repro").reset();
            document.getElementById("rep-fpp").value = "";
            
            // Forzar fecha de hoy por defecto tras el reseteo
            const hoy = fechaLocalISO();
            document.getElementById("rep-fecha").value = hoy;
        };
    };
});

// ==========================================================
// MÓDULOS 5 Y 6: CONTROL DE CAJA COMERCIAL (COMPRAS Y VENTAS)
// ==========================================================
document.getElementById("form-finanzas").addEventListener("submit", function(e) {
    e.preventDefault();
    const caravana = document.getElementById("fin-caravana").value.trim().toUpperCase();
    const tipoOp = document.getElementById("fin-tipo").value;

    const txValidar = dbInstancia.transaction("animales", "readonly");
    txValidar.objectStore("animales").get(caravana).onsuccess = (ev) => {
        // Bloqueo defensivo: No se puede vender un animal que no está físicamente registrado
        if(!ev.target.result && tipoOp === "Venta") {
            if (typeof emitirNotificacionToast === "function") {
                emitirNotificacionToast("Error de negocio: No se puede liquidar una caravana inexistente.", "error");
            }
            return;
        }

        const dataFinanciera = {
            tipo: tipoOp,
            caravana: caravana,
            fecha: document.getElementById("fin-fecha").value,
            monto: parseFloat(document.getElementById("fin-monto").value) || 0
        };

        const txInsertar = dbInstancia.transaction("finanzas", "readwrite");
        txInsertar.objectStore("finanzas").add(dataFinanciera).onsuccess = () => {
            // BAJA AUTOMÁTICA EN CASO DE VENTA: Si el animal se vende, se purga de raíz su stock físico
            if(tipoOp === "Venta") {
                const txBaja = dbInstancia.transaction("animales", "readwrite");
                txBaja.objectStore("animales").delete(caravana);
            }
            
            if (typeof emitirNotificacionToast === "function") {
                emitirNotificacionToast("Operación comercial consolidada en caja.", "exito");
            }
            document.getElementById("form-finanzas").reset();
            
            // Forzar fecha de hoy por defecto tras el reseteo
            const hoy = fechaLocalISO();
            document.getElementById("fin-fecha").value = hoy;
            
            // Actualizar métricas del dashboard
            if (typeof ejecutarCalculosDashboardStock === "function") ejecutarCalculosDashboardStock();
        };
    };
});

// ==========================================================
// FUNCIÓN COMODÍN: ELIMINAR EVENTOS ESPECÍFICOS DE HISTORIAL
// ==========================================================
function eliminarSubHistorialGenerico(almacen, idRegistro) {
    const nombresTraducidos = { 
        'reproduccion': 'el registro de preñez', 
        'sanidad': 'el registro sanitario',
        'finanzas': 'la transacción financiera'
    };
    
    if (confirm(`¿Estás seguro de que deseas eliminar ${nombresTraducidos[almacen] || 'este registro'}?`)) {
        const tx = dbInstancia.transaction(almacen, "readwrite");
        const store = tx.objectStore(almacen);
        
        store.delete(idRegistro).onsuccess = () => {
            if (typeof emitirNotificacionToast === "function") {
                emitirNotificacionToast("Registro removido del historial.", "exito");
            }
            // Refresca el buscador automáticamente para aplicar el cambio en pantalla
            if (typeof filtrarYMostrarAnimalesConHistorial === "function") {
                filtrarYMostrarAnimalesConHistorial();
            }
            // Refresca el dashboard por si se eliminó una venta (que devuelve el animal al stock)
            if (typeof ejecutarCalculosDashboardStock === "function") {
                ejecutarCalculosDashboardStock();
            }
        };
    }
}
