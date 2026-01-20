# 💪 ZONA DE PODER - Sistema Integral de Gestión Deportiva

![Zona de Poder Banner](https://via.placeholder.com/1200x300?text=ZONA+DE+PODER)

> **Transformando el potencial en rendimiento.**  
> Una plataforma robusta y moderna diseñada para la administración eficiente de centros de acondicionamiento físico y el seguimiento personalizado de atletas.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-blue)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38bdf8)](https://tailwindcss.com/)
[![MercadoPago](https://img.shields.io/badge/Pagos-MercadoPago-009ee3)](https://www.mercadopago.com/)

---

## 🚀 Acerca del Proyecto

**ZONA DE PODER** no es solo un software administrativo; es el corazón digital de tu gimnasio. Desarrollado para optimizar el flujo de trabajo entre administradores, entrenadores y clientes, nuestra solución centraliza la ventas, el control de acceso, la planificación de entrenamientos y el seguimiento de progreso físico en una interfaz intuitiva y potente.

Diseñado con una arquitectura escalable lista para la nube (Vercel/Supabase), garantiza disponibilidad y seguridad para tu negocio.

## 🌟 Características Principales

### 🏋️ Para Clientes

- **Seguimiento de Progreso:** Visualización gráfica de medidas corporales y avances.
- **Planes Personalizados:** Acceso digital a rutinas de entrenamiento asignadas.
- **Pagos en Línea:** Renovación de mensualidades integrada con MercadoPago.
- **Historial:** Consulta de compras, asistencias y valoraciones.

### 📋 Para Entrenadores

- **Gestión de Atletas:** Asignación y monitoreo de clientes.
- **Diseñador de Rutinas:** Creación de planes de entrenamiento detallados.
- **Valoración Física:** Registro de medidas antropométricas y tests físicos.

### 🛡️ Para Administradores

- **Dashboard Integral:** Vista general de ingresos, usuarios activos y estadísticas.
- **Control de Acceso:** Gestión de roles, usuarios y permisos.
- **Ventas y Facturación:** Módulo POS para productos y servicios.
- **Reportes:** Generación de informes en PDF y Excel.
- **Gestión de Sedes:** Control de actividades y horarios.

---

## 🛠️ Stack Tecnológico

- **Backend:** Node.js, Express.js
- **Base de Datos:** PostgreSQL (Hosted on Supabase)
- **Frontend:** EJS (Server Side Rendering), Tailwind CSS
- **Autenticación:** JWT (JSON Web Tokens), Session Management
- **Pagos:** SDK de MercadoPago
- **Despliegue:** Vercel (Serverless Functions)

---

## ⚡ Instalación y Despliegue

Sigue estos pasos para ejecutar el proyecto localmente:

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/zona-de-poder.git
cd zona-de-poder
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto basándote en el siguiente ejemplo:

```env
# Base de Datos (Supabase)
DB_HOST=db.proyecto.supabase.co
DB_PORT=5432
DB_USER=postgres
DB_PASS=tu_contraseña_segura
DB_NAME=postgres
# Cadena de conexión (Pooler mode recomendado para producción)
DATABASE_URL=postgresql://postgres:pass@db.project.supabase.co:5432/postgres

# Seguridad
SECRET_KEY=TuClaveSecretaDeSesion
JWT_SECRET=TuClaveSecretaJWT

# Pagos (MercadoPago)
MP_ACCESS_TOKEN_V=Tu_Access_Token_MercadoPago

# Servidor
NODE_ENV=development
PORT=5000
```

### 4. Compilar Estilos (Tailwind)

Para generar el archivo CSS final:

```bash
npm run build:css
```

### 5. Ejecutar el Servidor

```bash
# Modo desarrollo (con autoreload)
npm run dev

# Modo producción
npm start
```

Visita `http://localhost:5000` en tu navegador.

---

## 🐛 Solución de Problemas Comunes

### Error de Conexión a Base de Datos (ENOTFOUND)

Si encuentras errores conectando a Supabase (`getaddrinfo ENOTFOUND`):

1. Verifica que tu `DATABASE_URL` en el archivo `.env` sea correcta.
2. Asegúrate de que tu proyecto en Supabase no esté pausado.
3. Si estás en una red corporativa, verifica que los puertos 5432 o 6543 no estén bloqueados.

---

## 📄 Licencia

Este proyecto está bajo la Licencia ISC.

---
