# La Niebla (demo `/pascal-web/bistro/`): imágenes que faltan

Cada imagen reemplaza un archivo provisional de `pascal-web/bistro/img/` con **el mismo nombre**. Formato WebP. Ninguna debe llevar texto, logos, marcas ni personas reales o reconocibles.

Añade este estilo al final de cada prompt para que todas se vean de la misma casa:

> Style: moody fine-dining editorial photography, very dark low-key lighting, deep blacks, single warm tungsten light source, shallow depth of field, subtle film grain, natural textures, no text, no logos, no watermarks.

Las marcadas **B/N** terminan además con: `black and white, high contrast, fine grain`.

| Archivo | Tamaño | Dónde va | Prompt |
|---|---|---|---|
| `hero.webp` | 1080×1920 | Portada en celular y fondo de marca | Interior of an intimate contemporary bistro at night, vertical composition. Round dark-wood tables with a single folded linen napkin and a stemless glass each, lit by warm pools of light. Behind them, tall dark shelves filled with rows of ceramic jars fading into shadow. Empty room, no people. Leave the middle third calm and dark for a logo. |
| `hero-ancho.webp` | 2400×1350 | Portada en computador | Same bistro interior as a wide horizontal shot: three round dark-wood tables in warm pools of light across the lower half, tall shelves of ceramic jars across the upper half fading into darkness. Empty room, no people. Left half darker and calmer for a logo. |
| `nosotros.webp` | 1200×900 | Nosotros · **B/N** | Open restaurant kitchen during service seen from the dining room, stainless steel pass, hanging lamps, several cooks working in the background slightly out of focus, round table in the foreground. Faces not distinguishable. |
| `acerca.webp` | 1200×900 | Acerca de · **B/N** | Close view of a kitchen pass: two pairs of hands finishing several small plates with tweezers and spoons, stacked bowls and small tools around, dark tiled wall behind. No faces. |
| `galeria-1.webp` | 1080×1350 | Galería 1 | A stack of handmade off-white ceramic bowls on a steel counter, photographed with intentional motion blur and a tilted frame, streaks of warm and red light in the dark background. |
| `galeria-2.webp` | 1080×1350 | Galería 2 | Almost black scene: a few ripe heirloom tomatoes and one orange citrus on a dark board, lit by a narrow beam of light; a cook's hand in a dark apron barely visible above. Mostly negative space. |
| `galeria-3.webp` | 1080×1350 | Galería 3 | A single round wooden table set for two in a dark dining room, one candle, linen napkins, stemless glasses, shelves of jars blurred behind. No people. |
| `inspiracion.webp` | 1200×900 | Inspiración (encima se dibujan notas a mano) | Top-down view of a matte black plate on a black stone surface holding an arrangement of Andean produce: small native potatoes, tomatoes, leafy herbs, seeds and nuts, a halved citrus. Ingredients spread out with space between them. Dark, soft side light. |
| `chef-1.webp` | 1080×1350 | La chef, foto 1 · **B/N** | Steam rising from a pot on a stainless steel kitchen counter, light streaks and reflections on the metal, dynamic angle, no people. |
| `chef-2.webp` | 1080×1350 | La chef, foto 2 · **B/N** | Portrait of a fictional Colombian woman chef in her late thirties, dark polo shirt, hair tied back, seated in a dim dining room looking off camera with a calm expression, heavy curtains behind her. Invented person, not resembling any real individual. |
| `chef-3.webp` | 1080×1350 | La chef, foto 3 · **B/N** | Fast hands plating a dish on a white plate, strong motion blur on hands and plate rims, bright highlights, abstract and energetic. No faces. |
| `equipo.webp` | 1600×1000 | El equipo | Group photo of about thirty restaurant staff, cooks in dark uniforms and navy aprons, some seated in front and some standing behind, in front of a dark brick building on a quiet street in daylight. Diverse Colombian men and women, relaxed smiles. Invented people. Natural color, slightly muted. |
| `equipo-1.webp` | 400×400 | Cara del equipo 1 | Head-only cutout of a smiling young Colombian woman with dark hair tied back, centered on a pure white background, soft even light, natural color. Invented person. |
| `equipo-2.webp` | 400×400 | Cara del equipo 2 | Head-only cutout of a cheerful Colombian woman in her thirties with a round face and hair pulled back, centered on a pure white background, soft even light, natural color. Invented person. |
| `equipo-3.webp` | 400×400 | Cara del equipo 3 | Head-only cutout of a Colombian man in his thirties with glasses and a short beard, calm expression, centered on a pure white background, soft even light, natural color. Invented person. |
| `chef-retrato.webp` | 1080×1500 | Reconocimientos · **B/N** | Three-quarter portrait of the same fictional woman chef from `chef-2`, wearing a dark t-shirt and a long white apron, hands on her hips, standing in a professional kitchen, looking at the camera with a confident half smile. Plain apron with no lettering. |
| `evento.webp` | 1600×900 | Franja de celebración | A large group of restaurant professionals in chef whites and dark suits celebrating on an awards stage with magenta and blue stage lights, confetti in the air, seen from the audience. Faces small and not distinguishable. Stage screens blank, no lettering anywhere. Full color, vivid. |
| `chef-pegatina.webp` | 500×500, **fondo transparente** | Pegatina junto a «Reservar» y en contacto | Head-only cutout of the same fictional woman chef wearing a white cotton chef's cap, slight smirk, looking at the camera, sticker-like crop of just the head and cap, transparent background, natural color. |
| `reserva-fondo.webp` | 1080×1920 | Fondo de reserva y carta | Vertical view of a restaurant dining room toward the bar: round wooden table in the lower third with a small flower vase and a folded napkin, green upholstered banquette, back bar with bottles softly lit in the upper third, perforated metal ceiling. No people. Warm, slightly brighter than the hero. |

Para que la chef sea la misma persona en `chef-2`, `chef-retrato` y `chef-pegatina`, genera primero `chef-retrato` y úsala como imagen de referencia de las otras dos.

Si cambias el nombre del restaurante, reemplaza «La Niebla», «LA NIEBLA», «LN» y `laniebla.example` en `pascal-web/bistro/index.html`.
