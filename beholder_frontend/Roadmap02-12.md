Roadmap: **fortalecer la búsqueda en el frontend**  **expandir la sincronización en el backend**

---

## 🧩 Fase 1: Búsqueda inteligente en el frontend

### 🎯 Objetivo
Un solo campo de búsqueda que acepte:
- PPPoE
- Nombre de cliente
- Datos parciales
- Ignorando mayúsculas/minúsculas

### 🔧 Estrategia técnica

#### 1. **Normalizar el input**
```tsx
const normalizar = (texto: string) => texto.trim().toLowerCase();
```

#### 2. **Buscar en múltiples campos**
En el handler de búsqueda, filtrá contra todos los campos relevantes:

```tsx
const resultados = clientes.filter((c) => {
  const query = normalizar(pppoe);
  return (
    normalizar(c.pppoe).includes(query) ||
    normalizar(c.nombre).includes(query) ||
    normalizar(c.direccion).includes(query)
  );
});
```

#### 3. **Mostrar lista si hay múltiples resultados**
```tsx
{resultados.length > 1 && (
  <ul className="result-list">
    {resultados.map((cliente) => (
      <li key={cliente.pppoe} onClick={() => setSeleccionado(cliente)}>
        {cliente.nombre} ({cliente.pppoe})
      </li>
    ))}
  </ul>
)}
```

#### 4. **Mantener la lista visible**
- No borrás `resultados` al hacer click en un item.
- Solo se borra si se hace click en “Buscar” o se presiona Enter.

#### 5. **Estilos responsivos**
```css
.result-list {
  margin-top: 0.5rem;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
}
.result-list li {
  padding: 0.5rem;
  cursor: pointer;
}
.result-list li:hover {
  background-color: #f0f0f0;
}
```

---

## 🧩 Fase 2: Backend – sincronización extendida

### 🎯 Objetivo
- Consultar la API de ISPCube para traer tabla de clientes.
- Enriquecer cada cliente con su VLAN desde SmartOLT.
- Guardar todo en tu base local para búsquedas rápidas.

### 🔧 Estrategia técnica

#### 1. **Consulta a ISPCube**
```ts
GET https://ispcube.api/clientes
Authorization: Bearer <token>
```

Parseás nombre, PPPoE, dirección, plan, etc.

#### 2. **Consulta a SmartOLT por VLAN**
Por cada cliente con ONU registrada:
```ts
GET https://smartolt.com/api/onu_info?serial=HWTCE56F449D
```

Extraés `vlan_id`, `olt_name`, `signal`, etc.

#### 3. **Unificación y almacenamiento**
Guardás en tu tabla local:
```ts
{
  nombre: "CARPE EMILIA",
  pppoe: "ecarpe",
  direccion: "DEAN FUNES 195 DPTO 1",
  plan: "50Mb",
  vlan: 120,
  olt: "Villa Dolores 2",
  onu_sn: "HWTCE56F449D"
}
```
sumar la api de cnMaestro a la consulta.
En la base de clientes
---

## 🧠 Ventajas

- La búsqueda se vuelve instantánea y tolerante a errores.
- El operador puede buscar por lo que tenga a mano.
- La sincronización te permite tener una base local robusta, ideal para escalar.

---


