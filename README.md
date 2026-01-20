# 💪 ZONA DE PODER

![Banner](https://via.placeholder.com/1200x300?text=ZONA+DE+PODER)

> **Donde el potencial se convierte en rendimiento.**

¡Hola! Soy **Jean Cardozo**, y este es mi proyecto: una plataforma integral para la gestión completa de gimnasios y centros deportivos. He diseñado este sistema para acabar con desorden administrativo y conectar realmente a los entrenadores con el progreso de sus atletas.

---

## 🚀 ¿Qué es esto?

**ZONA DE PODER** es el cerebro digital para tu gimnasio. Olvídate del papel y las hojas de cálculo. Esta aplicación centraliza todo: desde que un cliente cruza la puerta, paga su mensualidad, hasta que recibe su rutina personalizada en el celular.

Lo construí pensando en la escalabilidad, usando tecnologías modernas como **Node.js** y **Supabase**, listo para desplegarse en la nube y aguantar la carga de un negocio real.

## 🔥 Lo que puedes hacer

### 👥 Clientes
- **Tu progreso en gráficas:** Mira cómo cambian tus medidas mes a mes.
- **Rutinas al bolsillo:** Tu plan de entrenamiento siempre contigo.
- **Pagos sin filas:** Renueva tu plan online (integrado con **MercadoPago**).

### 🧢 Entrenadores
- **Adiós a la improvisación:** Diseña y asigna rutinas profesionales.
- **Seguimiento real:** Registra medidas y tests físicos para ver la evolución de tus alumnos.

### 💼 Administradores
- **Control total:** Dashboard con ingresos, usuarios activos y alertas.
- **Facturación POS:** Vende productos y planes al instante.
- **Seguridad:** Gestión de roles y accesos granulares.

---

## 🛠️ Cómo está construido (Tech Stack)

He utilizado un stack robusto y moderno:

- **Backend:** Node.js & Express.js (Rápido y eficiente).
- **Base de Datos:** PostgreSQL en Supabase (Potencia y seguridad en la nube).
- **Frontend:** EJS + Tailwind CSS (Diseño limpio, responsivo y rápido).
- **Seguridad:** Autenticación JWT y sesiones seguras.
- **Pagos:** Integración real con MercadoPago.

---

## ⚡ Levanta el proyecto en tu máquina

Si quieres probarlo o colaborar, sigue estos pasos:

1. **Clona el repo:**
   ```bash
   git clone https://github.com/tu-usuario/zona-de-poder.git
   cd zona-de-poder
   ```

2. **Instala las dependencias:**
   ```bash
   npm install
   ```

3. **Configura tus variables (.env):**
   Necesitarás conectar tu base de datos y llaves de seguridad.
   ```env
   DATABASE_URL=postgresql://usuario:password@host:port/database
   SECRET_KEY=...
   MP_ACCESS_TOKEN_V=...
   ```

4. **Corre el servidor:**
   ```bash
   npm run dev
   ```
   ¡Y abre `http://localhost:5000`!

---

## 🐛 ¿Problemas?
Si la base de datos te da guerra (`ENOTFOUND`), revisa tu conexión a internet y las credenciales de Supabase en el `.env`.

---
*Hecho con código y pesas por Jean Cardozo.*
