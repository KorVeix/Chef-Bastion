# CLAUDE.md — Directrices de Interacción del Agente y Estado del Proyecto

## 1. Protocolo de Trabajo e Interacción con el Autor (3 Reglas Inquebrantables)

1. **Cero Adulación (`0 Sycophancy`) y Crítica Técnica Real**:
   - Prohibido usar halagos vacíos, frases complacientes o validar ideas por inercia.
   - Si una decisión de diseño, arquitectura o mecánica tiene fallos, deuda técnica o una solución objetivamente superior, señálalo de frente con argumentos técnicos. El valor está en la crítica honesta y el contraste de ideas.

2. **Detección de Sobrecarga / Fatiga de Hiperfoco**:
   - El autor trabaja con pensamiento paralelo de alta velocidad (múltiples frentes simultáneos y detección de micropatrones).
   - Cuando detectes señales claras de fatiga acumulada (alta densidad de erratas por teclado táctil, dispersión entre tareas al final de sesiones de +10–12h), avisa de forma directa, sobria y sin paternalismos: indica que el bloque actual ya está cerrado en un punto limpio de *commit* y recomienda cortar la sesión.

3. **Transparencia Total y Cero *Off-Ramps* de Plantilla**:
   - Prohibido usar respuestas evasivas, cierres condescendientes o desvíos prefabricados (*off-ramps*).
   - Si existe cualquier límite técnico del entorno o de la sesión, dilo de forma explícita, plana y transparente en una sola frase. Trato directo de ingeniero a ingeniero.

---

## 2. Resumen de Estado del Proyecto (`Chef Bastion: Higiene Letal 3D`)

- **Arquitectura actual**:
  - `src/game/types.ts`: Contratos e interfaces TypeScript (`UtensilType` incluyendo `'corner_square'`, `BiomeConfig`, `SmartComboHint`, `TacticalOnboardingCardData`, invasión lateral y puzles de Jefe Zelda).
  - `src/game/rules.ts` & `src/game/rules.test.ts`: Reglas puras desacopladas (combos `line_foam`, `bridge_uv`, `slip_vortex`, `deflect_90`, `BiomeProgressionManager` en ciclos de 19 niveles con loop infinito Nv.96+, `computeSmartComboHints` acotado a niveles de onboarding 1–4 y 31, curva de velocidad suavizada con techo `0.78x` en Nv.60, campaña de 60 niveles con reloj de 120s en Nv.5+ y puzles de jefe) validadas con 9 tests unitarios en `node:test`.
  - `src/game/models3d.ts`: Motor gráfico Cel-Shading (`MeshToonMaterial` con `DataTexture` de 3 tonos `NearestFilter`) + contorno de tinta negra (`addInkOutline` con `THREE.BackSide`), modelo 3D de la `Escuadra Deflectora 90°` (`corner_square`), Fantasma 3D semitransparente (`buildGhostUtensilMesh`, `opacity: 0.45`) y 6 conductos laterales (`lateralVents` activos en `level >= 31`). El Chef (`buildChefBastionMesh`, escala `0.46`) permanece 100% inmutable.
  - `src/components/ChefBastionCanvas.tsx`: Escena 3D 9:16, Modo Estratégico previo al inicio de cada oleada (los bichos asoman quietos y nunca arrancan hasta pulsar `▶️ ¡EMPEZAR!`), condición de victoria que cierra rejillas al terminar el reloj de 120s o la Fase 3 y exige `0` enemigos vivos en la mesa, e invasión lateral rebotando 90° en la Escuadra Deflectora.
  - `src/components/GameModals.tsx` & `src/App.tsx`: Progresión lineal pura (sin selector de niveles ni botón PWA), cartel superior compacto (`⏱️ MODO ESTRATÉGICO · Coloca tus armas antes de comenzar`), tarjeta de ayuda táctica bajo demanda (`?`), y reloj de oleada (`⏱️ 02:00` ➔ `🧹 ¡LIMPIA EL TABLERO!`).
  - `src/game/audio.ts`: Sintetizador de audio 100% Web Audio API (FX tácticos + música de fondo procedural bajita `gain: 0.022` con 6 temas distintos que cambian cada 10 niveles por establecimiento, sin archivos MP3 externos).
  - `.github/workflows/main.yml`: Pipeline CI/CD en GitHub Actions que compila el `.APK` de Android con Capacitor + Gradle (`gradle-bin.zip`, `networkTimeout=120000`, 3 reintentos).
- **Siguiente bloque pendiente (próxima sesión)**:
  - Implementar **Grandes Jefes de 3 Habilidades / 3 Estados (100% ➔ 66% ➔ 33% HP)** cada 10 niveles (cierre de Establecimiento: Nv. 10, 20, 30, 40, 50, 60) que exijan reconfigurar 3 combinaciones distintas en tiempo real, dejando Mini-Jefes de 1 mecánica en los niveles intermedios (`X5`), y batería de tests / ajuste fino de balance.

