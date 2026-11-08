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
  - `src/game/types.ts`: Contratos e interfaces TypeScript.
  - `src/game/rules.ts` & `src/game/rules.test.ts`: Reglas puras desacopladas (combos `line_foam`, `bridge_uv`, `slip_vortex`, progresión Nv.1–4, bajas 1★/2★/3★) con 6 tests unitarios en `node:test`.
  - `src/game/models3d.ts`: Motor gráfico Cel-Shading (`MeshToonMaterial` con `DataTexture` de 3 tonos `NearestFilter`) + contorno de tinta negra (`addInkOutline` con `THREE.BackSide`) + texturas procedurales `Canvas2D`.
  - `src/components/ChefBastionCanvas.tsx`: Escena 3D 9:16, cámara en perspectiva 3/4, encimera de 4 tablones sin franja gris, Modo Táctico Slow-Mo al 20% y notificaciones flotantes de combo.
  - `src/game/audio.ts`: Sintetizador de audio 100% Web Audio API (sin activos externos).
  - `.github/workflows/main.yml`: Pipeline CI/CD en GitHub Actions que compila el `.APK` de Android con Capacitor + Gradle (`gradle-bin.zip`, `networkTimeout=120000`, 3 reintentos).
