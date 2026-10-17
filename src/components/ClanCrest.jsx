import React, { useState } from "react";

/**
 * Insignia del clan en el juego (la que da la API de Clash), para distinguir
 * un clan del otro. No es la marca del clan: esa es /logo.png. Si falta la
 * direccion o la imagen no carga, no pinta nada (nunca deja un icono roto).
 */
const ClanCrest = ({ url, className = "w-6 h-6" }) => {
  const [failed, setFailed] = useState(false);
  if (!url || failed) return null;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} shrink-0 object-contain`}
    />
  );
};

export default ClanCrest;
