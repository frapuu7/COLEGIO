const STORAGE_KEY = "sgaf_db_v1";

const CATEGORIAS = [
  "Mobiliario",
  "Equipo de Cómputo",
  "Electrónica",
  "Vehículos",
  "Herramientas",
  "Laboratorio",
  "Deportivo",
  "Otro"
];

const ESTADOS = ["Activo", "Mantenimiento", "Baja"];

const UNIDADES = ["Pieza", "Juego", "Caja", "Metro", "Kit"];

function seedDb() {
  const proveedores = [
    { id: 1, nombre: "Grupo Escolar Moderno S.A. de C.V.", rfc: "GEM980412XY3", contacto: "Laura Mendoza", telefono: "55-1234-5678", email: "ventas@gescolar.mx", direccion: "Av. Reforma 120, CDMX" },
    { id: 2, nombre: "Tecnología Educativa del Norte", rfc: "TEN150820QW1", contacto: "Jorge Ramírez", telefono: "81-8765-4321", email: "contacto@ten.mx", direccion: "Av. Lincoln 450, Monterrey" },
    { id: 3, nombre: "Mobiliario y Equipos Integrales", rfc: "MEI020715AB2", contacto: "Sofía Delgado", telefono: "33-2233-4455", email: "info@meintegral.com", direccion: "Calz. Independencia 900, Guadalajara" },
    { id: 4, nombre: "Papelería y Suministros La Union", rfc: "PSU110330CD4", contacto: "Miguel Ángel Ruiz", telefono: "55-9988-7766", email: "ventas@launion.mx", direccion: "Calle Morelos 78, CDMX" }
  ];

  const productos = [
    { id: 1, codigo: "PRD-0001", nombre: 'Laptop educativa 14"', categoria: "Equipo de Cómputo", unidad: "Pieza", precioReferencia: 14500 },
    { id: 2, codigo: "PRD-0002", nombre: "Proyector multimedia HD", categoria: "Electrónica", unidad: "Pieza", precioReferencia: 9800 },
    { id: 3, codigo: "PRD-0003", nombre: "Escritorio de maestro 1.20 m", categoria: "Mobiliario", unidad: "Pieza", precioReferencia: 3200 },
    { id: 4, codigo: "PRD-0004", nombre: "Silla ergonómica estudiantil", categoria: "Mobiliario", unidad: "Pieza", precioReferencia: 850 },
    { id: 5, codigo: "PRD-0005", nombre: "Pizarrón blanco 1.50 x 1.00", categoria: "Mobiliario", unidad: "Pieza", precioReferencia: 1900 },
    { id: 6, codigo: "PRD-0006", nombre: "Impresora multifunción láser", categoria: "Equipo de Cómputo", unidad: "Pieza", precioReferencia: 6400 },
    { id: 7, codigo: "PRD-0007", nombre: "Microscopio binocular escolar", categoria: "Laboratorio", unidad: "Pieza", precioReferencia: 4300 },
    { id: 8, codigo: "PRD-0008", nombre: "Kit de balones deportivos (10 pzas)", categoria: "Deportivo", unidad: "Kit", precioReferencia: 2600 }
  ];

  const articulos = [
    { id: 1, clave: "AF-0001", nombre: 'Laptop Dell Latitude 3420', categoria: "Equipo de Cómputo", marca: "Dell", modelo: "Latitude 3420", serie: "DL3420-88213", ubicacion: "Dirección", fechaAdquisicion: "2022-03-15", costo: 16800, vidaUtil: 4, valorResidual: 1600, proveedorId: 2, estado: "Activo" },
    { id: 2, clave: "AF-0002", nombre: "Proyector Epson PowerLite E20", categoria: "Electrónica", marca: "Epson", modelo: "PowerLite E20", serie: "EPX-E20-10442", ubicacion: "Aula 12", fechaAdquisicion: "2021-08-02", costo: 10250, vidaUtil: 5, valorResidual: 1000, proveedorId: 2, estado: "Activo" },
    { id: 3, clave: "AF-0003", nombre: "Escritorio de maestro con cajonera", categoria: "Mobiliario", marca: "MEI", modelo: "ED-120", serie: "", ubicacion: "Aula 07", fechaAdquisicion: "2019-01-20", costo: 3400, vidaUtil: 10, valorResidual: 300, proveedorId: 3, estado: "Activo" },
    { id: 4, clave: "AF-0004", nombre: "Impresora HP LaserJet Pro M404dn", categoria: "Equipo de Cómputo", marca: "HP", modelo: "M404dn", serie: "HPM404-55621", ubicacion: "Secretaría", fechaAdquisicion: "2020-06-11", costo: 6900, vidaUtil: 5, valorResidual: 600, proveedorId: 4, estado: "Mantenimiento" },
    { id: 5, clave: "AF-0005", nombre: "Microscopio binocular Modelo MB-200", categoria: "Laboratorio", marca: "Bresser", modelo: "MB-200", serie: "BSR-MB200-0031", ubicacion: "Laboratorio de Ciencias", fechaAdquisicion: "2023-02-27", costo: 4800, vidaUtil: 8, valorResidual: 500, proveedorId: 1, estado: "Activo" },
    { id: 6, clave: "AF-0006", nombre: "Camioneta panel Nissan Urvan", categoria: "Vehículos", marca: "Nissan", modelo: "Urvan Panel", serie: "NSN-URVN-90211", ubicacion: "Estacionamiento", fechaAdquisicion: "2021-11-05", costo: 385000, vidaUtil: 10, valorResidual: 40000, proveedorId: 1, estado: "Activo" },
    { id: 7, clave: "AF-0007", nombre: "Set de 30 sillas estudiantiles", categoria: "Mobiliario", marca: "MEI", modelo: "SE-30", serie: "", ubicacion: "Aula 03", fechaAdquisicion: "2020-08-14", costo: 25500, vidaUtil: 8, valorResidual: 2500, proveedorId: 3, estado: "Activo" },
    { id: 8, clave: "AF-0008", nombre: "Proyector antiguo ViewSonic", categoria: "Electrónica", marca: "ViewSonic", modelo: "PA503X", serie: "VS-PA503-11209", ubicacion: "Almacén", fechaAdquisicion: "2017-04-18", costo: 8700, vidaUtil: 5, valorResidual: 800, proveedorId: 2, estado: "Baja" },
    { id: 9, clave: "AF-0009", nombre: "Laptop HP Pavilion x360", categoria: "Equipo de Cómputo", marca: "HP", modelo: "Pavilion x360", serie: "HPX360-77410", ubicacion: "Sala de maestros", fechaAdquisicion: "2023-07-31", costo: 15900, vidaUtil: 4, valorResidual: 1500, proveedorId: 2, estado: "Activo" },
    { id: 10, clave: "AF-0010", nombre: "Pizarrón blanco acrílico 1.50 m", categoria: "Mobiliario", marca: "Genérico", modelo: "PB-150", serie: "", ubicacion: "Aula 15", fechaAdquisicion: "2022-01-10", costo: 2100, vidaUtil: 10, valorResidual: 200, proveedorId: 3, estado: "Activo" }
  ];

  return { seqArticulo: articulos.length + 1, seqProducto: productos.length + 1, seqProveedor: proveedores.length + 1, articulos, productos, proveedores };
}

function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.articulos)) return parsed;
    }
  } catch (e) {}
  const db = seedDb();
  saveDb(db);
  return db;
}

function saveDb(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {}
}
