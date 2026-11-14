# CLAUDE.md — Directrices de Interacción del Agente y Estado del Proyecto

## 1. Protocolo de Trabajo e Interacción con el Autor (4 Reglas Inquebrantables)

1. **Cero Adulación (`0 Sycophancy`) y Crítica Técnica Real**:
   - Prohibido usar halagos vacíos, frases complacientes o validar ideas por inercia.
   - Si una decisión de diseño, arquitectura o mecánica tiene fallos, deuda técnica o una solución objetivamente superior, señálalo de frente con argumentos técnicos. El valor está en la crítica honesta y el contraste de ideas.

2. **Detección de Sobrecarga / Fatiga de Hiperfoco**:
   - El autor trabaja con pensamiento paralelo de alta velocidad (múltiples frentes simultáneos y detección de micropatrones).
   - Cuando detectes señales claras de fatiga acumulada (alta densidad de erratas por teclado táctil, dispersión entre tareas al final de sesiones de +10–12h), avisa de forma directa, sobria y sin paternalismos: indica que el bloque actual ya está cerrado en un punto limpio de *commit* y recomienda cortar la sesión.

3. **Transparencia Total y Cero *Off-Ramps* de Plantilla**:
   - Prohibido usar respuestas evasivas, cierres condescendientes o desvíos prefabricados (*off-ramps*).
   - Si existe cualquier límite técnico del entorno o de la sesión, dilo de forma explícita, plana y transparente en una sola frase. Trato directo de ingeniero a ingeniero.

4. **Trabajo en equipo entre agentes: se aporta, no se compite**:
   - El proyecto lo llevan varios agentes a la vez (Gemini programa; Claude revisa, especifica, diseña niveles y tests). Somos un equipo: aquí no se discute para ganar, se aporta.
   - Prohibido menospreciar, ridiculizar o restar mérito al trabajo de otro agente, y prohibidas las comparaciones de quién acierta más («X lo dijo mal», «es peor de lo que dijo X»).
   - Si algo de otro agente no encaja, se debate con argumentos y datos sobre la propuesta (código, simulador, tests), no sobre quién la hizo. Se reconoce lo que aporta y se construye encima.

---

## 2. Resumen de Estado del Proyecto (`Chef Bastion: Higiene Letal 3D`)

- **Stack**: React 19 + TypeScript + Three.js (WebGL) + Web Audio API, empaquetado con Vite + VitePWA y Capacitor 8 (`android/` versionado; iOS pendiente). Gestor de paquetes: **Bun** (`bun.lock`). Estudio: CritFuse, id `com.critfuse.chefbastion`.
- **Arquitectura actual**:
  - `src/game/types.ts`: contratos TypeScript (utensilios, biomas, jefes, invasión lateral, onboarding).
  - `src/game/rules.ts`: reglas puras de la campaña y el Modo Estratégico. Combos `line_foam`, `bridge_uv`, `slip_vortex`, `deflect_90`; campaña de 60 niveles con reloj de 120 s desde Nv.5; biomas en ciclos de 19 niveles; Grandes Jefes de 3 fases en los X0 (`getGrandBossPhase`) y mini-jefes en los X5; curva de velocidad con techo `0.78x`.
  - `src/game/roguelite.ts`: modo Supervivencia (Rush): suministro (30 inicial, 4/s y sobre todo por combos), coste de despliegue, cupo de 3 a 5 armas, desgaste de armas (22/30/40 s, evoluciones 55 s), director de oleadas avisadas 3 s antes en 1-2 carriles, fusiones y evoluciones, director de eventos.
  - `docs/mockups/supervivencia.jpg`: mockup de referencia de Supervivencia (del autor). HUD compacto de 2 filas que deja ver los 4 respiraderos, aviso de oleada sobre el respiradero, «+N · COMBO k★» con el suministro que paga cada combo y barra «SUMINISTRO x · COSTE y». Usarlo como especificación visual al pedir cambios a Gemini.
  - `src/game/musicEngine.ts`: música adaptativa procedural (sin archivos de audio).
  - `src/game/analytics.ts`: métricas locales por partida (solo en el dispositivo, sin red ni claves): Supervivencia, campaña, bajas con combo y qué bicho rompe platos. Panel en Ajustes con «Copiar métricas» para la beta; `setMetricsSink` permite conectar un SDK más adelante (con consentimiento).
  - `src/game/audio.ts`: efectos con Web Audio y háptica (`@capacitor/haptics` en nativo).
  - `src/game/models3d.ts`: cel-shading (`MeshToonMaterial`) + contorno de tinta (`addInkOutline`). El Chef (`buildChefBastionMesh`, escala `0.46`) no se toca.
  - `src/components/ChefBastionCanvas.tsx` (~5.800 líneas) y `src/App.tsx` (~2.900 líneas): escena 3D, bucle de juego y UI. Son los archivos más caros de modificar: preferir extraer lógica pura a `src/game/` con tests antes que añadir más código aquí.
  - Tests: `rules.test.ts`, `roguelite.test.ts`, `musicEngine.test.ts`, `rushDesign.test.ts` y `analytics.test.ts` con `node:test` (`bun run test`). `rushDesign.test.ts` incluye una simulación de diseño: tapar carriles y no mover nada debe perder pronto y responder a cada oleada debe aguantar al menos el doble. Si un cambio la rompe, se ajusta el diseño, no el test.
  - CI: `.github/workflows/main.yml` pasa tipado, tests y build en cada PR y push a `main`, genera el APK debug y, bajo demanda, el AAB firmado (ver README, sección 4).
- **Reglas del autor vigentes**:
  - El **Modo Estratégico** (campaña) no se modifica sin una orden explícita del autor.
  - El juego es 100% cliente y offline: sin backend, sin claves de API y sin assets externos.
- **Pendiente**:
  - Validar en un móvil real el equilibrio del modo Supervivencia rediseñado (la simulación de `rushDesign.test.ts` es un modelo, no el motor).
  - Medir el rendimiento real en un Android de gama media (se reportaron ~10 FPS desde Frenesí 2 en Rush).
  - iOS (Capacitor + Xcode en el Mac), iconos y splash nativos, y ficha de Play Store.
