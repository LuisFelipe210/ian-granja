export const PHONE_DISPLAY = "(87) 9 8844-8690";
export const PHONE_HREF = "tel:+5587988448690";
export const EMAIL = "contato@iangranja.adv.br";
export const INSTAGRAM_HANDLE = "@iangranja.adv";
export const INSTAGRAM_URL = "https://www.instagram.com/iangranja.adv";
export const HOURS = "Segunda a sexta, das 8h às 18h";
export const OAB = "OAB/PE 61.107";

export const ADDRESS_LINES = [
    "Av. Cardoso de Sá, 860, sala 5",
    "Centro Empresarial Sergio Cabral",
    "Cidade Universitária, Petrolina-PE",
];

export const MAPS_URL =
    "https://www.google.com/maps/search/?api=1&query=Av.+Cardoso+de+S%C3%A1%2C+860+-+Cidade+Universit%C3%A1ria%2C+Petrolina+-+PE";

export const MAPS_EMBED =
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3947.5342426867015!2d-40.50570702581029!3d-9.379201590736173!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x7a2d04a60015099%3A0x6a2e4f04c64b611e!2sAv.%20Cardoso%20de%20S%C3%A1%2C%20860%20-%20Cidade%20Universit%C3%A1ria%2C%20Petrolina%20-%20PE%2C%2056302-110%2C%20Brasil!5e0!3m2!1spt-BR!2sus!4v1703632420459!5m2!1spt-BR!2sus";

const WHATSAPP_NUMBER = "5587988448690";

export const whatsappUrl = (message = "Olá! Gostaria de falar com um advogado.") =>
    `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
