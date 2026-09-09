const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

let db = loadDb();
let selectedEtq = new Set();
let pendingFoto = null;
let pendingCopia = null;
let quitarSenalFoto = false;
let quitarSenalCopia = false;

const TITLES = {
  dashboard: "Inicio",
  articulos: "Artículos / Inventario",
  productos: "Catálogo de Productos",
  proveedores: "Proveedores",
  etiquetas: "Etiquetas con Código de Barras",
  depreciacion: "Depreciación",
  reportes: "Reportes"
};

const fmtMoney = n => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(n || 0);
const fmtDate = iso => iso ? new Date(iso + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function toast(msg, type = "ok") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast " + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 2600);
}

function nextId(list) {
  return list.reduce((m, x) => Math.max(m, x.id), 0) + 1;
}

function fillSelect(sel, values, keepFirst) {
  const first = keepFirst ? sel.options[0].outerHTML : "";
  sel.innerHTML = first + values.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
}

function proveedorNombre(id) {
  const p = db.proveedores.find(x => x.id === id);
  return p ? p.nombre : "";
}

function badgeEstado(estado) {
  const cls = { Activo: "activo", Baja: "baja", Mantenimiento: "mantenimiento" }[estado] || "activo";
  return `<span class="badge ${cls}">${esc(estado)}</span>`;
}

function mesesDesde(iso) {
  if (!iso) return 0;
  const f1 = new Date(iso + "T00:00:00");
  const f2 = new Date();
  let m = (f2.getFullYear() - f1.getFullYear()) * 12 + (f2.getMonth() - f1.getMonth());
  if (f2.getDate() < f1.getDate()) m -= 1;
  return Math.max(0, m);
}

function depRecta(a) {
  const depreciable = Math.max(0, (a.costo || 0) - (a.valorResidual || 0));
  const anual = a.vidaUtil > 0 ? depreciable / a.vidaUtil : 0;
  const mensual = anual / 12;
  const acumulada = Math.min(mensual * mesesDesde(a.fechaAdquisicion), depreciable);
  return { anual, mensual, acumulada, libro: (a.costo || 0) - acumulada };
}

function activateView(name) {
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
  $$(".view").forEach(v => v.classList.toggle("hidden", v.id !== "view-" + name));
  $("#pageTitle").textContent = TITLES[name] || "";
  if (name === "dashboard") renderDashboard();
  if (name === "articulos") renderArticulos();
  if (name === "productos") renderProductos();
  if (name === "proveedores") renderProveedores();
  if (name === "etiquetas") renderListaEtiquetas();
  if (name === "depreciacion") renderTablaDep();
  if (name === "reportes") renderReporte();
}

function renderDashboard() {
  const activos = db.articulos.filter(a => a.estado === "Activo");
  const valorOriginal = activos.reduce((s, a) => s + (a.costo || 0), 0);
  const acum = activos.reduce((s, a) => s + depRecta(a).acumulada, 0);

  $("#statTotalActivos").textContent = activos.length;
  $("#statValorOriginal").textContent = fmtMoney(valorOriginal);
  $("#statDepAcumulada").textContent = fmtMoney(acum);
  $("#statValorLibros").textContent = fmtMoney(valorOriginal - acum);

  $("#tblRecientes").innerHTML = [...db.articulos]
    .sort((x, y) => (y.fechaAdquisicion || "").localeCompare(x.fechaAdquisicion || ""))
    .slice(0, 5)
    .map(a => `<tr><td><strong>${esc(a.clave)}</strong></td><td>${esc(a.nombre)}</td><td>${esc(a.categoria)}</td><td>${fmtMoney(a.costo)}</td><td>${fmtDate(a.fechaAdquisicion)}</td></tr>`)
    .join("") || `<tr><td colspan="5" class="empty-msg">Sin artículos registrados.</td></tr>`;

  const porCat = {};
  activos.forEach(a => { porCat[a.categoria] = (porCat[a.categoria] || 0) + (a.costo || 0); });
  const max = Math.max(1, ...Object.values(porCat));
  $("#barsCategorias").innerHTML = Object.entries(porCat)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => `
      <div class="bar-row">
        <span>${esc(cat)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(val / max * 100)}%"></div></div>
        <span class="bar-amt">${fmtMoney(val)}</span>
      </div>`)
    .join("") || `<p class="empty-msg">Sin datos para mostrar.</p>`;
}

