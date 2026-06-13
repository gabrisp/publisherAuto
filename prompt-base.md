# Prompt base — completar carousels a JSON

Copia todo desde "## PROMPT" hacia abajo, rellena las secciones marcadas con `[ ]` y mándalo.

---

## PROMPT

Voy a darte instrucciones técnicas para que conviertas las ideas que ya tienes en un JSON concreto que procesa mi plataforma. No tienes que inventar los temas — ya los tienes. Solo tienes que desarrollar los slides y generar el JSON en el formato exacto que te explico.

---

### Las ideas / hooks que quiero desarrollar

```
[ PEGA AQUÍ TUS HOOKS O IDEAS, UNO POR LÍNEA. EJEMPLO:
5 things to avoid if you want to gain muscle
Why you're not gaining weight
The truth about creatine
]
```

---

### Tags disponibles para esta tanda

Usa SOLO los tags de esta lista. No inventes tags que no estén aquí.

Cada entrada es un array de tags que tiene esa imagen — puedes referenciarla usando uno o varios de ellos en el campo `"tags"` del slide.

```
[ PEGA AQUÍ EL OUTPUT DE "COPY ALL" DE LA SECCIÓN TAGS DISPONIBLES ]
```

---

### Qué tienes que hacer

Para cada idea/hook de arriba, crea un carousel completo en JSON. Desarrolla el contenido de cada slide tú — el hook ya está dado, el resto (puntos, explicaciones, remate) lo construyes en base a lo que sabes del tema.

---

### Estructura del JSON

```json
{
  "version": "1.0",
  "carousels": [
    {
      "name": "Nombre descriptivo del carousel",
      "videoTitle": "Hook de hasta 90 caracteres para el caption de TikTok",
      "description": "Descripción larga del video (2–5 frases). Contexto, gancho emocional, por qué ver el carousel.",
      "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"],
      "app": "creatinely",
      "influencer": "justin",
      "slides": [
        {
          "id": "slide-1",
          "image": { "scope": "global", "tags": ["biceps"] },
          "texts": [
            {
              "id": "t1",
              "content": "El texto que va en la imagen",
              "x": 80,
              "y": 160,
              "fontSize": 72,
              "color": "#FFFFFF",
              "fontWeight": "bold",
              "fontFamily": "Arial",
              "align": "left",
              "width": 920,
              "stroke": true,
              "strokeWidth": 1

            }
          ]
        }
      ]
    }
  ]
}
```

Un JSON puede contener **varios carousels a la vez** en el array `carousels`.

---

### Campos de caption para TikTok

- **`videoTitle`**: Hook de TikTok, **máximo 90 caracteres**. Primera frase del caption, estilo curiosidad/tensión (ej: *"Many people think they don't grow because of genetics…"*). **NO** es el nombre interno del carousel — es lo que ve el espectador antes de hacer clic en "más".
- **`description`**: Descripción del video, 2–5 frases. Amplía el hook, da contexto, no repite el título. Puede terminar con una llamada a la acción suave.
- **`hashtags`**: Array de exactamente **5 strings sin `#`**, relevantes al tema del carousel (no genéricos de relleno).

---

### Valores fijos

**`app`**: `creatinely`
**`influencer`**: `justin` o `christian`

---

### Scopes de imagen

- `"global"` — imágenes genéricas del banco
- `"app"` — mockups de la app Creatinely (usar cuando el slide habla de la app)
- `"influencer"` — fotos personales del influencer (usar cuando el slide es del influencer en concreto)

El campo `"tags"` es **siempre un array**, aunque sea un solo tag:

```json
"image": { "scope": "global", "tags": ["biceps"] }
"image": { "scope": "global", "tags": ["biceps", "broll"] }
```

Con varios tags busca una imagen que los tenga **todos** — úsalo para ser más preciso. Con uno solo coge la primera imagen disponible con ese tag.

---

### Texto — coordenadas

El canvas es **1080 × 1920 px**.

| Zona | Y aproximada | Para qué |
|---|---|---|
| Hook / título | 120 – 350 | Primera frase que engancha |
| Cuerpo | 700 – 1100 | Desarrollo, puntos |
| Parte baja | 1500 – 1780 | CTA, "Swipe →", remate |

