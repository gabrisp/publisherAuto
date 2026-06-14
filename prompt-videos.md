
Estás en un directorio que contiene vídeos de ideas ganadoras de TikTok y un fichero de texto con los tags disponibles. Tu tarea es completamente automática — no preguntes nada, ejecútala entera y escribe el resultado.

---

## Pasos

### 1. Leer el directorio

Ejecuta `ls` para localizar:
- Todos los ficheros de vídeo (`.mp4`, `.mov`, `.MP4`, `.MOV`)
- El fichero `.txt` con los tags disponibles (puede llamarse `tags.txt`, `tags_available.txt` o similar)

### 2. Leer los tags disponibles

Lee el fichero `.txt` completo. Cada línea o entrada es un conjunto de tags que describe una imagen disponible. **Solo puedes usar tags que aparezcan aquí.** No inventes ninguno.

### 3. Extraer la idea de cada vídeo

Para cada vídeo:
1. Analiza el fichero visualmente (frames, texto en pantalla, contexto visual)
2. Si el vídeo tiene voz, extrae el audio con `ffmpeg -i <video> -vn -ar 16000 -ac 1 /tmp/audio_<n>.wav` y transfórmalo en texto con las herramientas disponibles
3. Si no puedes procesar el contenido, usa el nombre del fichero como idea principal
4. Extrae el **hook central** — la idea que haría que alguien hiciera swipe en TikTok

### 4. Generar el JSON

Crea un carousel por cada vídeo. Usa exactamente esta estructura:

```json
{
  "version": "1.0",
  "carousels": [
    {
      "name": "Nombre descriptivo interno del carousel",
      "videoTitle": "Hook de TikTok — máximo 90 caracteres, primera frase del caption",
      "description": "Descripción del vídeo, 2–5 frases. Amplía el hook, da contexto, no repite el título.",
      "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
      "app": "creatinely",
      "influencer": "justin",
      "slides": [
        {
          "id": "slide-1",
          "image": { "scope": "influencer", "tags": ["<tag del txt>"] },
          "texts": [
            {
              "id": "t1",
              "content": "Texto del slide",
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
        }
      ]
    }
  ]
}
```

#### Reglas de contenido

- **`videoTitle`**: hook de TikTok, ≤90 caracteres, estilo curiosidad/tensión. Ej: *"Most people think they can't grow because of genetics…"*
- **`description`**: 2–5 frases, amplía el hook, termina con CTA suave
- **`hashtags`**: exactamente 5 strings sin `#`, relevantes al tema
- **`influencer`**: `justin` o `christian` — elige el que mejor encaje con el vídeo
- **Entre 4 y 8 slides** por carousel
- **Primer slide**: hook visual fuerte — prioriza `scope: "influencer"`, si no `scope: "global"`
- **No repitas el mismo tag en slides consecutivos**
- **Máximo 2 bloques de texto por slide**
- **Solo usa tags del fichero `.txt`** — nunca inventes tags

#### Scopes de imagen

- `"global"` — imágenes genéricas del banco
- `"app"` — mockups de Creatinely (úsalo cuando el slide habla de la app)
- `"influencer"` — fotos del influencer (úsalo en slides del influencer en concreto)

#### Coordenadas del canvas (1080 × 1920 px)

| Zona | Y aproximada | Para qué |
|---|---|---|
| Hook / título | 120 – 350 | Primera frase que engancha |
| Cuerpo | 700 – 1100 | Puntos, desarrollo |
| Parte baja | 1500 – 1780 | CTA, "Swipe →", remate |

- `x` mínimo: **60** — `x + width` máximo: **1020**
- `width` recomendado: **900** centrado, **860** pegado a un lado
- `fontSize` hook: **68–90** · cuerpo: **44–60** · CTA: **32–42**

### 5. Escribir output.json

Escribe el JSON completo en `output.json` en este mismo directorio. Solo JSON, sin texto alrededor.
