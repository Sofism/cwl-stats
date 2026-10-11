// Cabeceras de las peticiones que ESCRIBEN datos. Si WRITE_SECRET esta
// definida en el servidor (y REACT_APP_WRITE_SECRET con el mismo valor en el
// build), el servidor la exige; si no, no se envia nada y todo funciona como
// siempre. Ver api/_lib/auth.js.
const WRITE_SECRET = process.env.REACT_APP_WRITE_SECRET;

export const writeHeaders = () => ({
  "Content-Type": "application/json",
  ...(WRITE_SECRET ? { "x-write-secret": WRITE_SECRET } : {}),
});