- `x` mínimo: **60** — `x + width` máximo: **1020**
- `width` recomendado: **900** centrado, **860** pegado a un lado
- `fontSize` hook: **68–90** · cuerpo: **44–60** · CTA/pequeño: **32–42**
- `color`: normalmente `"#FFFFFF"` sobre fotos oscuras
- `stroke`: `true` añade borde negro (recomendado para legibilidad) · `false` sin borde · default `true`
- `strokeWidth`: grosor del borde en px — normalmente `1`, puedes subir a `2` para textos muy grandes
- Varios textos por slide posibles — ids distintos: `"t1"`, `"t2"`, etc.

---

### Reglas de estructura

- **Primer slide**: el hook. Imagen impactante — prioriza `scope: "influencer"` si tiene el tag, si no usa `scope: "global"` con algo visual fuerte.
- **Entre 4 y 8 slides** por carousel.
- **No repitas el mismo tag en slides consecutivos.**
- **Texto corto** — máximo 2 bloques de texto por slide.

---

### Ejemplo

```json
{
  "version": "1.0",
  "carousels": [
    {
      "name": "Justin — 5 cosas que hacen crecer tus bíceps",
      "videoTitle": "Most guys never grow their biceps because of this mistake",
      "description": "I trained arms for 3 years without seeing real growth. Turns out I was making the same 5 mistakes over and over. These are the exact fixes that finally moved the needle — save this for your next arm day.",
      "hashtags": ["armday", "bicepsworkout", "musclebuilding", "gymtok", "naturalbodybuilding"],
      "app": "creatinely",
      "influencer": "justin",
      "slides": [
        {
          "id": "slide-1",
          "image": { "scope": "influencer", "tags": ["mirror"] },
          "texts": [
            {
              "id": "t1",
              "content": "5 cosas que hacen crecer tus bíceps de verdad",
              "x": 60,
              "y": 140,
              "fontSize": 80,
              "color": "#FFFFFF",
              "fontWeight": "bold",
              "fontFamily": "Arial",
              "align": "left",
              "width": 860,
              "stroke": true,
              "strokeWidth": 1
            }
          ]
        },
        {
          "id": "slide-2",
          "image": { "scope": "global", "tags": ["biceps"] },
          "texts": [
            {
              "id": "t1",
              "content": "1. Progresión de carga",
              "x": 60,
              "y": 200,
              "fontSize": 72,
              "color": "#FFFFFF",
              "fontWeight": "bold",
              "fontFamily": "Arial",
              "align": "left",
              "width": 860,
              "stroke": true,
              "strokeWidth": 1
            },
            {
              "id": "t2",
              "content": "Sin añadir peso cada semana no hay razón para crecer",
              "x": 60,
              "y": 340,
              "fontSize": 46,
              "color": "#EEEEEE",
              "fontWeight": "normal",
              "fontFamily": "Arial",
              "align": "left",
              "width": 860,
              "stroke": true,
              "strokeWidth": 1
            }
          ]
        },
        {
          "id": "slide-3",
          "image": { "scope": "global", "tags": ["biceps", "broll"] },
          "texts": [
            {
              "id": "t1",
              "content": "2. Rango completo de movimiento",
              "x": 60,
              "y": 200,
              "fontSize": 68,
              "color": "#FFFFFF",
              "fontWeight": "bold",
              "fontFamily": "Arial",
              "align": "left",
              "width": 900,
              "stroke": true,
              "strokeWidth": 1
            }
          ]
        },
        {
          "id": "slide-4",
          "image": { "scope": "app", "tags": ["man", "main-view"] },
          "texts": [
            {
              "id": "t1",
              "content": "Descarga Creatinely gratis",
              "x": 60,
              "y": 1500,
              "fontSize": 60,
              "color": "#FFFFFF",
              "fontWeight": "bold",
              "fontFamily": "Arial",
              "align": "center",
              "width": 960,
              "stroke": true,
              "strokeWidth": 1
            }
          ]
        }
      ]
    }
  ]
}
```

---

Devuelve solo el JSON, sin explicaciones alrededor. Listo para copiar y pegar.
