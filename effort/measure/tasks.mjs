// Los tres encargos del capítulo 18. Ninguno avisa de las trampas de las facturas.
const PERIOD = 'En la carpeta facturas/ están las facturas de proveedores de Horno Alto, mi panadería, de julio de 2025 a junio de 2026.';

export const TASKS = {
  explicar: {
    files: ['factura_luz_2026_02.txt'],
    prompt: 'En facturas/factura_luz_2026_02.txt tienes la última factura de la luz de mi panadería. Explícame en lenguaje sencillo qué estoy pagando y por qué.',
  },
  tabla: {
    files: [],
    prompt: `${PERIOD} Léelas todas, entiende cómo está hecha cada una y crea gastos.csv con una fila por factura y estas columnas: archivo, proveedor, numero, fecha (AAAA-MM-DD), categoria, base, iva, retencion, total (en euros, con punto decimal). Después dime cuánto he gastado en total en esos doce meses.`,
  },
  informe: {
    files: [],
    prompt: `${PERIOD} Crea informe.html, una página que se abra con doble clic y sin internet, para entender mis gastos: gasto por mes y por categoría, tendencias, qué aprendes de ellas y una previsión de lo que gastaré de julio a diciembre de 2026. Explica en la página cómo has hecho las cuentas.`,
  },
};
