# Bichos nuevos del Modo Estratégico (Nv.16–60)

Fichas para aprobar. Sin código. Al aprobarlas, el modelo 3D de cada bicho va en `src/game/models3d.ts`. Su comportamiento, el simulador (`strategicSim.ts`) y los guiones (`strategicScripts.ts`) se implementan aparte, y cada nivel se valida con los tests.

Notación: carril **C1–C4** y fila **F1–F7**, como en las fichas de nivel. F1 es la fila de los respiraderos y F7 la del Chef; las armas solo se colocan en F3–F7. Velocidades en **filas/s base**: el motor las multiplica por la curva del nivel (×0,64 en el Nv.17, ×0,78 en el Nv.60) y por el bioma (Comedor ×0,88, Barra ×1,04, Congelador ×1,06). Números de combate: `src/game/combatTuning.ts`. Todos los números de las fichas son orientativos y deben medirse en el simulador antes de cerrar cada guion.

**Armas nuevas: ninguna.** Las 15 respuestas salen de las 8 armas actuales: usos que todavía no se enseñan (Fregona sola, Aerosol sin pareja, Gel WC como cebo, Escuadra como tope, Flus-Flus sin Estropajo, Lejía sin Estropajo) y combinaciones nuevas de dos respuestas que ya existen.

## 1. Calendario

Con un bicho nuevo cada 2–3 niveles, 3 niveles seguidos por bicho y ningún debut en un X0, solo hay dos opciones:
- **A (la de este documento):** dos bichos debutan en un nivel de mini-jefe (25 y 45). Son de respuesta simple, salen solos los primeros 15 s y el mini-jefe entra después.
- **B:** ningún debut en jefes. Entonces el último bicho nuevo entra en el 52 y los niveles 55–59 se quedan sin bicho nuevo.

Elegir A o B es decisión del autor.

| # | Bicho | Niveles | Cómo se mata | Silueta / color a 48 px |
|---|---|---|---|---|
| 1 | Gorgojo del Arroz | 17–19 | Fregona sola dentro de su túnel | Carbón con trompa larga; enterrado, montículo de arroz |
| 2 | Cigarrita Espumosa | 19–21 (20 gran jefe) | Flus-Flus **sin** Estropajo | Bola de espuma blanca con cabeza lima |
| 3 | Lepisma (Pececillo de Plata) | 22–24 | Aerosol UV suelto (linterna) + abanico | Lágrima plateada y semitransparente con 3 colas |
| 4 | Palomita Rebelde | 25–27 (25 mini-jefe, debut) | Lejía **sin** Estropajo + abanico para las palomitas | Grano amarillo limón con punta blanca |
| 5 | Cochinilla Bola | 28–30 (30 gran jefe) | Escuadra como tope + Flus-Flus | Cúpula a franjas añil; enroscada, bola |
| 6 | Caracol Cazuelo | 31–33 | Flus-Flus + Gel WC delante (rebote doble) | Concha de cazo de cobre con mango negro |
| 7 | Mancha de Aceite | 34–36 (35 mini-jefe) | Jabón (la emulsiona) + abanico | Charco plano verde oliva con brillo |
| 8 | Chipirón en su Tinta | 37–39 | Fregona como limpiadora + abanico | Cono rosa claro con tentáculos y manchas negras |
| 9 | Moscardón Verde | 39–41 (40 gran jefe) | Gel WC como cebo + puente UV | Mosca esmeralda metálica, ojos rojos, vuela alto |
| 10 | Bayeta Mohosa | 42–44 | Empapar arriba (abanico) + puente UV debajo | Cuadrado lila grisáceo con moho verde |
| 11 | Pulgón Mutante | 45–47 (45 mini-jefe, debut) | Estropajo con Flus-Flus **y** Lejía detrás | Pera lima con manchas moradas y 2 tubitos |
| 12 | Ermitaño de Lata | 48–50 (50 gran jefe) | Escuadra + Lejía debajo | Lata plateada de etiqueta roja con pinzas |
| 13 | Chinche Arlequín | 51–53 | Gel WC sobre el Jabón + Jabón→Fregona | Escudo pentagonal rojo y negro |
| 14 | Escarabajo Olla Exprés | 54–56 (55 mini-jefe) | Gel WC delante de Lejía tras Estropajo | Olla de acero con asas rojas y válvula |
| 15 | Grillo del Extractor | 57–59 | Escuadra + Jabón debajo + Fregona al lado | Oliva grasiento con patas traseras enormes |

