import React from "react";

/**
 * Marca del clan (TN Clan): /public/logo.png. El redondeo (28%) va YA en el PNG,
 * con transparencia: asi las esquinas naranjas de la imagen asoman como un eco
 * de luz. No se le añade otro recorte con CSS.
 */
const BrandLogo = ({ className = "w-11 h-11" }) => (
  <img
    src={`${process.env.PUBLIC_URL}/logo.png`}
    alt="True North"
    className={`${className} shrink-0`}
  />
);

export default BrandLogo;