function renderArticulos() {
  const q = ($("#fBuscarArt").value || "").toLowerCase().trim();
  const est = $("#fEstadoArt").value;
  const cat = $("#fCatArt").value;

  const rows = db.articulos.filter(a =>
    (!est || a.estado === est) &&
    (!cat || a.categoria === cat) &&
    (!q || [a.clave, a.nombre, a.serie, a.marca, a.ubicacion, a.factura].some(v => String(v || "").toLowerCase().includes(q)))
  );

  $("#tbodyArticulos").innerHTML = rows.map(a => {
    const d = depRecta(a);
    return `
    <tr class="${a.estado === 'Baja' ? 'row-baja' : ''}">
      <td><strong>${esc(a.clave)}</strong></td>
      <td>${esc(a.nombre)}<br><small class="cell-sub">${esc(a.ubicacion) || ""}</small></td>
      <td>${esc(a.categoria)}</td>
      <td>${esc(a.serie) || "—"}</td>
      <td>${esc(a.factura) || "—"}</td>
      <td>
        <button type="button" class="doc-txt ${a.foto ? "ok" : "missing"}" data-ver-adjunto="foto" data-id="${a.id}" title="${a.foto ? "Ver foto del producto" : "Sin foto cargada"}">${a.foto ? "Foto" : "Sin foto"}</button><br>
        <button type="button" class="doc-txt ${a.copiaArchivo ? "ok" : "missing"}" data-ver-adjunto="copia" data-id="${a.id}" title="${a.copiaArchivo ? "Ver copia de factura" : "Sin copia de factura"}">${a.copiaArchivo ? "Factura" : "Sin factura"}</button>
      </td>
      <td>${fmtDate(a.fechaAdquisicion)}</td>
      <td>${fmtMoney(a.costo)}</td>
      <td>${badgeEstado(a.estado)}</td>
      <td class="no-print">
        <div class="cell-actions">
          <button class="btn ghost detail-sm" data-action="detalle-articulo" data-id="${a.id}" title="Ver detalle completo">Ver</button>
          ${a.estado !== "Baja" ? `<button class="btn edit-sm" data-action="edit-articulo" data-id="${a.id}">Editar</button>` : ""}
          ${a.estado !== "Baja" ? `<button class="btn danger-sm" data-action="baja-articulo" data-id="${a.id}">Baja</button>` : ""}
        </div>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="10" class="empty-msg">No se encontraron artículos.</td></tr>`;

  $("#cntArticulos").textContent = `${rows.length} artículo(s) · ${db.articulos.length} en total`;
}

function openModalArticulo(id) {
  const form = $("#formArticulo");
  form.reset();
  pendingFoto = null;
  pendingCopia = null;
  quitarSenalFoto = false;
  quitarSenalCopia = false;
  fillSelect($("#artCategoria"), CATEGORIAS);
  fillSelect($("#artEstado"), ESTADOS);
  const provOpts = ["<option value=''>-- Sin proveedor --</option>"]
    .concat(db.proveedores.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`));
  $("#artProveedor").innerHTML = provOpts.join("");

  if (id) {
    const a = db.articulos.find(x => x.id === id);
    if (!a) return;
    $("#tituloModalArt").textContent = "Editar artículo";
    $("#artId").value = a.id;
    $("#artClave").value = a.clave;
    $("#artNombre").value = a.nombre;
    $("#artCategoria").value = a.categoria;
    $("#artEstado").value = a.estado;
    $("#artUbicacion").value = a.ubicacion || "";
    $("#artMarca").value = a.marca || "";
    $("#artModelo").value = a.modelo || "";
    $("#artSerie").value = a.serie || "";
    $("#artFecha").value = a.fechaAdquisicion || "";
    $("#artCosto").value = a.costo;
    $("#artVida").value = a.vidaUtil || 10;
    $("#artResidual").value = a.valorResidual || 0;
    $("#artProveedor").value = a.proveedorId || "";
    $("#artFactura").value = a.factura || "";
    setPreview("foto", a.foto || null, a.fotoDatos || null);
    setPreview("copia", a.copiaArchivo || null, a.copiaDatos || null);
  } else {
    $("#tituloModalArt").textContent = "Nuevo artículo";
    $("#artId").value = "";
    $("#artClave").value = `AF-${String(db.seqArticulo).padStart(4, "0")}`;
    $("#artFecha").valueAsDate = new Date();
    $("#artFactura").value = "";
    setPreview("foto", null, null);
    setPreview("copia", null, null);
  }
  $("#modalArticulo").classList.remove("hidden");
  if (!id) $("#artSerie").focus();
}

function renderDetalleArticulo(id) {
  const a = db.articulos.find(x => x.id === id);
  if (!a) return;
  $("#detalleTitulo").textContent = `Detalle de ${a.clave}`;

  const fotoHtml = a.foto && a.fotoDatos
    ? `<div class="detalle-foto-area"><img src="${esc(a.fotoDatos)}" alt="${esc(a.foto)}" class="detalle-img"><button type="button" class="btn edit-sm" data-ver-adjunto="foto" data-id="${a.id}">Ver foto completa</button></div>`
    : `<div class="detalle-foto-area"><span class="sin-foto">Sin foto del producto</span></div>`;

  const copiaHtml = a.copiaArchivo && a.copiaDatos
    ? `<button type="button" class="btn edit-sm" data-ver-adjunto="copia" data-id="${a.id}">Ver copia de factura</button>`
    : `<span class="sin-foto">Sin copia de factura</span>`;

  $("#detalleContenido").innerHTML = `
    <div class="detalle-item">
      <dt>Clave / No. inventario</dt>
      <dd><strong>${esc(a.clave)}</strong></dd>
    </div>
    <div class="detalle-item">
      <dt>Estado</dt>
      <dd>${badgeEstado(a.estado)}</dd>
    </div>
    <div class="detalle-item span2">
      <dt>Nombre del bien</dt>
      <dd>${esc(a.nombre)}</dd>
    </div>
    <div class="detalle-item"><dt>Categoría</dt><dd>${esc(a.categoria)}</dd></div>
    <div class="detalle-item"><dt>Ubicación</dt><dd>${esc(a.ubicacion) || "—"}</dd></div>
    <div class="detalle-item"><dt>Marca</dt><dd>${esc(a.marca) || "—"}</dd></div>
    <div class="detalle-item"><dt>Modelo</dt><dd>${esc(a.modelo) || "—"}</dd></div>
    <div class="detalle-item"><dt>No. de serie</dt><dd>${esc(a.serie) || "—"}</dd></div>
    <div class="detalle-item"><dt>Fecha de adquisición</dt><dd>${fmtDate(a.fechaAdquisicion)}</dd></div>
    <div class="detalle-item"><dt>Costo</dt><dd>${fmtMoney(a.costo)}</dd></div>
    <div class="detalle-item"><dt>Vida útil</dt><dd>${a.vidaUtil} años</dd></div>
    <div class="detalle-item"><dt>Valor residual</dt><dd>${fmtMoney(a.valorResidual)}</dd></div>
    <div class="detalle-item"><dt>Proveedor</dt><dd>${esc(proveedorNombre(a.proveedorId)) || "—"}</dd></div>
    <div class="detalle-item"><dt>Folio de factura</dt><dd>${esc(a.factura) || "—"}</dd></div>
    <div class="detalle-item span2"><dt>Copia de factura</dt><dd>${copiaHtml}</dd></div>
    ${fotoHtml}
  `;

  if (a.estado === "Baja") {
    $("#detalleAcciones").innerHTML = `<p class="sin-foto">Este artículo ya está dado de baja.</p>`;
  } else {
    $("#detalleAcciones").innerHTML = `
      <button type="button" class="btn danger" data-action="baja-articulo" data-id="${a.id}">Dar de baja este artículo</button>`;
  }
  $("#modalDetalleArt").classList.remove("hidden");
}

function isPdf(nombre) {
  return /\.pdf$/i.test(nombre || "");
}

function setPreview(tipo, nombre, datos) {
  const hay = !!(nombre && datos);
  if (tipo === "foto") {
    const img = $("#imgFoto");
    $("#emptyFoto").style.display = hay ? "none" : "";
    $("#btnQuitarFoto").style.display = hay ? "" : "none";
    if (hay && !isPdf(nombre)) {
      img.src = datos;
      img.classList.remove("preview-hide");
    } else {
      img.src = "";
      img.classList.add("preview-hide");
    }
    const tieneFile = $("#artFoto").files && $("#artFoto").files.length > 0;
    if (hay && !tieneFile) $("#artFoto").value = "";
  } else {
    $("#emptyCopia").style.display = hay ? "none" : "";
    $("#btnQuitarCopia").style.display = hay ? "" : "none";
    const nameEl = $("#copiaName");
    if (hay) {
      nameEl.textContent = nombre;
      nameEl.classList.remove("preview-hide");
    } else {
      nameEl.textContent = "";
      nameEl.classList.add("preview-hide");
    }
  }
}

function quitarAdjunto(tipo) {
  if (tipo === "foto") {
    $("#artFoto").value = "";
    pendingFoto = null;
    quitarSenalFoto = true;
    setPreview("foto", null, null);
  } else {
    $("#artCopia").value = "";
    pendingCopia = null;
    quitarSenalCopia = true;
    setPreview("copia", null, null);
  }
}

function guardarOrigenAdjunto(tipo) {
  if (tipo === "foto") {
    pendingFoto = {
      nombre: $("#artFoto").files[0].name,
      datos: null
    };
  } else {
    pendingCopia = {
      nombre: $("#artCopia").files[0].name,
      datos: null
    };
  }
}

function leerArchivo(input, tipo) {
  const file = input.files && input.files[0];
  if (!file) return;
  const maxBytes = 1.5 * 1024 * 1024;
  if (file.size > maxBytes) {
    toast("El archivo supera 1.5 MB; sube uno más pequeño.", "err");
    input.value = "";
    return;
  }
  const isImg = file.type.startsWith("image/");
  const isPdfFile = /\.pdf$/i.test(file.name);
  if (tipo === "copia" && !(isImg || isPdfFile)) {
    toast("La copia debe ser una imagen o un PDF.", "err");
    input.value = "";
    return;
  }
  if (tipo === "foto" && !isImg) {
    toast("La foto debe ser una imagen.", "err");
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    setPreview(tipo, file.name, ev.target.result);
    if (tipo === "foto") {
      pendingFoto = { nombre: file.name, datos: ev.target.result };
    } else {
      pendingCopia = { nombre: file.name, datos: ev.target.result };
    }
  };
  reader.readAsDataURL(file);
}

function saveArticulo(e) {
  e.preventDefault();
  const idVal = $("#artId").value;

  const prev = idVal ? db.articulos.find(x => x.id == idVal) : null;

  let foto = null, fotoDatos = null, copia = null, copiaDatos = null;

  if (pendingFoto) {
    foto = pendingFoto.nombre;
    fotoDatos = pendingFoto.datos;
  } else if (prev && prev.foto && !quitarSenalFoto) {
    foto = prev.foto;
    fotoDatos = prev.fotoDatos || null;
  }

  if (pendingCopia) {
    copia = pendingCopia.nombre;
    copiaDatos = pendingCopia.datos;
  } else if (prev && prev.copiaArchivo && !quitarSenalCopia) {
    copia = prev.copiaArchivo;
    copiaDatos = prev.copiaDatos || null;
  }

  const datos = {
    clave: $("#artClave").value.trim(),
    nombre: $("#artNombre").value.trim(),
    categoria: $("#artCategoria").value,
    estado: $("#artEstado").value,
    ubicacion: $("#artUbicacion").value.trim(),
    marca: $("#artMarca").value.trim(),
    modelo: $("#artModelo").value.trim(),
    serie: $("#artSerie").value.trim(),
    fechaAdquisicion: $("#artFecha").value,
    costo: parseFloat($("#artCosto").value) || 0,
    vidaUtil: parseInt($("#artVida").value) || 10,
    valorResidual: parseFloat($("#artResidual").value) || 0,
    proveedorId: $("#artProveedor").value ? parseInt($("#artProveedor").value) : null,
    factura: $("#artFactura").value.trim(),
    foto, fotoDatos, copiaArchivo: copia, copiaDatos
  };

  const dup = db.articulos.find(a => a.clave.toLowerCase() === datos.clave.toLowerCase() && String(a.id) !== idVal);
  if (dup) { toast("Ya existe un artículo con esa clave.", "err"); return; }

  if (idVal) {
    const a = db.articulos.find(x => x.id == idVal);
    Object.assign(a, datos);
    toast("Artículo actualizado correctamente.");
  } else {
    db.articulos.push({ id: nextId(db.articulos), ...datos });
    db.seqArticulo++;
    toast("Artículo dado de alta correctamente.");
  }
  saveDb(db);
  $("#modalArticulo").classList.add("hidden");
  renderArticulos();
}

function bajaArticulo(id) {
  const a = db.articulos.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`¿Dar de BAJA el artículo "${a.clave} - ${a.nombre}"?\n\nEl registro se conservará con estado Baja.`)) return;
  a.estado = "Baja";
  saveDb(db);
  renderArticulos();
  $("#modalDetalleArt").classList.add("hidden");
  toast(`Artículo ${a.clave} dado de baja.`);
}

function renderProductos() {
  const q = ($("#fBuscarProd").value || "").toLowerCase().trim();
  const rows = db.productos.filter(p =>
    !q || [p.codigo, p.nombre, p.categoria].some(v => String(v || "").toLowerCase().includes(q))
  );
  $("#tbodyProductos").innerHTML = rows.map(p => `
    <tr>
      <td><strong>${esc(p.codigo)}</strong></td>
      <td>${esc(p.nombre)}</td>
      <td>${esc(p.categoria)}</td>
      <td>${esc(p.unidad)}</td>
      <td>${fmtMoney(p.precioReferencia)}</td>
      <td class="no-print">
        <div class="cell-actions">
          <button class="btn edit-sm" data-action="edit-producto" data-id="${p.id}">Editar</button>
          <button class="btn danger-sm" data-action="del-producto" data-id="${p.id}">Eliminar</button>
        </div>
      </td>
    </tr>`).join("") || `<tr><td colspan="6" class="empty-msg">No hay productos en el catálogo.</td></tr>`;
}

function openModalProducto(id) {
  $("#formProducto").reset();
  fillSelect($("#prodCategoria"), CATEGORIAS);
  fillSelect($("#prodUnidad"), UNIDADES);
  if (id) {
    const p = db.productos.find(x => x.id === id);
    if (!p) return;
    $("#tituloModalProd").textContent = "Editar producto";
    $("#prodId").value = p.id;
    $("#prodCodigo").value = p.codigo;
    $("#prodNombre").value = p.nombre;
    $("#prodCategoria").value = p.categoria;
    $("#prodUnidad").value = p.unidad;
    $("#prodPrecio").value = p.precioReferencia;
  } else {
    $("#tituloModalProd").textContent = "Nuevo producto";
    $("#prodId").value = "";
    $("#prodCodigo").value = `PRD-${String(db.seqProducto).padStart(4, "0")}`;
  }
  $("#modalProducto").classList.remove("hidden");
}

function saveProducto(e) {
  e.preventDefault();
  const idVal = $("#prodId").value;
  const datos = {
    codigo: $("#prodCodigo").value.trim(),
    nombre: $("#prodNombre").value.trim(),
    categoria: $("#prodCategoria").value,
    unidad: $("#prodUnidad").value,
    precioReferencia: parseFloat($("#prodPrecio").value) || 0
  };
  if (idVal) {
    const p = db.productos.find(x => x.id == idVal);
    Object.assign(p, datos);
    toast("Producto actualizado.");
  } else {
    db.productos.push({ id: nextId(db.productos), ...datos });
    db.seqProducto++;
    toast("Producto agregado al catálogo.");
  }
  saveDb(db);
  $("#modalProducto").classList.add("hidden");
  renderProductos();
}

function delProducto(id) {
  const p = db.productos.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar el producto "${p.codigo} - ${p.nombre}" del catálogo?`)) return;
  db.productos = db.productos.filter(x => x.id !== id);
  saveDb(db);
  renderProductos();
  toast("Producto eliminado.");
}

function renderProveedores() {
  const q = ($("#fBuscarProv").value || "").toLowerCase().trim();
  const rows = db.proveedores.filter(p =>
    !q || [p.nombre, p.rfc, p.contacto, p.email].some(v => String(v || "").toLowerCase().includes(q))
  );
  $("#tbodyProveedores").innerHTML = rows.map(p => `
    <tr>
      <td><strong>${esc(p.nombre)}</strong></td>
      <td>${esc(p.rfc)}</td>
      <td>${esc(p.contacto)}</td>
      <td>${esc(p.telefono)}</td>
      <td>${esc(p.email)}</td>
      <td class="no-print">
        <div class="cell-actions">
          <button class="btn edit-sm" data-action="edit-proveedor" data-id="${p.id}">Editar</button>
          <button class="btn danger-sm" data-action="del-proveedor" data-id="${p.id}">Eliminar</button>
        </div>
      </td>
    </tr>`).join("") || `<tr><td colspan="6" class="empty-msg">No hay proveedores registrados.</td></tr>`;
}

function openModalProveedor(id) {
  $("#formProveedor").reset();
  if (id) {
    const p = db.proveedores.find(x => x.id === id);
    if (!p) return;
    $("#tituloModalProv").textContent = "Editar proveedor";
    $("#provId").value = p.id;
    $("#provNombre").value = p.nombre;
    $("#provRFC").value = p.rfc || "";
    $("#provContacto").value = p.contacto || "";
    $("#provTelefono").value = p.telefono || "";
    $("#provEmail").value = p.email || "";
    $("#provDireccion").value = p.direccion || "";
  } else {
    $("#tituloModalProv").textContent = "Nuevo proveedor";
    $("#provId").value = "";
  }
  $("#modalProveedor").classList.remove("hidden");
}

function saveProveedor(e) {
  e.preventDefault();
  const idVal = $("#provId").value;
  const datos = {
    nombre: $("#provNombre").value.trim(),
    rfc: $("#provRFC").value.trim(),
    contacto: $("#provContacto").value.trim(),
    telefono: $("#provTelefono").value.trim(),
    email: $("#provEmail").value.trim(),
    direccion: $("#provDireccion").value.trim()
  };
  if (idVal) {
    const p = db.proveedores.find(x => x.id == idVal);
    Object.assign(p, datos);
    toast("Proveedor actualizado.");
  } else {
    db.proveedores.push({ id: nextId(db.proveedores), ...datos });
    db.seqProveedor++;
    toast("Proveedor registrado.");
  }
  saveDb(db);
  $("#modalProveedor").classList.add("hidden");
  renderProveedores();
}

function delProveedor(id) {
  const p = db.proveedores.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar al proveedor "${p.nombre}"?`)) return;
  db.proveedores = db.proveedores.filter(x => x.id !== id);
  saveDb(db);
  renderProveedores();
  toast("Proveedor eliminado.");
}

function renderListaEtiquetas() {
  const items = db.articulos.filter(a => a.estado !== "Baja");
  selectedEtq.forEach(id => { if (!items.some(a => a.id === id)) selectedEtq.delete(id); });

  $("#listEtiquetas").innerHTML = items.map(a => `
    <label class="etq-item">
      <input type="checkbox" data-etq="${a.id}" ${selectedEtq.has(a.id) ? "checked" : ""}>
      <div>
        <div><strong>${esc(a.clave)}</strong> · ${esc(a.nombre)}</div>
        <small>${esc(a.ubicacion || "Sin ubicación")}</small>
      </div>
    </label>`).join("") || `<p class="empty-msg">No hay artículos disponibles.</p>`;

  updateEtiquetasBtns();
}

function updateEtiquetasBtns() {
  $("#btnGenerarEtq").disabled = selectedEtq.size === 0;
  $("#btnImprimirEtq").disabled = $("#labelsGrid svg") === null && !$("#labelsGrid .label-card");
}

function generarEtiquetas() {
  const items = db.articulos.filter(a => selectedEtq.has(a.id));
  if (!items.length) return;

  $("#labelsGrid").innerHTML = items.map((a, i) => `
    <div class="label-card">
      <div class="label-head">
        <img src="Logo_Footer.png" alt="" class="label-logo">
        <span class="label-school">Sistema de Activo Fijo Escolar</span>
      </div>
      <h4>${esc(a.nombre)}</h4>
      <span class="lc-clave">${esc(a.clave)}</span>
      <span class="lc-meta">${esc(a.categoria)}${a.ubicacion ? " · " + esc(a.ubicacion) : ""}</span>
      <svg id="bc-${i}" data-code="${esc(a.clave)}"></svg>
    </div>`).join("");

  dibujarBarcodes();
  updateEtiquetasBtns();
  toast(`${items.length} etiqueta(s) generada(s).`);
}

function dibujarBarcodes() {
  $$("svg[data-code]").forEach(svg => {
    const code = svg.dataset.code;
    try {
      JsBarcode(svg, code, {
        format: "CODE128",
        width: 1.6,
        height: 40,
        fontSize: 13,
        margin: 4,
        lineColor: "#000"
      });
    } catch (err) {
      svg.setAttribute("viewBox", "0 0 200 50");
      svg.innerHTML = `<rect width="200" height="50" fill="none"/><text x="100" y="30" text-anchor="middle" font-family="monospace" font-size="14">${code}</text>`;
    }
  });
}

function renderTablaDep() {
  const sel = $("#depArticulo");
  const prev = sel.value;
  sel.innerHTML = '<option value="">-- Manual --</option>' +
    db.articulos.filter(a => a.estado !== "Baja")
      .map(a => `<option value="${a.id}">${esc(a.clave)} — ${esc(a.nombre)}</option>`).join("");
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;

  const rows = db.articulos.filter(a => a.estado === "Activo");
  let totalMensual = 0;
  $("#tbodyDepActivos").innerHTML = rows.map(a => {
    const d = depRecta(a);
    totalMensual += d.mensual;
    return `<tr>
      <td><strong>${esc(a.clave)}</strong></td>
      <td>${esc(a.nombre)}</td>
      <td>${fmtMoney(a.costo)}</td>
      <td>${a.vidaUtil} años</td>
      <td>${fmtMoney(a.valorResidual)}</td>
      <td>${fmtMoney(d.mensual)}</td>
      <td>${fmtMoney(d.acumulada)}</td>
      <td>${fmtMoney(d.libro)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="8" class="empty-msg">Sin artículos activos.</td></tr>`;
  $("#totDepMensual").textContent = fmtMoney(totalMensual);
}

function calcularDepreciacion(e) {
  e.preventDefault();
  const costo = parseFloat($("#depCosto").value) || 0;
  const vida = parseInt($("#depVida").value) || 0;
  const residual = parseFloat($("#depResidual").value) || 0;
  const metodo = $("#depMetodo").value;
  const fecha = $("#depFecha").value;

  if (costo <= 0 || vida <= 0) { toast("Captura costo y vida útil válidos.", "err"); return; }
  if (residual >= costo) { toast("El valor residual debe ser menor al costo.", "err"); return; }

  const depreciable = costo - residual;
  let filas = [];
  let resumenAnual = 0, resumenMensual = 0;

  if (metodo === "recta") {
    const anual = depreciable / vida;
    const mensual = anual / 12;
    resumenAnual = anual; resumenMensual = mensual;
    let acum = 0, libro = costo;
    for (let y = 1; y <= vida; y++) {
      acum += anual; libro -= anual;
      filas.push({ anio: y, inicial: libro + anual, gasto: anual, acum, libro: Math.max(libro, residual) });
    }
  } else {
    const tasa = 2 / vida;
    let libro = costo, acum = 0;
    for (let y = 1; y <= vida; y++) {
      let gasto = libro * tasa;
      if (y === vida || libro - gasto <= residual + 0.01) gasto = libro - residual;
      if (gasto <= 0.005) break;
      libro -= gasto; acum += gasto;
      filas.push({ anio: y, inicial: libro + gasto, gasto, acum, libro });
    }
    const primerAnio = filas[0];
    resumenAnual = primerAnio ? primerAnio.gasto : 0;
    resumenMensual = resumenAnual / 12;
  }

  $("#depResumen").innerHTML = `
    <div class="card stat"><p class="stat-label">Base depreciación</p><p class="stat-value" style="font-size:20px">${fmtMoney(depreciable)}</p></div>
    <div class="card stat"><p class="stat-label">Gasto anual</p><p class="stat-value danger" style="font-size:20px">${fmtMoney(resumenAnual)}</p></div>
    <div class="card stat"><p class="stat-label">Gasto mensual</p><p class="stat-value danger" style="font-size:20px">${fmtMoney(resumenMensual)}</p></div>
    <div class="card stat"><p class="stat-label">Valor final (residual)</p><p class="stat-value success" style="font-size:20px">${fmtMoney(residual)}</p></div>`;

  $("#wrapDepCal").innerHTML = `
    <table class="table" style="margin-top:16px">
      <thead><tr><th>Año</th><th>Valor inicial</th><th>Gasto por depreciación</th><th>Dep. acumulada</th><th>Valor en libros</th></tr></thead>
      <tbody>
        ${filas.map(f => `<tr>
          <td>Año ${f.anio}${fecha ? `<br><small style="color:var(--muted)">${new Date(fecha).getFullYear() + f.anio - 1}</small>` : ""}</td>
          <td>${fmtMoney(f.inicial)}</td>
          <td>${fmtMoney(f.gasto)}</td>
          <td>${fmtMoney(f.acum)}</td>
          <td>${fmtMoney(f.libro)}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;

  toast("Cálculo de depreciación generado.");
}

let repFiltrados = [];

function renderReporte() {
  fillSelect($("#repCat"), CATEGORIAS, true);
  fillSelect($("#repEstado"), ESTADOS, true);
  aplicarReporte();
}

function aplicarReporte() {
  const cat = $("#repCat").value;
  const est = $("#repEstado").value;
  const desde = $("#repDesde").value;
  const hasta = $("#repHasta").value;

  repFiltrados = db.articulos.filter(a =>
    (!cat || a.categoria === cat) &&
    (!est || a.estado === est) &&
    (!desde || a.fechaAdquisicion >= desde) &&
    (!hasta || a.fechaAdquisicion <= hasta)
  );

  const valor = repFiltrados.reduce((s, a) => s + a.costo, 0);
  const acum = repFiltrados.reduce((s, a) => s + depRecta(a).acumulada, 0);

  $("#repTotal").textContent = repFiltrados.length;
  $("#repValor").textContent = fmtMoney(valor);
  $("#repAcum").textContent = fmtMoney(acum);
  $("#repLibro").textContent = fmtMoney(valor - acum);

  $("#tbodyReportes").innerHTML = repFiltrados.map(a => {
    const d = depRecta(a);
    return `<tr>
      <td><strong>${esc(a.clave)}</strong></td>
      <td>${esc(a.nombre)}</td>
      <td>${esc(a.categoria)}</td>
      <td>${esc(proveedorNombre(a.proveedorId)) || "—"}</td>
      <td>${esc(a.factura) || "—"}</td>
      <td>${fmtDate(a.fechaAdquisicion)}</td>
      <td>${fmtMoney(a.costo)}</td>
      <td>${fmtMoney(d.acumulada)}</td>
      <td>${fmtMoney(d.libro)}</td>
      <td>${badgeEstado(a.estado)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="10" class="empty-msg">Sin resultados con los filtros aplicados.</td></tr>`;

  $("#cntRep").textContent = `${repFiltrados.length} registro(s)`;
}

function exportarCsv() {
  if (!repFiltrados.length) { toast("No hay datos que exportar.", "err"); return; }
  const head = ["Clave", "Nombre", "Categoria", "Marca", "Modelo", "Serie", "Ubicacion", "Folio factura", "Fecha adquisicion", "Costo", "Vida util (anios)", "Valor residual", "Dep. acumulada", "Valor en libros", "Estado", "Proveedor"];
  const lines = repFiltrados.map(a => {
    const d = depRecta(a);
    return [a.clave, a.nombre, a.categoria, a.marca, a.modelo, a.serie, a.ubicacion, a.factura, a.fechaAdquisicion, a.costo, a.vidaUtil, a.valorResidual, d.acumulada.toFixed(2), d.libro.toFixed(2), a.estado, proveedorNombre(a.proveedorId)]
      .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
  });
  const csv = "\ufeff" + head.join(",") + "\n" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `reporte_activos_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Reporte CSV descargado.");
}

function verAdjunto(articulo, tipo) {
  if (!articulo) return;
  const foto = tipo === "foto";
  const nombre = foto ? articulo.foto : articulo.copiaArchivo;
  const datos = foto ? articulo.fotoDatos : articulo.copiaDatos;
  $("#tituloAdjunto").textContent = foto ? `Foto: ${articulo.clave}` : `Copia de factura: ${articulo.clave}`;

  if (!nombre || !datos) {
    $("#contenidoAdjunto").innerHTML = `<p class="adjunto-missing">Este artículo no tiene ${foto ? "foto" : "copia de factura"} registrada.</p>`;
  } else if (isPdf(nombre)) {
    $("#contenidoAdjunto").innerHTML = `
      <div class="adj-links"><a class="btn ghost" href="${esc(datos)}" target="_blank" rel="noopener">Abrir PDF en nueva pestaña</a></div>
      <iframe src="${esc(datos)}" title="${esc(nombre)}"></iframe>`;
  } else {
    $("#contenidoAdjunto").innerHTML = `
      <div class="adj-links"><a class="btn ghost" href="${esc(datos)}" target="_blank" rel="noopener">Abrir imagen en nueva pestaña</a></div>
      <img src="${esc(datos)}" alt="${esc(nombre)}">`;
  }
  $("#modalVerAdjunto").classList.remove("hidden");
}

document.addEventListener("click", e => {
  const nav = e.target.closest(".nav-item");
  if (nav) { e.preventDefault(); activateView(nav.dataset.view); return; }

  const closeBtn = e.target.closest("[data-close]");
  if (closeBtn) { $(closeBtn.dataset.close).classList.add("hidden"); return; }

  if (e.target.classList.contains("modal-overlay")) { e.target.classList.add("hidden"); return; }

  const verBtn = e.target.closest("[data-ver-adjunto]");
  if (verBtn) {
    const a = db.articulos.find(x => x.id == parseInt(verBtn.dataset.id));
    verAdjunto(a, verBtn.dataset.verAdjunto);
    return;
  }

  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = parseInt(btn.dataset.id);

  switch (btn.dataset.action) {
    case "detalle-articulo": renderDetalleArticulo(id); break;
    case "edit-articulo": openModalArticulo(id); break;
    case "baja-articulo": bajaArticulo(id); break;
    case "edit-producto": openModalProducto(id); break;
    case "del-producto": delProducto(id); break;
    case "edit-proveedor": openModalProveedor(id); break;
    case "del-proveedor": delProveedor(id); break;
  }
});

$("#btnNuevoArt").addEventListener("click", () => openModalArticulo());
$("#formArticulo").addEventListener("submit", saveArticulo);

$("#btnNuevoProd").addEventListener("click", () => openModalProducto());
$("#formProducto").addEventListener("submit", saveProducto);

$("#btnNuevoProv").addEventListener("click", () => openModalProveedor());
$("#formProveedor").addEventListener("submit", saveProveedor);

$("#fBuscarArt").addEventListener("input", renderArticulos);
$("#fBuscarArt").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const valor = e.target.value.trim();
  if (!valor) return;
  const a = db.articulos.find(x => x.clave.toLowerCase() === valor.toLowerCase());
  if (a) {
    e.preventDefault();
    renderDetalleArticulo(a.id);
  }
});
$("#fEstadoArt").addEventListener("change", renderArticulos);
$("#fCatArt").addEventListener("change", renderArticulos);
$("#fBuscarProd").addEventListener("input", renderProductos);
$("#fBuscarProv").addEventListener("input", renderProveedores);

$("#listEtiquetas").addEventListener("change", e => {
  const chk = e.target.closest("[data-etq]");
  if (!chk) return;
  const id = parseInt(chk.dataset.etq);
  if (chk.checked) selectedEtq.add(id); else selectedEtq.delete(id);
  updateEtiquetasBtns();
});

$("#chkTodos").addEventListener("change", e => {
  const checks = $$("#listEtiquetas [data-etq]");
  checks.forEach(c => c.checked = e.target.checked);
  selectedEtq = new Set(checks.filter(c => c.checked).map(c => parseInt(c.dataset.etq)));
  updateEtiquetasBtns();
});

$("#btnGenerarEtq").addEventListener("click", generarEtiquetas);
$("#btnImprimirEtq").addEventListener("click", () => window.print());

$("#formDep").addEventListener("submit", calcularDepreciacion);
$("#depArticulo").addEventListener("change", e => {
  const a = db.articulos.find(x => x.id == e.target.value);
  if (!a) return;
  $("#depCosto").value = a.costo;
  $("#depVida").value = a.vidaUtil || 10;
  $("#depResidual").value = a.valorResidual || 0;
  $("#depFecha").value = a.fechaAdquisicion || "";
});

$("#btnAplicarRep").addEventListener("click", aplicarReporte);
$("#btnCsvRep").addEventListener("click", exportarCsv);
$("#btnPrintRep").addEventListener("click", () => window.print());

$("#artFoto").addEventListener("change", e => leerArchivo(e.target, "foto"));
$("#artCopia").addEventListener("change", e => leerArchivo(e.target, "copia"));
$("#btnQuitarFoto").addEventListener("click", () => quitarAdjunto("foto"));
$("#btnQuitarCopia").addEventListener("click", () => quitarAdjunto("copia"));

$("#fechaHoy").textContent = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
if ($("#printFecha")) $("#printFecha").textContent = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
fillSelect($("#fEstadoArt"), ESTADOS, true);
fillSelect($("#fCatArt"), CATEGORIAS, true);
activateView("dashboard");
