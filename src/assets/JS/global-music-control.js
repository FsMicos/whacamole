class GlobalMusicControl {
  constructor() {
    this.isMuted = localStorage.getItem('musicMuted') === 'true';
    this.audioElements = [];
  }

  // Registrar un elemento de audio
  registerAudio(audioElement, volume = 1) {
    audioElement.defaultVolume = volume;
    this.audioElements.push(audioElement);
    
    // Aplicar estado actual inmediatamente
    if (this.isMuted) {
      audioElement.volume = 0;
    } else {
      audioElement.volume = volume;
    }
  }

  // Alternar silencio global
  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('musicMuted', this.isMuted.toString());
    
    // Actualizar todos los audios registrados
    this.audioElements.forEach(audio => {
      if (this.isMuted) {
        audio.volume = 0;
      } else {
        audio.volume = audio.defaultVolume || 1;
      }
    });
    
    // Actualizar botón si existe
    this.updateButton();
    
    // Disparar evento para otras páginas/scripts
    window.dispatchEvent(new CustomEvent('globalMuteToggled', { 
      detail: { isMuted: this.isMuted } 
    }));
  }

  // Actualizar estado visual del botón
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

  // Configurar el botón de silenciar
  setupButton() {
    const button = document.getElementById('muteButton');
    if (button) {
      this.updateButton();
      
      // Event listener para clic en botón
      button.addEventListener('click', () => this.toggleMute());
      
      // Event listener para tecla M
      document.addEventListener('keydown', (e) => {
        if (e.key === 'm' || e.key === 'M') {
          this.toggleMute();
        }
      });
    }
  }

  // Métodos públicos
  isGloballyMuted() {
    return this.isMuted;
  }

  setGlobalMute(muted) {
    if (this.isMuted !== muted) {
      this.toggleMute();
    }
  }
}

// Crear instancia global cuando se carga el script
window.globalMusicControl = new GlobalMusicControl();

// Auto-configurar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.globalMusicControl.setupButton();
});