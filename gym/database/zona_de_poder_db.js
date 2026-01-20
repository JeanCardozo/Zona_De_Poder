const { Pool } = require("pg");
require("dotenv").config();

let pool;

// Limpiar posibles espacios en blanco en las variables de entorno
const connectionString = process.env.DATABASE_URL
  ? process.env.DATABASE_URL.trim()
  : null;

if (connectionString) {
  // Usar DATABASE_URL si está disponible (Vercel/Render)
  pool = new Pool({
    connectionString: connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false,
  });
} else {
  // Usar variables individuales para desarrollo local
  pool = new Pool({
    host: process.env.DB_HOST ? process.env.DB_HOST.trim() : undefined,
    port: process.env.DB_PORT ? process.env.DB_PORT.trim() : 5432,
    user: process.env.DB_USER ? process.env.DB_USER.trim() : undefined,
    password: process.env.DB_PASS ? process.env.DB_PASS.trim() : undefined,
    database: process.env.DB_NAME ? process.env.DB_NAME.trim() : undefined,
  });
}

pool.on("connect", () => {
  // Escuchar eventos de conexión exitosa (opcional, para debug)
  console.log("✅ Conexión establecida con la base de datos");
});

pool.on("error", (err) => {
  console.error("❌ Error en la conexión a la base de datos:", err);
  if (err.code === "ENOTFOUND") {
    console.error(`
    ⚠️  ATENCIÓN: ERROR DE CONEXIÓN DNS
    
    No se puede encontrar la dirección de la base de datos (${process.env.DB_HOST || process.env.DATABASE_URL}).
    
    Esto suele ocurrir porque Supabase usa direcciones IPv6 y tu red local usa IPv4.
    
    SOLUCIÓN DEFINITIVA:
    1. Ve a tu Dashboard de Supabase > Project Settings > Database.
    2. Busca la sección "Connection Pooling" y actívala si no lo está.
    3. Copia el "Connection String" (modo Transaction) y asegúrate de elegir "IPv4".
    4. Usa esa URL en tu archivo .env como DATABASE_URL.
    5. El host cambiará a algo como 'aws-0-us-east-1.pooler.supabase.com'.
    `);
  }
});

module.exports = pool;
