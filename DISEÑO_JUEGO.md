# Documento de Diseño de Juego (GDD) — CHEF BASTION

## 1. Visión General, Identidad y Plataforma
- **Nombre Oficial**: **CHEF BASTION**
- **Motor y Stack**: 3D WebGL (Three.js + React + Vite) empaquetado como **PWA instalable** (y listo para Android e iOS vía Capacitor).
- **Formato de Pantalla**: **Vertical (9:16 - Portrait)**, diseñado para jugar de forma rápida y cómoda con un solo pulgar.
- **Estilo Visual 3D**: Inspirado en *Cozy Plow* y *Plants vs. Zombies* — iluminación cálida al sol, materiales táctiles (madera, mármol, cristal, cobre), físicas con peso (*hitstop*, sacudida de cámara, partículas) y estética *Cozy*.
- **Temática Definitiva (Fuerza y Diferencial)**: **CHEF BASTION — Cocina Soleada vs. Plagas de Bichos** (encimera con 4 raíles verticales defendida por tu Chef Guardián en 3D personalizable con Pelos, Gorros, Armaduras de Cocina y Armas Especiales).

---

## 2. Mecánica Central: Puzzle Táctico de Raíles + Bullet Hell
- **Tablero Vertical (4 Raíles × 6 Filas)**:
  - **Arriba**: Zona de entrada de las plagas/bichos con aviso previo de por qué raíl bajan.
  - **Centro**: 4 raíles verticales donde colocas y reubicas tus utensilios/obstáculos.
  - **Abajo**: Tu **Chef Guardián en 3D** + tu **Bandeja Táctica**.
- **Inventario Táctico de Piezas Limitadas**:
  - En lugar de llenar el tablero pasivamente, tienes un número limitado de piezas que puedes **arrastrar y cambiar de raíl en tiempo real** según el enemigo que baje por cada carril.
- **Combos Espaciales ("Ponerlos de una forma específica")**:
  1. **Combo En Línea (Mismo raíl, delante + detrás)**:
     - Ejemplo: `[Emisor / Pimentero]` detrás + `[Rallador Prisma]` delante -> divide los disparos en un abanico *Bullet Hell* de 5 proyectiles.
  2. **Combo Puente Horizontal (Raíles vecinos, misma fila)**:
     - Ejemplo: dos `[Bobinas Tostadoras]` en raíles contiguos crean una resistencia al rojo vivo que funde escudos frontales (chapas, cáscaras).
  3. **Combo de Desvío / Trampa Ambiental**:
     - Ejemplo: `[Pastilla de Mantequilla]` que hace resbalar al enemigo al raíl vecino directo hacia una `[Batidora Vórtice 360°]`.

---

## 3. Progresión Determinista por Niveles (Sin RNG Frustrante)
- **2 a 3 Cambios por Nivel**:
  - Cada nivel tiene entre **2 y 3 cambios de fase** reales.
  - **Desbloqueo por Caza**: Al matar `X` número de enemigos iguales, salta un **Power-Up / Nuevo Objeto** para elegir.
  - Inmediatamente empiezan a salir nuevos enemigos que **requieren ese objeto recién obtenido combinado en una posición específica** con los anteriores.
- **Guardado Automático Total (Auto-Save)**:
  - El juego guarda automáticamente el nivel actual (`Nivel X`), la fase y los desbloqueos para continuar exactamente donde lo dejaste al volver a abrir la app.

---

## 4. Sistema de Logros "3 Formas de Matar" + Economía In-Game
- **3 Formas de Matar a cada Enemigo Clave**:
  - Cuando los niveles se complican, existen **3 métodos distintos** para eliminar a un mismo tipo de enemigo (Directa, Táctica por Rebote, Maestra por Combo).
  - Si lo matas de la **Forma X**, se desbloquea el **Logro** correspondiente y recibes un premio directo.
