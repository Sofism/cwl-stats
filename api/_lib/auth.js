// Proteccion minima de los endpoints que ESCRIBEN datos. Antes cualquiera
// con la URL podia borrar o sobrescribir todas las temporadas con un simple
// curl, sin ninguna clave.
//
// Es opt-in a proposito: si WRITE_SECRET no esta definida en el servidor no
// se exige nada (la app sigue funcionando igual que antes). Para activarla
// hay que definir el MISMO valor en dos sitios y redesplegar:
//   - WRITE_SECRET            (servidor, Vercel)
//   - REACT_APP_WRITE_SECRET  (cliente; se hornea en el build)
//
// Igual que REACT_APP_COC_PROXY_SECRET, el valor del cliente va embebido en
// el bundle y es visible para quien mire la pestana de red: frena el abuso
// casual (curl a ciegas, bots), no es seguridad real.
const checkWriteAuth = (req, res) => {
  const required = process.env.WRITE_SECRET;
  if (!required) return true;
  if (req.headers["x-write-secret"] === required) return true;
  res.status(401).json({ error: "Unauthorized" });
  return false;
};

module.exports = { checkWriteAuth };
