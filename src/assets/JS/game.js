document.addEventListener('DOMContentLoaded', () => {

    const gameContainer = document.querySelector('#game-container');
    const holes = document.querySelectorAll('.hole');
    const scoreBoard = document.querySelector('#score');
    const timeLeft = document.querySelector('#time-left');
    const progressFill = document.getElementById('progress-fill');
    const totalTime = 60;

    // ========================================
    // 🧠 CONTROL FÍSICO DESDE ESP32 (WebSocket)
    // ========================================
    // Se conecta al mismo host y puerto que el servidor Express (http://localhost:3000)
    const socket = new WebSocket(`ws://${window.location.host}`);

    socket.onopen = () => {
        console.log('Conectado al servidor del juego vía WebSocket. ¡Control físico activado!');
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Si el mensaje tiene una propiedad "button", procesamos el botón
            if (data.hasOwnProperty('button')) {
                const buttonNumber = data.button;

                // BOTÓN 8 (9 en tu controlador): Pausa/Reanudar
                if (buttonNumber === 8) {
                    console.log(' Botón de pausa físico presionado');
                    if (juegoPausado) {
                        reanudarJuego();
                    } else {
                        pausarJuego();
                    }
                }
                // BOTONES 0-7: Golpear agujeros (comportamiento original)
                else {
                    console.log(` Golpe recibido del control físico en el agujero #${buttonNumber}`);
                    attemptHitOnHole(buttonNumber);
                }
            }
        } catch (e) {
            console.error('Error al procesar el mensaje del control:', e);
        }
    };

    socket.onclose = () => {
        console.warn('X Desconectado del servidor WebSocket. El control físico no funcionará.');
    };

    socket.onerror = (error) => {
        console.error('Error en la conexión WebSocket:', error);
    };

    // ========================================
    // 🎵 SISTEMA DE AUDIO COMPLETO INTEGRADO
    // ========================================
    
    // --- SISTEMA DE CONTROL GLOBAL DE MÚSICA (DE LA VERSIÓN ANTIGUA) ---
    if (!window.globalMusicControl) {
        class GlobalMusicControl {
            constructor() {
                this.isMuted = localStorage.getItem('musicMuted') === 'true';
                this.audioElements = [];
            }

            registerAudio(audioElement, volume = 1) {
                audioElement.defaultVolume = volume;
                this.audioElements.push(audioElement);
                
                if (this.isMuted) {
                    audioElement.volume = 0;
                } else {
                    audioElement.volume = volume;
                }
            }

            toggleMute() {
                this.isMuted = !this.isMuted;
                localStorage.setItem('musicMuted', this.isMuted.toString());
                
                this.audioElements.forEach(audio => {
                    if (this.isMuted) {
                        audio.volume = 0;
                    } else {
                        audio.volume = audio.defaultVolume || 1;
                    }
                });
                
                this.updateButton();
                
                window.dispatchEvent(new CustomEvent('globalMuteToggled', { 
                    detail: { isMuted: this.isMuted } 
                }));
            }

            updateButton() {
                const button = document.getElementById('muteButton');
                if (button) {
                    if (this.isMuted) {
                        button.textContent = '🔇';
                        button.classList.add('muted');
                    } else {
                        button.textContent = '🔊';
                        button.classList.remove('muted');
                    }
                }
            }

            setupButton() {
                const button = document.getElementById('muteButton');
                if (button) {
                    this.updateButton();
                    button.addEventListener('click', () => this.toggleMute());
                }
                
                // Event listener para tecla M
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'm' || e.key === 'M') {
                        this.toggleMute();
                    }
                });
            }

            isGloballyMuted() {
                return this.isMuted;
            }
        }

        window.globalMusicControl = new GlobalMusicControl();
        window.globalMusicControl.setupButton();
    }

    // --- CONFIGURACIÓN DE AUDIO ---
    const hitSound = new Audio('/media/Explosion.mp3');
    hitSound.preload = 'auto';
    hitSound.volume = 0.6;
    
    const backgroundMusic = new Audio('/media/Kubbi.mp3');
    backgroundMusic.loop = true;
    backgroundMusic.preload = 'auto';
    
    // Registrar audio con el sistema global
    window.globalMusicControl.registerAudio(backgroundMusic, 0.3);

    // ========================================
    // 🤖 CONFIGURACIÓN DE IA COMPLETA
    // ========================================
    
    const IA_CONFIG = {
        baseUrl: 'http://localhost:5000',
        endpoints: {
            predict: '/predict-difficulty',
            health: '/health',
            intervals: '/get-intervals',
            info: '/model-info'
        },
        evaluationFrequency: {
            topos: 8,        // ✅ MÁS FRECUENTE para respuesta rápida
            segundos: 12     // ✅ MÁS FRECUENTE para respuesta rápida
        },
        transitionSpeed: 0.4, // ✅ TRANSICIÓN MÁS AGRESIVA
        minConfidence: 0.3     // ✅ UMBRAL MÁS BAJO - confiar más en la IA
    };

    // ========================================
    // 🎯 INTERVALOS DE SEGURIDAD MÍNIMOS (Solo para validación básica)
    // ========================================

    const SAFETY_LIMITS = {
        min: 400,    // Mínimo absoluto para evitar spam
        max: 4000    // Máximo absoluto para mantener jugabilidad
    };

    // ========================================
    // 🆕 VARIABLES DE ESTADO ML-FIRST
    // ========================================
    let iaControlActivo = false;        // ✅ NUEVO: Control activo de IA
    let currentCategory = null;
    let grupoEdadBackend = null;
    let contadorTopos = 0;
    let currentDifficultyLevel = 'media';
    let ultimaEvaluacionIA = 0;
    let evaluacionesRealizadas = 0;
    let backendDisponible = false;
    let controlManualActivo = false;    // ✅ NUEVO: Para distinguir control manual vs IA

    let ventanaEvaluacion = {
        aciertos: 0,
        fallos: 0, 
        tiemposReaccion: [],
        inicioVentana: Date.now()
    };

    // ✅ NUEVO: Historial de decisiones IA
    let historialDecisionesIA = [];

    // ========================================
    // 🤖 FUNCIONES DE CONTROL INTELIGENTE
    // ========================================

    // ✅ MAPEO CORRECTO DE EDAD A GRUPO BACKEND
    function mapearGrupoEdad(edad) {
        if (edad >= 4 && edad <= 8) return 'niños_4_8';
        if (edad >= 9 && edad <= 12) return 'niños_9_12';
        if (edad >= 13 && edad <= 17) return 'jovenes_13_17';
        return 'adultos_18+';
    }

    // ✅ APLICACIÓN DIRECTA DE DECISIONES IA (SIN VERIFICACIONES INNECESARIAS)
    function aplicarDecisionIA(dificultadDecision, intervaloDecision, confianza, metadata) {
        const intervaloAnterior = moleInterval;
        const dificultadAnterior = currentDifficultyLevel;

        console.log(`🤖 === IA CONTROLA EL JUEGO ===`);
        console.log(`   🧠 DECISIÓN: ${dificultadAnterior} (${intervaloAnterior}ms) → ${dificultadDecision} (${intervaloDecision}ms)`);
        console.log(`   📊 CONFIANZA: ${(confianza * 100).toFixed(1)}%`);
        console.log(`   🎯 APLICANDO DIRECTAMENTE...`);

        // ✅ SOLO VALIDACIÓN DE SEGURIDAD MÍNIMA (no desconfianza del modelo)
        if (intervaloDecision < SAFETY_LIMITS.min || intervaloDecision > SAFETY_LIMITS.max) {
            console.warn(`⚠️ LÍMITE DE SEGURIDAD: Ajustando ${intervaloDecision}ms a rango válido`);
            intervaloDecision = Math.max(SAFETY_LIMITS.min, Math.min(SAFETY_LIMITS.max, intervaloDecision));
        }

        // ✅ APLICAR DECISIÓN INMEDIATAMENTE
        currentDifficultyLevel = dificultadDecision;
        moleInterval = intervaloDecision;

        // ✅ REGISTRAR EN HISTORIAL
        historialDecisionesIA.push({
            timestamp: Date.now(),
            dificultadAnterior,
            dificultadNueva: dificultadDecision,
            intervaloAnterior,
            intervaloNuevo: intervaloDecision,
            confianza,
            cambioTipo: determinarTipoCambioIA(intervaloAnterior, intervaloDecision),
            metadata
        });

        // ✅ REINICIAR TIMER INMEDIATAMENTE
        if (moleTimerId) {
            clearInterval(moleTimerId);
            moleTimerId = setInterval(randomMole, moleInterval);
            console.log(`🔄 GAME LOOP ACTUALIZADO: ${moleInterval}ms`);
        }

        // ✅ FEEDBACK VISUAL INMEDIATO
        const cambioInfo = determinarTipoCambioIA(intervaloAnterior, intervaloDecision);
        mostrarControlIA(cambioInfo, confianza, dificultadDecision, intervaloDecision);
        
        console.log(`✅ IA HA TOMADO CONTROL COMPLETO`);
        iaControlActivo = true;
        controlManualActivo = false;
    }

    // ✅ CONSULTA INTELIGENTE SIN VERIFICACIONES DESCONFIADAS
    async function consultarControlInteligente() {
        if (!iaActivada || !grupoEdadBackend || !playerData || !backendDisponible) {
            return;
        }

        const totalIntentos = ventanaEvaluacion.aciertos + ventanaEvaluacion.fallos;
        if (totalIntentos < 2) { // ✅ UMBRAL MÁS BAJO para respuesta más rápida
            return;
        }

        const tasaExito = (ventanaEvaluacion.aciertos / totalIntentos) * 100;
        const promedioReaccion = ventanaEvaluacion.tiemposReaccion.length > 0 
            ? ventanaEvaluacion.tiemposReaccion.reduce((a, b) => a + b, 0) / ventanaEvaluacion.tiemposReaccion.length 
            : 1000;

        const datosIA = {
            age: playerData.age,
            hits_in_window: ventanaEvaluacion.aciertos,
            misses_in_window: ventanaEvaluacion.fallos,
            avg_reaction_window: promedioReaccion,
            success_rate_window: tasaExito,
            window_duration: Math.round((Date.now() - ventanaEvaluacion.inicioVentana) / 1000),
            current_difficulty: currentDifficultyLevel
        };

        try {
            console.log(`🧠 === CONSULTANDO SISTEMA INTELIGENTE ===`);
            console.log(`📈 Rendimiento actual: ${ventanaEvaluacion.aciertos}/${totalIntentos} (${tasaExito.toFixed(1)}%) - ${promedioReaccion.toFixed(0)}ms`);
            
            const response = await fetch(`${IA_CONFIG.baseUrl}${IA_CONFIG.endpoints.predict}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datosIA)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const resultado = await response.json();
            
            if (resultado.success && resultado.data) {
                procesarControlInteligente(resultado.data);
            } else {
                throw new Error(resultado.error || 'Respuesta inválida del servidor');
            }

        } catch (error) {
            console.warn(`⚠️ Error en sistema inteligente: ${error.message}`);
            backendDisponible = false;
            mostrarNotificacionIA(`❌ Sistema ML temporalmente no disponible`);
        }
    }

    // ✅ PROCESAMIENTO DIRECTO DE DECISIONES ML
    function procesarControlInteligente(data) {
        const {
            dificultad_predicha,
            confianza,
            intervalo_sugerido,
            accion_nombre,
            probabilidades,
            analisis_rendimiento
        } = data;

        console.log(`🤖 === SISTEMA ML DECIDE ===`);
        console.log(`   🎯 DECISIÓN: ${dificultad_predicha.toUpperCase()}`);
        console.log(`   ⚡ INTERVALO: ${intervalo_sugerido}ms`);
        console.log(`   📊 CONFIANZA: ${(confianza * 100).toFixed(1)}%`);
        console.log(`   🔄 ACCIÓN: ${accion_nombre.toUpperCase()}`);
        console.log(`   🧮 ANÁLISIS: Puntuación ${analisis_rendimiento.puntuacion_total}/4`);

        // ✅ APLICAR DECISIÓN SI LA CONFIANZA ES MÍNIMAMENTE ACEPTABLE
        if (confianza >= IA_CONFIG.minConfidence) {
            aplicarDecisionIA(
                dificultad_predicha, 
                intervalo_sugerido, 
                confianza,
                {
                    accion: accion_nombre,
                    probabilidades,
                    analisis: analisis_rendimiento
                }
            );
        } else {
            console.log(`⚠️ Confianza muy baja (${(confianza*100).toFixed(1)}%), manteniendo estado actual`);
            mostrarNotificacionIA(`🤖 Evaluando... (${(confianza*100).toFixed(0)}%)`);
        }

        // ✅ REINICIAR VENTANA SIEMPRE
        reiniciarVentanaEvaluacion();
        evaluacionesRealizadas++;
    }

    // ✅ DETERMINACIÓN DE TIPO DE CAMBIO INTELIGENTE
    function determinarTipoCambioIA(intervaloAnterior, intervaloNuevo) {
        const diferencia = intervaloAnterior - intervaloNuevo;
        const porcentajeCambio = Math.abs(diferencia) / intervaloAnterior * 100;

        if (diferencia > 100) {
            return {
                emoji: '🔥',
                mensaje: 'MÁS DESAFIANTE',
                tipo: 'dificil',
                intensidad: porcentajeCambio > 20 ? 'alto' : 'medio'
            };
        } else if (diferencia < -100) {
            return {
                emoji: '🎯',
                mensaje: 'MÁS ACCESIBLE',
                tipo: 'facil',
                intensidad: porcentajeCambio > 20 ? 'alto' : 'medio'
            };
        } else {
            return {
                emoji: '⚙️',
                mensaje: 'AJUSTE FINO',
                tipo: 'ajuste',
                intensidad: 'bajo'
            };
        }
    }

    // ========================================
    // 🔄 FUNCIONES DE ESTADO Y EVALUACIÓN
    // ========================================

    function reiniciarVentanaEvaluacion() {
        ventanaEvaluacion = {
            aciertos: 0,
            fallos: 0,
            tiemposReaccion: [],
            inicioVentana: Date.now()
        };
    }

    function registrarAciertoVentana(tiempoReaccion) {
        if (iaActivada) {
            ventanaEvaluacion.aciertos++;
            ventanaEvaluacion.tiemposReaccion.push(tiempoReaccion);
        }
    }

    function registrarFalloVentana() {
        if (iaActivada) {
            ventanaEvaluacion.fallos++;
        }
    }

    // ✅ EVALUACIÓN AUTOMÁTICA MÁS AGRESIVA
    function evaluarControlInteligente() {
        if (!iaActivada || !grupoEdadBackend || !backendDisponible) return;

        const toposDesdeUltimaEvaluacion = contadorTopos - ultimaEvaluacionIA;
        const tiempoDesdeUltimaEvaluacion = (Date.now() - ventanaEvaluacion.inicioVentana) / 1000;

        const debeEvaluar = toposDesdeUltimaEvaluacion >= IA_CONFIG.evaluationFrequency.topos ||
                          tiempoDesdeUltimaEvaluacion >= IA_CONFIG.evaluationFrequency.segundos;

        if (debeEvaluar) {
            const totalIntentos = ventanaEvaluacion.aciertos + ventanaEvaluacion.fallos;
            
            if (totalIntentos >= 2) { // ✅ UMBRAL MÁS BAJO
                consultarControlInteligente();
                ultimaEvaluacionIA = contadorTopos;
            }
        }
    }

    // ✅ VERIFICACIÓN DE BACKEND OPTIMIZADA
    async function verificarSistemaInteligente() {
        try {
            const response = await fetch(`${IA_CONFIG.baseUrl}${IA_CONFIG.endpoints.health}`, {
                timeout: 3000
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            if (data.status === 'healthy') {
                console.log('✅ Sistema ML online y operativo');
                backendDisponible = true;
                return true;
            } else {
                console.warn('⚠️ Sistema ML con problemas parciales:', data);
                backendDisponible = false;
                return false;
            }
        } catch (error) {
            console.warn('❌ Sistema ML no disponible:', error.message);
            backendDisponible = false;
            return false;
        }
    }

    // ========================================
    // 🎮 INICIALIZACIÓN INTELIGENTE
    // ========================================

    function inicializarSistemaInteligente() {
        const estadoIA = localStorage.getItem('iaActivada');
        iaActivada = estadoIA === 'true';
        
        console.log(`🤖 === INICIALIZANDO SISTEMA INTELIGENTE ===`);
        console.log(`   Estado: ${iaActivada ? 'ACTIVADO' : 'DESACTIVADO'}`);
        
        if (iaActivada && playerData) {
            grupoEdadBackend = mapearGrupoEdad(playerData.age);
            console.log(`   👤 Jugador: ${playerData.name} (${playerData.age} años)`);
            console.log(`   📊 Perfil ML: ${grupoEdadBackend}`);
            
            verificarSistemaInteligente().then(disponible => {
                if (disponible) {
                    console.log('🚀 === SISTEMA ML LISTO PARA CONTROL TOTAL ===');
                    mostrarNotificacionIA('🤖 SISTEMA ML ACTIVADO - CONTROL INTELIGENTE');
                    iaControlActivo = true;
                } else {
                    console.warn('⚠️ IA activada pero sistema ML no disponible');
                    mostrarNotificacionIA('⚠️ Sistema ML: Conexión fallida');
                    iaControlActivo = false;
                }
            });
        } else {
            iaControlActivo = false;
            controlManualActivo = true;
        }
    }

    // ✅ CONFIGURACIÓN INICIAL INTELIGENTE
    function configurarDificultadInteligente() {
        if (!playerData) {
            moleInterval = 2000;
            currentDifficultyLevel = 'media';
            controlManualActivo = true;
            return;
        }

        if (iaActivada && grupoEdadBackend && backendDisponible) {
            // ✅ USAR CONFIGURACIÓN INTELIGENTE BÁSICA MIENTRAS SE APRENDE
            const intervaloInicial = {
                'niños_4_8': 3200,
                'niños_9_12': 1500,
                'jovenes_13_17': 1300,
                'adultos_18+': 1150
            }[grupoEdadBackend] || 1500;

            moleInterval = intervaloInicial;
            currentDifficultyLevel = 'media';
            iaControlActivo = true;
            controlManualActivo = false;
            
            console.log(`🤖 CONTROL IA INICIALIZADO:`);
            console.log(`   📊 Perfil: ${grupoEdadBackend}`);
            console.log(`   ⚡ Intervalo inicial: ${moleInterval}ms`);
            console.log(`   🎯 El sistema aprenderá y ajustará automáticamente`);
            
        } else {
            // Sistema tradicional
            if (playerData.age >= 4 && playerData.age <= 10) {
                moleInterval = 2500;
            } else if (playerData.age >= 11 && playerData.age <= 17) {
                moleInterval = 2000;
            } else {
                moleInterval = 1800;
            }
            currentDifficultyLevel = 'media';
            controlManualActivo = true;
            iaControlActivo = false;
            
            console.log(`🎮 Control manual: ${moleInterval}ms para edad ${playerData.age}`);
        }
    }

    // ========================================
    // 📱 FEEDBACK VISUAL INTELIGENTE
    // ========================================

    function mostrarControlIA(cambioInfo, confianza, dificultad, intervalo) {
        // ✅ CREAR INDICADOR DE CONTROL IA PERSISTENTE
        let controlIndicator = document.getElementById('ia-control-indicator');
        if (!controlIndicator) {
            controlIndicator = document.createElement('div');
            controlIndicator.id = 'ia-control-indicator';
            controlIndicator.style.cssText = `
                position: fixed;
                top: 120px;
                right: 20px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 8px 12px;
                border-radius: 20px;
                font-family: 'Press Start 2P';
                font-size: 8px;
                z-index: 1000;
                border: 2px solid #5a67d8;
                box-shadow: 0 4px 12px rgba(90, 103, 216, 0.4);
                transition: all 0.3s ease;
                min-width: 200px;
                text-align: center;
            `;
            document.body.appendChild(controlIndicator);
        }
        
        controlIndicator.innerHTML = `
            <div style="margin-bottom: 3px;">🤖 IA CONTROLA</div>
            <div style="font-size: 7px; opacity: 0.9;">
                ${dificultad.toUpperCase()} • ${intervalo}ms<br>
                Confianza: ${(confianza * 100).toFixed(0)}%
            </div>
        `;

        // ✅ NOTIFICACIÓN DE CAMBIO
        mostrarNotificacionIA(`${cambioInfo.emoji} ${cambioInfo.mensaje} • ${(confianza*100).toFixed(0)}%`);

        // ✅ EFECTO VISUAL EN EL GAME CONTAINER
        if (gameContainer) {
            gameContainer.style.boxShadow = `0 0 20px ${cambioInfo.tipo === 'dificil' ? '#ff6b6b' : '#4ecdc4'}`;
            setTimeout(() => {
                if (gameContainer) gameContainer.style.boxShadow = '';
            }, 1000);
        }
    }

    function mostrarNotificacionIA(mensaje) {
        let notification = document.getElementById('ia-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'ia-notification';
            notification.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, rgba(52, 152, 219, 0.95), rgba(41, 128, 185, 0.95));
                color: white;
                padding: 10px 14px;
                border-radius: 8px;
                font-family: 'Press Start 2P';
                font-size: 8px;
                z-index: 1001;
                border: 2px solid #2980b9;
                box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                transition: all 0.3s ease;
                max-width: 250px;
                word-wrap: break-word;
            `;
            document.body.appendChild(notification);
        }
        
        notification.textContent = mensaje;
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
        
        setTimeout(() => {
            if (notification) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification && notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 3500);
    }

    // ========================================
    // 🎮 CÓDIGO DEL JUEGO ACTUALIZADO
    // ========================================

    // Variables del juego
    let currentTime = totalTime;
    let score, totalMoles, successfulHits, reactionTimes, molePosition, consecutiveMisses, missedMoles, consecutiveHits, moleStartTime;
    let timerId = null;
    let moleTimerId = null;
    let gameInProgress = false;
    let juegoPausado = false;
    let iaActivada = false;

    // Datos del jugador
    let playerData = null;
    try {
        const savedPlayerData = sessionStorage.getItem('playerData');
        if (savedPlayerData) {
            playerData = JSON.parse(savedPlayerData);
            console.log('📋 Datos del jugador cargados:', playerData);
        }
    } catch (error) {
        console.log('Error al cargar datos del jugador:', error);
    }

    // ✅ FUNCIÓN randomMole CON CONTROL INTELIGENTE
    function randomMole() {
        if (!gameInProgress || juegoPausado) return;
        
        // Registrar fallo si había un topo activo
        if (molePosition && molePosition.classList.contains('up')) {
            molePosition.classList.remove('up');
            missedMoles++;
            consecutiveMisses++;
            consecutiveHits = 0;
            registrarFalloVentana(); // ✅ Registrar para IA
        }
        
        // Limpiar topos anteriores
        holes.forEach(hole => {
            hole.classList.remove('up');
            const mole = hole.querySelector('.mole');
            if (mole) mole.classList.remove('hit');
        });
        
        // Generar nuevo topo
        let randomHole = holes[Math.floor(Math.random() * holes.length)];
        randomHole.classList.add('up');
        molePosition = randomHole;
        moleStartTime = Date.now();
        totalMoles++;
        contadorTopos++;
        
        // ✅ EVALUACIÓN INTELIGENTE AUTOMÁTICA
        if (iaControlActivo && backendDisponible) {
            evaluarControlInteligente();
        }
    }

    // ✅ FUNCIÓN attemptHitOnHole CON REGISTRO INTELIGENTE Y AUDIO
    function attemptHitOnHole(holeIndex) {
        const hole = holes[holeIndex];

        if (!gameInProgress || !hole.classList.contains('up') || hole !== molePosition) {
            return;
        }

        hole.classList.remove('up');
        
        const reactionTime = Date.now() - moleStartTime;
        reactionTimes.push(reactionTime);

        const puntosGanados = Math.max(1, Math.round(1000 / reactionTime));
        score += puntosGanados;
        successfulHits++;
        consecutiveHits++;
        consecutiveMisses = 0;
        scoreBoard.textContent = score;

        registrarAciertoVentana(reactionTime); // ✅ Registrar para IA

        console.log(`✅ ¡Acierto en agujero #${holeIndex}! Tiempo: ${reactionTime}ms`);

        // ✅ REPRODUCIR SONIDO DE GOLPE
        hitSound.currentTime = 0;
        hitSound.play().catch(e => console.log('Error reproduciendo sonido:', e));

        // Efectos visuales
        const mole = hole.querySelector('.mole');
        if (mole) {
            mole.classList.add('hit');
            setTimeout(() => mole.classList.remove('hit'), 600);
        }
        
        molePosition = null;
    }

    // Event listeners para los agujeros
    holes.forEach((hole, index) => {
        hole.addEventListener('click', () => {
            attemptHitOnHole(index);
        });
    });

    function updateTimer() {
        timeLeft.textContent = currentTime;
        const progressPercent = (currentTime / totalTime) * 100;
        progressFill.style.width = `${progressPercent}%`;
    }

    function gameTick() {
        if (juegoPausado) return;
        currentTime--;
        updateTimer();
        if (currentTime <= 0) {
            clearInterval(timerId);
            clearInterval(moleTimerId);
            gameInProgress = false;
            // ✅ PAUSAR MÚSICA AL TERMINAR
            backgroundMusic.pause();
            showSaveScoreForm();
        }
    }

    function showSaveScoreForm() {
        const tasaFinal = totalMoles > 0 ? parseFloat((successfulHits / totalMoles * 100).toFixed(1)) : 0;
        const promedioReaccion = reactionTimes.length > 0 ? parseInt((reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length).toFixed(0)) : 0;

        if (playerData && playerData.name && playerData.age) {
            const gameData = {
                nickname: playerData.name,
                score: score,
                successfulHits: successfulHits,
                missedMoles: missedMoles,
                successRate: tasaFinal,
                avgReactionTime: promedioReaccion,
                playerAge: playerData.age
            };
            saveScoreToServer(gameData);
            return;
        }

        // Mostrar formulario si no hay datos del jugador
        const overlay = document.getElementById('save-score-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            const saveButton = document.getElementById('save-score-button');
            const nicknameInput = document.getElementById('nickname-input');

            if (saveButton && nicknameInput) {
                saveButton.onclick = () => {
                    const nickname = nicknameInput.value.toUpperCase();
                    if (nickname.length === 4) {
                        const gameData = {
                            nickname: nickname,
                            score: score,
                            successfulHits: successfulHits,
                            missedMoles: missedMoles,
                            successRate: tasaFinal,
                            avgReactionTime: promedioReaccion
                        };
                        saveScoreToServer(gameData);
                        overlay.style.display = 'none';
                    } else {
                        alert('¡Tu nick debe tener exactamente 4 caracteres!');
                    }
                };
            }
        } else {
            showGameOverScreen();
        }
    }

    async function saveScoreToServer(data) {
        try {
            const response = await fetch('/api/scores', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) throw new Error('La respuesta del servidor no fue OK');
            const result = await response.json();
            console.log('Puntuación guardada:', result);
            showGameOverScreen();
        } catch (error) {
            console.error('Error al enviar la puntuación:', error);
            alert('No se pudo guardar la puntuación. Revisa la consola del servidor.');
            showGameOverScreen();
        }
    }

    function showGameOverScreen() {
        const finalPointsEl = document.getElementById('final-points');
        const finalHitsEl = document.getElementById('final-hits');
        const finalMissesEl = document.getElementById('final-misses');

        if (finalPointsEl) finalPointsEl.textContent = score;
        if (finalHitsEl) finalHitsEl.textContent = successfulHits;
        if (finalMissesEl) finalMissesEl.textContent = missedMoles;

        // ✅ MOSTRAR RESUMEN DE CONTROL IA
        if (iaControlActivo && historialDecisionesIA.length > 0) {
            mostrarResumenControlIA();
        }

        initializeGameOverIAToggle();

        const gameOverOverlay = document.getElementById('game-over-overlay');
        if (gameOverOverlay) {
            gameOverOverlay.style.display = 'flex';
        }
    }

    // ✅ NUEVO: RESUMEN DE CONTROL IA AL FINAL DEL JUEGO
    function mostrarResumenControlIA() {
        let resumenIA = document.getElementById('ia-summary');
        if (!resumenIA) {
            resumenIA = document.createElement('div');
            resumenIA.id = 'ia-summary';
            resumenIA.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #667eea, #764ba2);
                color: white;
                padding: 15px;
                border-radius: 10px;
                font-family: 'Press Start 2P';
                font-size: 8px;
                z-index: 1002;
                max-width: 300px;
                border: 2px solid #5a67d8;
                box-shadow: 0 6px 20px rgba(0,0,0,0.4);
            `;
            document.body.appendChild(resumenIA);
        }
        
        const totalCambios = historialDecisionesIA.length;
        const cambiosMasDificil = historialDecisionesIA.filter(d => d.intervaloNuevo < d.intervaloAnterior).length;
        const cambiosMasFacil = historialDecisionesIA.filter(d => d.intervaloNuevo > d.intervaloAnterior).length;
        
        resumenIA.innerHTML = `
            <div style="text-align: center; margin-bottom: 10px;">🤖 CONTROL IA COMPLETADO</div>
            <div style="font-size: 7px; line-height: 1.4;">
                • Decisiones tomadas: ${totalCambios}<br>
                • Aumentó dificultad: ${cambiosMasDificil}x<br>
                • Redujo dificultad: ${cambiosMasFacil}x<br>
                • Sistema totalmente autónomo ✅
            </div>
        `;
        
        // Auto-remover después de 8 segundos
        setTimeout(() => {
            if (resumenIA && resumenIA.parentNode) {
                resumenIA.remove();
            }
        }, 8000);
    }

    function pausarJuego() {
        if (!gameInProgress || juegoPausado) return;
        juegoPausado = true;
        clearInterval(timerId);
        clearInterval(moleTimerId);
        // ✅ PAUSAR MÚSICA
        backgroundMusic.pause();
        document.getElementById("paused-overlay").style.display = "flex";
    }

    function reanudarJuego() {
        if (!juegoPausado) return;
        juegoPausado = false;
        // ✅ REANUDAR MÚSICA
        backgroundMusic.play().catch(() => {});
        moleTimerId = setInterval(randomMole, moleInterval);
        timerId = setInterval(gameTick, 1000);
        document.getElementById("paused-overlay").style.display = "none";
    }

    async function reiniciarJuego() {
        if (timerId) clearInterval(timerId);
        if (moleTimerId) clearInterval(moleTimerId);
        // ✅ PAUSAR MÚSICA
        backgroundMusic.pause();
        document.getElementById("paused-overlay").style.display = "none";
        
        // Limpiar indicadores IA
        const controlIndicator = document.getElementById('ia-control-indicator');
        if (controlIndicator) controlIndicator.remove();
        
        const resumenIA = document.getElementById('ia-summary');
        if (resumenIA) resumenIA.remove();
        
        const gameOverOverlay = document.getElementById("game-over-overlay");
        if (gameOverOverlay) {
            gameOverOverlay.style.display = "none";
        }
        
        startGame();
    }

    function volverAlInicio() {
        window.location.href = '/';
    }

    // ✅ FUNCIÓN startGame CON SISTEMA INTELIGENTE Y AUDIO
    function startGame() {
        if (gameInProgress && !juegoPausado) return;
        
        console.log('🎮 === INICIANDO JUEGO ===');
        
        // ✅ INICIALIZAR SISTEMA INTELIGENTE
        inicializarSistemaInteligente();
        
        gameInProgress = true;
        juegoPausado = false;
        
        // ✅ INICIAR MÚSICA DE FONDO
        backgroundMusic.currentTime = 0;
        backgroundMusic.play().catch(() => {});
        
        // Limpiar timers existentes
        if (timerId) clearInterval(timerId);
        if (moleTimerId) clearInterval(moleTimerId);
        
        // Reset de variables del juego
        score = 0;
        currentTime = totalTime;
        missedMoles = 0;
        totalMoles = 0;
        successfulHits = 0;
        reactionTimes = [];
        molePosition = null;
        consecutiveMisses = 0;
        consecutiveHits = 0;
        contadorTopos = 0;
        
        // Reset de variables IA
        ultimaEvaluacionIA = 0;
        evaluacionesRealizadas = 0;
        historialDecisionesIA = [];
        reiniciarVentanaEvaluacion();

        // ✅ CONFIGURAR DIFICULTAD INTELIGENTE
        configurarDificultadInteligente();

        // Inicializar UI
        scoreBoard.textContent = score;
        updateTimer();
        
        // Limpiar estado visual
        holes.forEach(hole => {
            hole.classList.remove('up');
            const mole = hole.querySelector('.mole');
            if (mole) mole.classList.remove('hit');
        });

        // ✅ INICIAR JUEGO CON CONTROL INTELIGENTE
        const tipoControl = iaControlActivo ? 'CONTROL IA' : 'CONTROL MANUAL';
        console.log(`🚀 Juego iniciado con ${tipoControl} - Intervalo: ${moleInterval}ms`);
        
        randomMole();
        moleTimerId = setInterval(randomMole, moleInterval);
        timerId = setInterval(gameTick, 1000);
    }

    // ========================================
    // 🔧 FUNCIONES DE DEBUG AVANZADAS
    // ========================================

    function mostrarEstadoSistemaML() {
        if (!iaActivada) {
            console.log('🤖 SISTEMA INTELIGENTE DESACTIVADO');
            return;
        }
        
        console.log('📊 === ESTADO SISTEMA ML ===');
        console.log(`   👤 Jugador: ${playerData?.name} (${playerData?.age} años)`);
        console.log(`   📊 Perfil ML: ${grupoEdadBackend}`);
        console.log(`   🤖 Control activo: ${iaControlActivo ? 'SÍ' : 'NO'}`);
        console.log(`   📈 Dificultad actual: ${currentDifficultyLevel}`);
        console.log(`   ⚡ Intervalo actual: ${moleInterval}ms`);
        console.log(`   🎮 Topos procesados: ${contadorTopos}`);
        console.log(`   📈 Decisiones tomadas: ${evaluacionesRealizadas}`);
        console.log(`   🔗 Backend disponible: ${backendDisponible}`);
        
        const totalVentana = ventanaEvaluacion.aciertos + ventanaEvaluacion.fallos;
        console.log(`   🎯 Ventana actual: ${ventanaEvaluacion.aciertos}/${totalVentana} (${totalVentana > 0 ? ((ventanaEvaluacion.aciertos/totalVentana)*100).toFixed(1) : 0}%)`);
        
        if (historialDecisionesIA.length > 0) {
            console.log(`   📜 Últimas decisiones:`, historialDecisionesIA.slice(-3));
        }
    }

    async function forzarDecisionIA() {
        console.log('🧪 Forzando consulta inmediata al sistema ML...');
        
        if (!iaActivada || !backendDisponible) {
            console.warn('⚠️ Sistema ML no disponible para test');
            return;
        }
        
        // Simular datos de prueba si no hay suficientes
        if (ventanaEvaluacion.aciertos + ventanaEvaluacion.fallos < 2) {
            ventanaEvaluacion = {
                aciertos: 7,
                fallos: 3,
                tiemposReaccion: [450, 520, 380, 490, 420, 350, 600],
                inicioVentana: Date.now() - 12000
            };
            console.log('📊 Datos de prueba establecidos para test');
        }
        
        await consultarControlInteligente();
    }

    // ========================================
    // 🎛️ EVENT LISTENERS
    // ========================================
    
    document.querySelector(".pause-button")?.addEventListener("click", pausarJuego);
    document.querySelector(".resume-button")?.addEventListener("click", reanudarJuego);
    document.querySelector(".restart-button")?.addEventListener("click", reiniciarJuego);
    document.querySelector(".return-button")?.addEventListener("click", volverAlInicio);
    
    const gameOverRestartButton = document.querySelector(".game-over-restart-button");
    const gameOverHomeButton = document.querySelector(".game-over-home-button");

    if (gameOverRestartButton) {
        gameOverRestartButton.addEventListener("click", () => {
            const gameOverOverlay = document.getElementById("game-over-overlay");
            if (gameOverOverlay) {
                gameOverOverlay.style.display = "none";
            }
            reiniciarJuego();
        });
    }

    if (gameOverHomeButton) {
        gameOverHomeButton.addEventListener("click", volverAlInicio);
    }

    // ========================================
    // 🤖 FUNCIONES TOGGLE IA ACTUALIZADAS
    // ========================================
    
    function initializeGameOverIAToggle() {
        const iaActivada = localStorage.getItem('iaActivada') === 'true';
        const toggle = document.getElementById('game-over-ia-toggle');
        const status = document.getElementById('game-over-ia-status');
        
        if (toggle && status) {
            if (iaActivada) {
                toggle.classList.add('active');
                status.textContent = 'CONTROL IA ACTIVADO';
                status.style.color = '#27ae60';
            } else {
                toggle.classList.remove('active');
                status.textContent = 'CONTROL MANUAL';
                status.style.color = '#e74c3c';
            }
        }
    }

    // ✅ FUNCIONES GLOBALES ACTUALIZADAS
    window.toggleIA = function() {
        iaActivada = !iaActivada;
        localStorage.setItem('iaActivada', iaActivada.toString());
        
        const toggle = document.getElementById('ia-toggle');
        const status = document.getElementById('ia-status');
        
        if (toggle && status) {
            if (iaActivada) {
                toggle.classList.add('active');
                status.textContent = 'CONTROL IA ACTIVADO';
                status.style.color = '#4CAF50';
            } else {
                toggle.classList.remove('active');
                status.textContent = 'CONTROL MANUAL'; 
                status.style.color = '#f44336';
            }
        }
        
        console.log(`🤖 SISTEMA ML ${iaActivada ? 'ACTIVADO' : 'DESACTIVADO'}`);
        
        // Si se activa durante el juego, configurar inmediatamente
        if (gameInProgress && iaActivada && playerData) {
            grupoEdadBackend = mapearGrupoEdad(playerData.age);
            verificarSistemaInteligente().then(disponible => {
                if (disponible) {
                    mostrarNotificacionIA('🤖 CONTROL IA ACTIVADO - TOMANDO CONTROL');
                    iaControlActivo = true;
                    controlManualActivo = false;
                    console.log(`🔄 IA tomó control durante partida - Perfil: ${grupoEdadBackend}`);
                } else {
                    mostrarNotificacionIA('⚠️ Sistema ML: No disponible');
                    iaControlActivo = false;
                }
            });
        } else if (!iaActivada) {
            mostrarNotificacionIA('🎮 CONTROL MANUAL ACTIVADO');
            iaControlActivo = false;
            controlManualActivo = true;
            
            // Limpiar indicador de control IA
            const controlIndicator = document.getElementById('ia-control-indicator');
            if (controlIndicator) controlIndicator.remove();
        }
    };

    window.toggleGameOverIA = function() {
        const currentState = localStorage.getItem('iaActivada') === 'true';
        const newState = !currentState;
        
        localStorage.setItem('iaActivada', newState.toString());
        
        const toggle = document.getElementById('game-over-ia-toggle');
        const status = document.getElementById('game-over-ia-status');
        
        if (toggle && status) {
            if (newState) {
                toggle.classList.add('active');
                status.textContent = 'CONTROL IA ACTIVADO';
                status.style.color = '#27ae60';
            } else {
                toggle.classList.remove('active');
                status.textContent = 'CONTROL MANUAL';
                status.style.color = '#e74c3c';
            }
        }
        
        console.log(`🤖 SISTEMA ML ${newState ? 'ACTIVADO' : 'DESACTIVADO'} para próxima partida`);
    };

    window.getIAState = function() {
        return {
            activada: iaActivada,
            controlActivo: iaControlActivo,
            backendDisponible: backendDisponible,
            evaluacionesRealizadas: evaluacionesRealizadas,
            historialDecisiones: historialDecisionesIA.length
        };
    };

    // ========================================
    // 🔧 FUNCIONES GLOBALES DE DEBUG AVANZADO
    // ========================================

    window.mlDebug = {
        mostrarEstado: mostrarEstadoSistemaML,
        forzarDecision: forzarDecisionIA,
        verificarSistema: verificarSistemaInteligente,
        reiniciarVentana: reiniciarVentanaEvaluacion,
        consultarML: consultarControlInteligente,
        
        // ✅ NUEVAS FUNCIONES DE DEBUG
        aplicarDirecto: (dificultad, intervalo) => {
            console.log(`🧪 Aplicación directa: ${dificultad} con ${intervalo}ms`);
            aplicarDecisionIA(dificultad, intervalo, 1.0, { test: true });
        },
        
        simularRendimiento: (aciertos, fallos, tiempos) => {
            ventanaEvaluacion = {
                aciertos: aciertos,
                fallos: fallos,
                tiemposReaccion: tiempos || Array(aciertos).fill(0).map(() => 400 + Math.random() * 300),
                inicioVentana: Date.now() - 10000
            };
            console.log('📊 Rendimiento simulado:', ventanaEvaluacion);
        },
        
        historialCompleto: () => {
            console.log('📜 === HISTORIAL COMPLETO DE DECISIONES IA ===');
            historialDecisionesIA.forEach((decision, i) => {
                console.log(`${i+1}. ${new Date(decision.timestamp).toLocaleTimeString()}`);
                console.log(`   ${decision.dificultadAnterior} → ${decision.dificultadNueva}`);
                console.log(`   ${decision.intervaloAnterior}ms → ${decision.intervaloNuevo}ms`);
                console.log(`   ${decision.cambioTipo.emoji} ${decision.cambioTipo.mensaje} (${(decision.confianza*100).toFixed(1)}%)`);
            });
        },
        
        estadisticasML: () => {
            if (historialDecisionesIA.length === 0) {
                console.log('📊 No hay estadísticas disponibles aún');
                return;
            }
            
            const stats = {
                totalDecisiones: historialDecisionesIA.length,
                aumentoDificultad: historialDecisionesIA.filter(d => d.intervaloNuevo < d.intervaloAnterior).length,
                reduccionDificultad: historialDecisionesIA.filter(d => d.intervaloNuevo > d.intervaloAnterior).length,
                confianzaPromedio: (historialDecisionesIA.reduce((acc, d) => acc + d.confianza, 0) / historialDecisionesIA.length * 100).toFixed(1)
            };
            
            console.log('📊 === ESTADÍSTICAS SISTEMA ML ===');
            console.log(`   Decisiones totales: ${stats.totalDecisiones}`);
            console.log(`   Incrementos de dificultad: ${stats.aumentoDificultad}`);
            console.log(`   Reducciones de dificultad: ${stats.reduccionDificultad}`);
            console.log(`   Confianza promedio: ${stats.confianzaPromedio}%`);
            console.log(`   Rango de intervalos: ${Math.min(...historialDecisionesIA.map(d => d.intervaloNuevo))} - ${Math.max(...historialDecisionesIA.map(d => d.intervaloNuevo))}ms`);
        }
    };

    // ========================================
    // 🚀 INICIALIZACIÓN FINAL
    // ========================================
    
    startGame();

    console.log('🎮 === SISTEMA COMPLETO INICIALIZADO ===');
    console.log(`🤖 Control ML: ${iaActivada ? 'ACTIVADO' : 'DESACTIVADO'}`);
    console.log(`👤 Jugador: ${playerData ? `${playerData.name} (${playerData.age} años)` : 'No registrado'}`);
    console.log(`📊 Perfil ML: ${grupoEdadBackend || 'No definido'}`);
    console.log(`⚡ Intervalo inicial: ${moleInterval}ms`);
    console.log(`🎯 Tipo de control: ${iaControlActivo ? 'INTELIGENCIA ARTIFICIAL' : 'MANUAL'}`);
    console.log('🎵 Sistema de audio integrado con control global de música');
    console.log('');
    console.log('🔧 === COMANDOS DEBUG DISPONIBLES ===');
    console.log('   • mlDebug.mostrarEstado() - Estado completo del sistema');
    console.log('   • mlDebug.forzarDecision() - Consulta inmediata al ML');
    console.log('   • mlDebug.aplicarDirecto("alta", 800) - Aplicar configuración directa');
    console.log('   • mlDebug.simularRendimiento(8, 2) - Simular datos de rendimiento');
    console.log('   • mlDebug.historialCompleto() - Ver todas las decisiones tomadas');
    console.log('   • mlDebug.estadisticasML() - Análisis estadístico del comportamiento');
    console.log('   • window.getIAState() - Estado rápido del sistema');

});