- **Premios de Logros (Visibles en tu Personaje 3D y Jugabilidad)**:
  - **Medallas** de maestría.
  - **Pelo / Gorros especiales** para tu personaje 3D.
  - **Armaduras especiales** con habilidades pasivas.
  - **Armas / Utensilios especiales**.
  - **Desbloqueo de Niveles Especiales Secretos** (ej. *El Interior de la Nevera*).
- **Desbloqueo / Compra In-Game ante Estancamiento**:
  - Cuando la dificultad escala y el jugador se estanca sin lograr ejecutar la muerte maestra de un logro, se habilita la **compra in-game de logros / recompensas** para conseguir el arma o armadura especial y avanzar.

---

## 5. Filosofía Móvil / Play Store (Hybrid-Casual, Cero Texto, Acción Directa)
- **Cero Historias ni Tutoriales de Texto**:
  - Prohibidas las pantallas de texto o historias largas. El jugador entra y en 3 segundos está jugando.
  - Todo se entiende de forma **100% visual e intuitiva** (arrastrar pieza -> conexión luminosa en el raíl -> disparo *Bullet Hell*).
- **Partidas "Espresso" (90–120s, Intensas y con Dificultad Incremental)**:
  - Sesiones cortas pero muy intensas para jugar con una mano en el smartphone.
  - Dificultad incremental constante (con los 2–3 cambios dentro de cada nivel y nuevos retos nivel a nivel).
- **Claridad Visual y Efecto Coleccionista (Álbum ⭐⭐⭐)**:
  - Contraste limpio entre la encimera 3D, los proyectiles y cada tipo de bicho.
  - Álbum visual con las **3 estrellas / formas de matar** por enemigo y las siluetas de sus recompensas (Pelos, Armaduras, Armas Especiales y Niveles Secretos).
  - Feedback de *"Casi lo consigo" (Near-Miss)* al perder y opción directa de desbloqueo in-game ante estancamiento.
- **Autoguardado Persistente**:
  - Cero fricción al cerrar o abrir la app en el móvil: el progreso, nivel exacto (`Nivel X`), logros y equipo se guardan al instante.

---

## 6. Requisitos Técnicos Smartphone: Fullscreen Impoluto y Aprobación App Store / Play Store
- **Fullscreen de Borde a Borde en Smartphone**:
  - Viewport con `viewport-fit=cover`, contenedor `fixed inset-0` (`100dvh`), y configuración PWA `fullscreen` / `standalone`.
  - Respeto de áreas seguras (`env(safe-area-inset-top)` y `env(safe-area-inset-bottom)`) para el *Notch* / *Dynamic Island* y la barra inferior.
- **Cero Comportamiento de Página Web (Cumplimiento Regla 4.2 de Apple)**:
  - `touch-action: none`, `overscroll-behavior: none`, `user-select: none` y bloqueo de zoom/menú contextual para que arrastrar piezas con el dedo se sienta 100% nativo.
- **100% Offline-First**:
  - Todo el motor 3D, materiales y audio funcionan en local sin internet (supera las pruebas en Modo Avión de los revisores de Apple y Google).
- **Listo para Tiendas (Capacitor)**:
  - Preparado para exportar a Android Studio (`.aab`) y Xcode (`.ipa`) con orientación vertical bloqueada.

---

## 7. Feedback Visual "Estilo Cómic" (~1s) en Desbloqueos y Muertes de Logro
- **Carteles de Impacto Estilo Cómic (1 Segundo)**:
  - Cada vez que se desbloquea un **nuevo objeto/arma** o se consigue una de las **3 formas de matar a un enemigo (Logro 1★ / 2★ / 3★)**, salta una animación **estilo cómic muy vistosa de ~1 segundo de duración**.
  - **Diseño**: Bocadillo de explosión (*starburst*) con borde negro grueso, tipografía de cómic inclinada a todo color con contorno (`¡NUEVA ARMA!`, `¡GOLPE MAESTRO 3★!`, `¡DESBLOQUEADO!`), trama *halftone*, icono del premio y sonido triunfal sin interrumpir el flujo de la partida.

---

