# FWD_ZoFrancaCR
Laboratorio #3 - Plataforma de gestión de solicitudes y cumplimiento para Zonas Francas de Costa Rica

## Ejecución local

La aplicación usa dos servidores:

- Frontend Express: http://localhost:3000
- Backend json-server: http://localhost:3001

Instale las dependencias:

```bash
npm install
```

Luego inicie ambos servidores con:

```bash
npm start
```

Abra en el navegador:

```text
http://localhost:3000
```

El archivo `db.json` contiene los recursos utilizados por el frontend:
`zonasFrancas`, `solicitudes`, `evaluaciones`, `empresas`,
`reportesCumplimiento`, `alertas` e `historialDecisiones`.