El Nv.60 (gran jefe final) queda sin bicho de escolta propio en las dos opciones.

## 2. Tipos de daño (para las reglas de los bichos)

| Fuente | Tipo |
|---|---|
| Gota del Flus-Flus (sin pasar por el Estropajo) | agua |
| Burbuja del abanico (Flus-Flus + Estropajo) | agua · espuma |
| Fregona (remolino y contacto) | agua · espuma · empuje |
| Chorro de Lejía | calor · empuje |
| Espuma corrosiva (Lejía + Estropajo) | calor · espuma |
| Puente UV | calor seco (zona, sin proyectil) |
| Pompa devuelta por el Gel WC | calor |
| Jabón, Escuadra | control, sin daño |

La ola de lejía al perder un Sello lo mata todo (999). Si la Ultimate sigue llenándose en 3 bajas, también se salta cualquiera de estas respuestas: hay que decidir antes qué hace la Ultimate en el Estratégico.

## 3. Fichas

### 1. Gorgojo del Arroz · Nv.17–19
- **Aspecto:** escarabajo carbón (#2B2B2B) con una trompa curva muy larga y antenas acodadas. Mientras está enterrado solo se ve un montículo de granos de arroz (#F5F0E1) que avanza por el carril. Es el único bicho con trompa.
- **Comportamiento:**
  - Vida 90.
  - Baja **enterrado** de F1 a F5 a 0,45: los proyectiles y el puente UV le pasan por encima, y el Jabón no lo toca.
  - **Asoma al llegar a F5** y corre a 1,2 hasta los platos, agarrado al suelo (no se le puede empujar).
  - Si pasa enterrado por la casilla de una Fregona, el remolino lo desentierra: sale **aturdido 1,5 s** en esa casilla y ya se queda en superficie.
- **Cómo se mata:** una Fregona en su carril, entre F3 y F5. Durante el aturdimiento recibe 65/s de contacto (≈97) más los disparos del remolino, por encima de 90.
- **Qué NO lo mata:**
  - **Abanico:** solo puede darle entre F5 y el Estropajo, menos de 1 s (≈32 de daño).
  - **Flus-Flus o Lejía en F7:** ≈1,7 s de ventana; 28 y 60 de daño.
  - **Puente bajo F5:** 0,6 filas a 0,77 filas/s, ≈37.
  - **Fregona en superficie (bajo F5):** sin aturdimiento, ≈76.

### 2. Cigarrita Espumosa · Nv.19–21
- **Aspecto:** bola grumosa de espuma blanca, más grande que la hormiga, con una cabecita lima (#A3E635) de ojos rojos asomando. Es el único bicho blanco y redondo.
- **Comportamiento:**
  - Vida 50 bajo una **capa de espuma de 60**, a 0,40.
  - Cualquier **espuma** que la toca (abanico, espuma corrosiva, Fregona) **suma +8 a la capa**, hasta 120, en vez de quitarle vida.
  - Las **gotas de agua** (Flus-Flus que no pasa por un Estropajo) quitan 28 de capa cada una: el agua deshace la espuma.
  - El **calor** no le hace nada mientras le quede capa: la espuma aísla.
  - Sin capa, todo le daña normal.
- **Cómo se mata:** un Flus-Flus sin Estropajo en su carril. Son 3 gotas para quitar la capa y 4 más para la vida (≈11,5 s), con ≈27 s de margen hasta los platos. Una vez sin capa, puede rematarla otra arma.
- **Qué NO lo mata:**
  - **Abanico:** la cura. Un Flus-Flus detrás de un Estropajo convierte sus gotas en espuma.
  - **Lejía + Estropajo, Fregona, Jabón→Fregona:** espuma.
  - **Puente, Lejía, Gel:** aislada.

  Obliga a sacar el abanico de su carril y de los vecinos.
- **Nv.19:** coincide con el Gorgojo, que pide una Fregona. La Fregona es espuma, así que hay que separarla de la Cigarrita.

### 3. Lepisma (Pececillo de Plata) · Nv.22–24
- **Aspecto:** lágrima aplanada plateada-azulada (#A9C1D9) con 3 colas finas y 2 antenas largas. Al 45 % de opacidad mientras no está iluminada; opaca y brillante cuando la ilumina un Aerosol.
- **Comportamiento:**
  - Vida 50, rápida (0,80).
  - **Intangible** (proyectiles y puente la atraviesan) salvo cuando está **iluminada**.
  - Un **Aerosol UV sin pareja** ilumina su propio carril, desde su fila hacia arriba hasta F1.
  - Dos Aerosoles en puente gastan la luz en el láser y **no iluminan**.
- **Cómo se mata:** un Aerosol suelto en su carril, en F3–F4, más el abanico en ese carril o en el vecino. Iluminada pasa ≈5 s; el abanico la mata en ≈2 s.
- **Qué NO lo mata:**
  - **Abanico solo:** la atraviesa.
  - **Puente UV:** no ilumina y no la toca.
  - **Aerosol solo:** no hace daño.

  Es la lección que falta en la captura de Supervivencia del autor: un Aerosol suelto ya tiene función.

### 4. Palomita Rebelde · Nv.25–27 (debut en el mini-jefe del 25)
- **Aspecto:** grano de maíz amarillo limón (#FDE047) con la punta blanca y patitas. Al calentarse se pone rojo y tiembla; al explotar suelta palomitas blancas.
- **Comportamiento:**
  - A 0,50, con una **cáscara inmune a todo daño** y empujable.
  - Lleva una **mecha de 10 s** desde que entra en el tablero.
  - Cada chorro de Lejía, cada pompa del Gel y cada 0,5 s dentro del puente UV le **restan 2 s de mecha**. La espuma no cuenta, ni siquiera la corrosiva: no concentra el calor.
  - Con la mecha a 0, **¡POP!**:
    - Pringa 5 s las armas a 1 casilla.
    - Suelta 3 palomitas (vida 16, a 1,0) que bajan rectas por su carril y los dos vecinos.
    - La explosión cuenta como baja.
  - Si explota en F1–F2 no pringa nada (ahí no hay armas).
- **Cómo se mata:** Lejía sin Estropajo en su carril (F6–F7). La calienta y la empuja una fila cada 1,55 s, así que explota en F1–F2 a los ≈4,5 s. Un abanico más abajo limpia las palomitas.
- **Qué NO lo mata:**
  - **Abanico:** no la daña. Llega a F4 al acabar la mecha y explota encima del Estropajo.
  - **Lejía + Estropajo:** la Lejía sale como espuma, no calienta y no empuja.
  - **Puente:** la acelera justo en la fila de los Aerosoles y explota entre ellos.

### 5. Cochinilla Bola · Nv.28–30
- **Aspecto:** cúpula segmentada a franjas añil (#4338CA / #6366F1). Enroscada, una bola añil a rayas: no hay otra esfera de color en el juego.
- **Comportamiento:**
  - Vida 80, andando a 0,40.
  - Al **primer impacto de lo que sea se enrosca**: bola **invulnerable** que **rueda recta a 1,0**.
  - Rodando ignora el Jabón, la Fregona y los empujes, y arrolla las armas de su carril (las pringa 2 s).
  - Si choca con una **Escuadra** en su carril (la esquina de 90° la frena), se desenrosca **aturdida 3 s** y ya no vuelve a enroscarse.
- **Cómo se mata:** Escuadra en su carril (F3–F5) y cualquier disparo debajo, Flus-Flus o abanico. El primer impacto la enrosca arriba, rueda hasta la Escuadra y después baja andando despacio por la línea de fuego.
- **Qué NO lo mata:**
  - **Abanico solo:** la enrosca y la bola llega a los platos en ≈10 s.
  - **Puente, Jabón→Fregona, Lejía:** la bola es inmune.
  - **Escuadra + puente debajo (respuesta de la hormiga de conducto):** el puente la enrosca después de la Escuadra.

### 6. Caracol Cazuelo · Nv.31–33
- **Aspecto:** caracol verde oliva pálido (#A3B18A) bajo una concha de cazo de cobre (#C2410C) con el mango negro saliendo de lado. Cúpula más mango: silueta única.
- **Comportamiento:**
  - Vida 135, lento (0,30).
  - La concha **refleja todo proyectil que le llega desde abajo** (gotas, burbujas, chorros): el proyectil vuelve en sentido contrario y pringa 3,5 s la primera arma que toca, como el ácido.
  - La **pompa del Gel no rebota**: le entra (45, calor).
  - Mientras está sobre la casilla de un arma o dentro de un puente, **se encierra y es inmune**.
- **Cómo se mata:** Flus-Flus solo con el Gel WC delante, en el mismo carril (por ejemplo, Gel en F4 y Flus-Flus en F6). La gota rebota en la concha, choca con el Gel y vuelve como pompa de 45. Con 3 rebotes muere (≈5 s), antes de llegar al Gel (tiene ≈15 s).
- **Qué NO lo mata:**
  - **Abanico o Lejía + Estropajo:** sus 5 burbujas vuelven y pringan el Estropajo y el Flus-Flus. La respuesta de siempre castiga.
  - **Puente, Jabón→Fregona:** encerrado.
  - **Gel solo:** no hay nada que devolver.

### 7. Mancha de Aceite · Nv.34–36
- **Aspecto:** charco plano y ondulante verde oliva dorado (#A3A635) con un brillo blanco y dos ojos. Sin patas: es la única silueta de disco.
- **Comportamiento:**
  - Vida 70, a 0,55.
  - El **agua resbala**: gotas, burbujas y Fregona no le hacen nada.
  - Al pasar por un **Jabón** queda **emulsionada**: no se desvía (es líquida y sigue recta), frena 2,6 s y desde ese momento el agua le hace daño normal.
  - El **calor la fríe**: no le hace daño, salpica (pringa 2,5 s las armas a 1 casilla) y acelera ×1,4 durante 3 s.
- **Cómo se mata:** un Jabón alto en su carril (F3) y el abanico bajo (Estropajo en F6, Flus-Flus en F7). Ya emulsionada recorre ≈7 s de fuego; necesita ≈3. También vale una Fregona en su carril después del Jabón.
- **Qué NO lo mata:**
  - **Abanico solo:** resbala.
  - **Lejía + Estropajo, puente, Gel:** salpica y acelera.
  - **Jabón→Fregona al lado (respuesta de la cucaracha):** el Jabón no la desvía, así que nunca llega a la Fregona vecina.

### 8. Chipirón en su Tinta · Nv.37–39
- **Aspecto:** cono rosa claro (#FBCFE8) con manchas de tinta negra y 6 tentáculos cortos (son sus `anim_legs`), con la punta hacia arriba.
- **Comportamiento:**
  - Vida 90, anda a 0,42.
  - Se agarra con ventosas: **Jabón y Fregona no le hacen nada** (ni daño, ni empuje, ni desvío).
  - Entre F1,5 y F4,6 suelta **tinta en abanico de 3 cada 2,0 s**: por su carril y en diagonal hacia los dos vecinos.
  - La tinta mancha **6 s** la primera arma que encuentra en cada trayectoria. El Gel WC también se mancha: la tinta no rebota.
  - Una **Fregona friega**: las armas manchadas o pringadas en las 8 casillas de su alrededor, y la propia Fregona, quedan limpias a los 0,5 s.
- **Cómo se mata:** abanico más una Fregona pegada a él (por ejemplo, Estropajo en C2F4, Flus-Flus en C2F6 y Fregona en C3F5). El abanico solo se para 0,5 s de cada 2.
- **Qué NO lo mata:**
  - **Abanico solo:** el Estropajo pasa todo el rato manchado.
  - **Abanico desde el carril de al lado (lección del Nv.9):** la tinta diagonal también lo alcanza.
  - **Gel:** se mancha.
  - **Puente:** se mancha el Aerosol de su carril y se corta.
  - **Jabón→Fregona:** ventosas.

### 9. Moscardón Verde · Nv.39–41
- **Aspecto:** mosca gorda verde esmeralda metálico (#16A34A con emisivo) de ojos rojos enormes y alas grandes. Vuela más alto que la avispa: el modelo va más arriba y la sombra es más pequeña.
- **Comportamiento:**
  - Vida 90, baja a 0,55.
  - **Vuela alto:** todos los proyectiles le pasan por debajo y el Jabón y la Fregona no lo tocan. Solo le daña el **láser del puente UV**.
  - Hace un zigzag fijo: cambia de carril cada 1,0 s (rebota en los bordes) y cruza la franja del puente en menos de 0,6 s (≈24 por cruce).
  - **El Gel WC lo atrae.** Si hay uno sin pringar a 2 carriles o menos, deja el zigzag, se pone en su carril, en la fila justo encima del Gel, y se queda **4 s chupando** (ese Gel no funciona mientras). Después baja recto.
  - Si hay varios Geles, va al más cercano; si empatan, al de la izquierda.
- **Cómo se mata:** Gel WC como cebo (por ejemplo, en F5) y un puente UV en la fila de encima (F4) que cubra ese carril: 48 × 4 s = 192.
- **Qué NO lo mata:**
  - **Abanico, Lejía, Flus-Flus:** vuela alto.
  - **Puente solo:** con el zigzag solo lo cruza una vez (≈24).
  - **Gel solo:** no hace daño, y el moscardón no escupe (no es la avispa).

### 10. Bayeta Mohosa · Nv.42–44
- **Aspecto:** cuadrado de tela lila grisáceo (#7C6F91) con manchas de moho verde (#65A30D), 4 esquinas que hacen de patas y ojos. Silueta de cuadrado plano.
- **Comportamiento:**
  - Vida 150. Seca es rápida (0,70).
  - **Absorbe los líquidos:** agua, espuma, Lejía y Fregona no le hacen daño, pero **cada impacto la empapa**: velocidad ×0,8 acumulable, hasta ×0,2. No se seca sola.
  - Solo la daña el **calor seco del puente UV** (48/s).
- **Cómo se mata:** empaparla arriba y quemarla abajo. Primero un abanico alto (Estropajo en F3–F4) con ≈8 impactos; después, un puente en F6–F7 sobre sus carriles. Empapada al máximo pasa ≈5,7 s en la franja (≈270).
- **Qué NO lo mata:**
  - **Puente solo:** seca cruza la franja en ≈1,2 s (≈55).
  - **Abanico solo, Lejía + Estropajo, Fregona:** no le hacen daño.
  - **Puente arriba y abanico abajo (respuesta de la rata, orden contrario):** pasa seca por el puente y se empapa cuando ya no queda calor debajo.

### 11. Pulgón Mutante · Nv.45–47 (debut en el mini-jefe del 45)
- **Aspecto:** cuerpo de pera lima (#BEF264) con manchas moradas (#9333EA), 2 tubitos traseros y un brillo «radiactivo».
- **Comportamiento:**
  - Vida 150, a 0,50. No se le puede empujar: se agarra con los tubitos.
  - **Se hace inmune al último tipo de daño que le ha tocado** (agua o calor; tabla del punto 2) **hasta que le toca el otro tipo**.
- **Cómo se mata:** que los dos tipos se alternen. La forma natural es un Estropajo con el Flus-Flus y la Lejía detrás, a 1–2 filas (por ejemplo, Estropajo en F5, Lejía en F6 y Flus-Flus en F7). Sale espuma de agua cada 0,6 s y corrosiva cada 0,85 s, alternadas: ≈35/s mientras está por encima del Estropajo. También vale la Lejía en su carril más el abanico en el vecino.
- **Qué NO lo mata:**
  - **Abanico o Lejía + Estropajo solos:** un impacto y se acabó.
  - **Puente + abanico (respuesta de la rata):** solo se alternan dentro de la franja, ≈1,6 s.
  - **Lejía sin Estropajo:** un solo tipo, y no lo empuja.

### 12. Ermitaño de Lata · Nv.48–50
- **Aspecto:** lata de atún plateada-azulada (#94A3B8) con etiqueta roja; asoman 2 pinzas rojas, patitas y ojos en pedúnculos. Cilindro bajo y ancho.
- **Comportamiento:**
  - Vida 160.
  - Entra por un **conducto lateral** en F4 o F5 y **cruza andando de lado** (×1,2 en lateral, mucho más lento que la hormiga de conducto, que va a ×4).
  - Al llegar al borde contrario no baja: **se da la vuelta y cruza otra vez una fila más abajo**, como un invasor, hasta pasar de F7.
  - La lata **refleja el agua y el UV**: todo lo que no sea Lejía (chorro o espuma corrosiva) le hace un 20 %.
- **Cómo se mata:** una Escuadra en su fila lo endereza hacia abajo por ese carril y una Lejía debajo, en el mismo carril, lo funde y lo frena con el empuje. Puede ir con o sin Estropajo.
- **Qué NO lo mata:**
  - **Escuadra + puente (respuesta de la hormiga de conducto):** 20 % (≈10/s).
  - **Lejía + Estropajo sin Escuadra (respuesta del cangrejo):** solo le da al cruzar ese carril, ≈1–2 impactos por pasada.
  - **Abanico:** 20 %.

### 13. Chinche Arlequín · Nv.51–53
- **Aspecto:** escudo pentagonal plano rojo (#DC2626) con dibujo negro de arlequín. Pentágono de color: único.
- **Comportamiento:**
  - Vida 120, anda a 0,55.
  - Hace **zigzag entre dos carriles cada 2,4 s**, como la cucaracha.
  - Mientras está entre F1,5 y F4,6, **cada vez que cambia de carril suelta una nube** que baja por el carril nuevo (3 filas/s) y pringa **4 s** la primera arma que toca.
  - El Gel WC devuelve la nube (45, calor). El Jabón la clava y la desvía hacia la Fregona, como a la cucaracha.
- **Cómo se mata:** un Gel WC encima del Jabón, en el mismo carril, para que la nube no lo pringue, y la Fregona fuera de los dos carriles del zigzag (al otro lado del Jabón).
- **Qué NO lo mata:**
  - **Jabón→Fregona (respuesta de la cucaracha):** la nube pringa el Jabón y la Chinche pasa de largo.
  - **Gel solo:** ≈2 nubes en su carril, ≈90.
  - **Abanico:** zigzag y nubes sobre el Estropajo.

### 14. Escarabajo Olla Exprés · Nv.54–56
- **Aspecto:** olla de acero (#CBD5E1) con dos asas rojas, tapa con válvula amarilla y patas cortas; echa vapor por la válvula. Cilindro ancho con asas: silueta única.
- **Comportamiento:**
  - Vida 240, lento (0,36).
  - **Acorazado** como el cangrejo: lo que no es calor le hace un 35 %.
  - Entre F1,5 y F4,6 suelta cada **2,4 s** un chorro de vapor por su carril que pringa 3,5 s la primera arma. El Gel WC lo devuelve (45, calor).
- **Cómo se mata:** Gel WC delante (más arriba) de la Lejía tras el Estropajo. El Gel absorbe el vapor y lo devuelve; la espuma corrosiva le hace daño completo.
- **Qué NO lo mata:**
  - **Lejía + Estropajo (respuesta del cangrejo):** el vapor pringa el Estropajo cada 2,4 s durante 3,5 s, así que no dispara nunca.
  - **Gel solo:** 4–5 chorros de vuelta, ≈200 de 240.
  - **Abanico:** 35 % y pringado.

### 15. Grillo del Extractor · Nv.57–59
- **Aspecto:** grillo oliva oscuro (#3F6212) con brillo de grasa, patas traseras enormes en zigzag y antenas larguísimas.
- **Comportamiento:**
  - Vida 100.
  - Sale del extractor por un **lateral** en F4 o F5 y cruza a ×3. En horizontal salta por encima de las armas (el Jabón no le hace nada) y en el borde vuelve a cruzar una fila más abajo, como el Ermitaño.
  - Si una **Escuadra** lo endereza, baja por ese carril a 0,70, pero **sigue saltando de carril cada 1,6 s** (zigzag) salvo que pise un Jabón, que lo clava y lo desvía hacia la Fregona.
- **Cómo se mata:** la cadena Escuadra → Jabón debajo en el mismo carril (la «trampa» de la Escuadra) → Fregona al lado del Jabón. Es el examen final de control.
- **Qué NO lo mata:**
  - **Escuadra + puente (respuesta de la hormiga de conducto):** el zigzag lo saca de la franja; ≈50 de 100.
  - **Jabón→Fregona sin Escuadra:** en horizontal salta el Jabón.
  - **Abanico:** entra por debajo de casi cualquier Estropajo, así que casi no hay ventana de tiro.
- **Ojo:** los niveles 58–59 son del Congelador, con viento lateral de 0,12. Hay que comprobar cómo afecta ese viento a un bicho que cruza en horizontal antes de cerrar el guion.

## 4. Comprobación cruzada: las respuestas de siempre, solas

✗ = no lo mata solo. ½ = es una parte de su respuesta, pero no basta sola.

| Bicho | Abanico | Puente UV | Jabón→Fregona | Gel WC | Escuadra + trampa | Lejía + Estropajo |
|---|---|---|---|---|---|---|
| Gorgojo | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Cigarrita | ✗ (cura) | ✗ | ✗ (cura) | ✗ | ✗ | ✗ (cura) |
| Lepisma | ½ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Palomita | ✗ | ✗ (explota entre armas) | ✗ | ✗ | ✗ | ✗ |
| Cochinilla | ✗ | ✗ | ✗ | ✗ | ½ (trampa = puente: ✗) | ✗ |
| Caracol | ✗ (castiga) | ✗ | ✗ | ½ | ✗ | ✗ (castiga) |
| Aceite | ½ | ✗ (castiga) | ✗ | ✗ | ✗ | ✗ (castiga) |
| Chipirón | ½ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Moscardón | ✗ | ½ | ✗ | ½ | ✗ | ✗ |
| Bayeta | ½ | ½ | ✗ | ✗ | ✗ | ✗ |
| Pulgón | ½ | ✗ | ✗ | ✗ | ✗ | ½ |
| Ermitaño | ✗ | ✗ | ✗ | ✗ | ✗ | ½ |
| Chinche | ✗ | ✗ | ½ | ½ | ✗ | ✗ |
| Olla Exprés | ✗ | ✗ | ✗ | ½ | ✗ | ½ |
| Grillo | ✗ | ✗ | ½ | ✗ | ½ | ✗ |

## 5. Reglas nuevas del motor y del simulador

Para estimar el coste. Cada regla va en el motor y en `strategicSim.ts` a la vez, como pide `.github/copilot-instructions.md`.

1. **Enterrado:** no colisiona hasta una fila; la Fregona desentierra y aturde (Gorgojo).
2. **Capa de espuma:** la espuma suma capa y la gota de agua la quita (Cigarrita).
3. **Intangible salvo con luz:** cono de un Aerosol sin pareja (Lepisma).
4. **Mecha que acortan los impactos de calor concentrado, explosión que pringa en área y crías** (Palomita).
5. **Enroscarse al primer impacto y tope de Escuadra** (Cochinilla).
6. **Reflejar proyectiles e inmunidad sobre casillas con arma** (Caracol).
7. **Emulsión por Jabón sin desvío y salpicadura térmica** (Aceite).
8. **Tinta en abanico de 3, sin efecto de Jabón ni Fregona, y Fregona que limpia alrededor** (Chipirón).
9. **Vuelo alto, zigzag y atracción por el Gel** (Moscardón).
10. **Empapado acumulable, solo daño por puente** (Bayeta).
11. **Inmunidad al último tipo de daño** (Pulgón).
12. **Cruce lateral que da la vuelta una fila más abajo**, regla común para Ermitaño y Grillo.
13. **Nube al cambiar de carril:** reutiliza el ácido de la avispa y el zigzag de la cucaracha (Chinche).
14. **Vapor periódico:** reutiliza el ácido, más la coraza del cangrejo (Olla Exprés).