## 8. El Core Jugable: Frenesí de Matar + Tiempo de Avance + Pensar Cómo Hacerlo
La clave del *engagement* está en mezclar tres elementos al mismo tiempo:
1. **El Frenesí de Matar**: Acción constante, lluvias *Bullet Hell*, cadenas de bajas y carteles de cómic de ~1s que recompensan cada acierto.
2. **El Tiempo Mientras Avanzan (Reloj Espacial)**: El desplazamiento del bicho bajando por las 6 filas del raíl es tu cuenta atrás visual. Tienes esos segundos exactos mientras avanza para reaccionar.
3. **Pensar Cómo Hacerlo Bajo Presión**: En esa ventana de segundos mientras el enemigo avanza, decides si limpiarlo de forma estándar para sobrevivir o reordenar tus piezas con el pulgar para ejecutar una de las **3 formas de matarlo** y sacar el logro/premio antes de que cruce la casilla clave.

---

## 9. Ajustes de Product Manager Móvil (Ergonomía del Pulgar, Slow-Mo y Swap)
1. **Regla 70/30 contra el "Pulgar Frenético"**:
   - La formación base limpia de forma semi-automática el 60–70% de los enemigos básicos. El jugador solo mueve piezas cada 4–6 segundos para responder a enemigos especiales o preparar la Muerte 3★.
2. **"Tiempo Bala Táctico" (Slow-Mo al 30% al arrastrar) + Elevación sobre el Pulgar**:
   - Al tocar y arrastrar una pieza, el tiempo se ralentiza al **25–30% durante un máximo de 1.5–2s** (compensando la oclusión del dedo en pantalla vertical) y vuelve al **100% de golpe al soltarla**, disparando la adrenalina del *Bullet Hell*.
3. **Swap Directo entre Casillas Ocupadas**:
   - Soltar una pieza sobre otra ocupada intercambia ambas posiciones al instante (*Swap*), evitando pasos extra para hacer hueco.
4. **Ventana de Tiempo Calibrada (~1.5s por fila + 1.5–2s de Preaviso Superior)**:
   - Los bichos especiales avisan en la rejilla superior 1.5–2s antes de entrar a la Fila 1 y tardan ~1.5s por fila (~9s en cruzar el tablero), dando tiempo real pero tenso para montar combos de 3 piezas.

---

## 10. Dirección de Arte 3D: "Tactile Toy-Kitchen 3D" y Arquitectura Visual
1. **Estética y Cámara Diorama (65°–70°)**:
   - Materiales PBR táctiles (madera torneada, acero cepillado, esmalte retro, cristal y cobre) con geometría biselada, luz cálida *"Mañana de Domingo"* (`#FFF3D6`), rebote crema (`#FFE4C4`) y motas de harina flotando en el aire.
2. **Las 3 Zonas Físicas de la Pantalla Vertical**:
   - **Arriba (Fila 0 — Salpicadero y Rejilla de Cobre)**: Pared de azulejos crema/menta donde asoman las antenas y ojos de los bichos 1.5s antes con alerta luminosa en el raíl.
   - **Centro (Filas 1 a 6 — Encimera de Carnicero 4×6)**: Bloque de roble con 4 canaletas talladas y rieles de latón, tacos con variación sutil del 5% y barra imantada con línea de harina como frontera del Bastión.
   - **Abajo (El Chef Bastión 3D + Bandeja de Inoxidable)**: Chef expresivo que sigue tu dedo, reacciona al peligro, celebra los `¡3★!` y muestra el Pelo/Gorro y Armadura equipados, sobre la bandeja metálica de reserva.
3. **Los 4 Mundos / Cocinas**:
   - **Mundo 1**: *La Encimera Soleada* (Madera cálida y cobre — raíles estándar).
   - **Mundo 2**: *El Interior de la Nevera* (Nivel Especial Secreto — baldas de cristal y escarcha cian, deslizamiento doble).
   - **Mundo 3**: *Los Fogones de Hierro* (Hierro fundido y brasas — casillas que sobrecargan utensilios de calor).
   - **Mundo 4**: *El Obrador de Pastelería* (Mármol blanco y caramelo dorado — zonas pegajosas que frenan enjambres).
4. **Siluetas de Utensilios y Plagas Cartoon ("Cero Grima")**:
   - **Utensilios**: *Pimentero Ametralladora* (madera rojiza + manivela de latón), *Rallador Prisma* (pirámide de acero que parte balas en 5), *Bobinas Tostadoras* (esmaltadas crema/rojo con arco incandescente), *Pastilla de Mantequilla* (a 45° con flecha tallada), *Batidora Vórtice 360°* (vaso de cristal y aspas).
   - **Plagas**: *Hormigas Velocistas* (canicas negras brillantes con casco de miga), *Escarabajos Chapa* (caparazón azul metálico con chapa de botella frontal que rebota balas con *¡CLINK!*), *Avispas Bombarderas* (disparan gotas moradas/verdes en contraste con tus balas amarillas/cian).
5. **El "Circuito Culinario"**:
   - Durante el *Slow-Mo* al arrastrar, los surcos de la madera se iluminan según el combo (Amarillo = Línea, Naranja = Puente Tostador, Cian = Desvío) y al hacer *snap* sueltan una nubecita de harina con bote sincronizado.

---

## 11. Arsenal Definitivo: "Higiene Letal y Desinfección Extrema"
Un giro de humor gamberro y altísimo contraste visual (líquidos azul eléctrico, amarillo lejía, rosa jabón y espuma blanca sobre la madera cálida):

1. **Piezas y Combos de Higiene Letal**:
   - **Emisores Base**: *Spray "Flus-Flus" Táctico* (pistola limpiacristales azul con gatillo rojo rápido) y *Cañón de Lejía "Don Limpio Nuclear"* (garrafa amarilla pesada).
   - **Multiplicador en Línea**: *Estropajo Doble Cara (Amarillo/Verde)* — al recibir el chorro del Spray desde atrás, genera espuma y dispara un abanico *Bullet Hell* de **5 burbujas químicas explosivas**.
   - **Puente Horizontal**: *Aerosoles "Mata-Todo 3000" / Tubos UV* — en raíles vecinos crean un arco incandescente o láser ultravioleta (`¡BZZZT!`) que funde las chapas de botella de los escarabajos.
   - **Trampa de Desvío**: *Pastilla de Jabón "Resbalón Mortal"* (rosa chicle a 45° con señal de *"¡Piso Mojado!"*) — pone patines de espuma al bicho (`¡Wiii-plop!`) y lo lanza al carril vecino.
   - **Vórtice 360°**: *Fregona "Turbo-Spin" 3.000 RPM* — centrifuga al bicho que le llega resbalando y dispara una espiral *Bullet Hell* de 360° de detergente.
   - **Muro Reflector**: *Pastilla WC "Frescor Atlántico"* — rebota los proyectiles enemigos convertidos en pompas aliadas.
2. **Carteles Cómic de ~1s por Tipo de Muerte**:
   - **1★**: `¡DESINFECTADO! 1★`
   - **2★**: `¡EXFOLIACIÓN LETAL! 2★`
   - **3★**: `¡LIMPIEZA PROFUNDA 3★!` (con destello y sonido `¡DING!` de anuncio de televisión).
3. **Premios de Logros y Tienda por Estancamiento (Cosméticos 3D y Armas Élite)**:
   - **Gorros/Pelos**: Gorro Chef $\rightarrow$ Gorro de ducha con patito de goma $\rightarrow$ Barreño militar $\rightarrow$ Máscara antigás con rollos de papel higiénico.
   - **Armaduras**: Delantal $\rightarrow$ Traje EPI amarillo químico $\rightarrow$ Peto de estropajos dorados con hombreras de cepillos.
   - **Armas Especiales**: *Hidrolimpiadora "Kärcher"*, *Bomba de Bicarbonato + Vinagre*, y el *Robot Aspirador (Roomba) Kamikaze con cuchillos pegados con cinta aislante*.
