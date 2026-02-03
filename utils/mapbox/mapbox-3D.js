

export class Mapbox3DManager {
  constructor(config) {
    this.config = {
      mapboxToken: config.mapboxToken,
      containerId: config.containerId || 'map',
      defaultCenter: config.defaultCenter || [2.3522, 48.8566],
      defaultZoom: config.defaultZoom || 13,
      enable3DByDefault: config.enable3DByDefault || false,
      style: config.style || 'mapbox://styles/mapbox/light-v11',
      adminMode: config.adminMode || true,
      ...config
    };

    this.map = null;
    this.is3DEnabled = false;
    this.vehicles = new Map();
    this.routes = new Map();
    this.markers = new Map();

    this.initMap();
  }

  // Initialisation de la carte
  initMap() {
    if (!this.config.mapboxToken) {
      console.error('Mapbox token manquant');
      return;
    }

    mapboxgl.accessToken = this.config.mapboxToken;

    this.map = new mapboxgl.Map({
      container: this.config.containerId,
      style: this.config.style,
      center: this.config.defaultCenter,
      zoom: this.config.defaultZoom,
      pitch: this.config.enable3DByDefault ? 45 : 0,
      bearing: 0,
      antialias: true,
      attributionControl: false
    });

    // Ajouter les contrôles de base
    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    this.map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Initialiser les couches 3D après chargement du style
    this.map.on('style.load', () => {
      this.init3DLayers();
      // Si la 3D devait être active, on s'assure qu'elle l'est
      if (this.config.enable3DByDefault || this.is3DEnabled) {
        // Petit délai pour laisser le style s'appliquer
        setTimeout(() => {
          if (this.is3DEnabled) this.enable3DView();
        }, 100);
      }
    });

    this.map.on('load', () => {
      this.initCustomControls();

      if (this.config.enable3DByDefault) {
        this.enable3DView();
      }
    });

    // Gestion des erreurs
    this.map.on('error', (e) => {
      if (e.error && e.error.message && !e.error.message.includes('does not exist')) {
        console.error('Erreur Mapbox:', e.error);
      }
    });
  }

  // Initialisation des couches 3D
  init3DLayers() {
    if (this.map.getLayer('3d-buildings')) return;

    // Ajouter la source DEM si elle n'existe pas
    if (!this.map.getSource('mapbox-dem')) {
      try {
        this.map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14
        });
      } catch (e) {
        console.warn('Impossible d\'ajouter la source DEM:', e);
      }
    }

    // Couche pour les bâtiments 3D
    // D'abord vérifier si la source "composite" existe (elle n'existe pas dans tous les styles custom)
    if (!this.map.getSource('composite')) {
      if (!this._warnedAboutComposite) {
        console.warn('Source "composite" non trouvée. Bâtiments 3D désactivés pour ce style.');
        this._warnedAboutComposite = true;
      }
      return;
    }

    if (!this.map.getLayer('3d-buildings')) {
      // Essayer de trouver une couche de labels pour insérer les bâtiments en dessous
      let labelLayerId;
      const style = this.map.getStyle();
      if (style && style.layers) {
        for (const layer of style.layers) {
          if (layer.type === 'symbol' && layer.layout['text-field']) {
            labelLayerId = layer.id;
            break;
          }
        }
      }

      try {
        this.map.addLayer({
          id: '3d-buildings',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          type: 'fill-extrusion',
          minzoom: 15,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'height'],
              0, '#f3f4f6',
              50, '#d1d5db',
              100, '#9ca3af'
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'] || 0,
            'fill-extrusion-opacity': 0.8
          }
        }, labelLayerId); // Insérer sous les labels si trouvé
      } catch (e) {
        console.error('Erreur ajout layer 3d-buildings:', e);
      }

      // Masquer par défaut si la 3D n'est pas activée
      if (!this.is3DEnabled) {
        if (this.map.getLayer('3d-buildings')) {
          this.map.setLayoutProperty('3d-buildings', 'visibility', 'none');
        }
      }
    }
  }

  // Activer la vue 3D
  enable3DView() {
    if (!this.map) return;

    this.is3DEnabled = true;

    // S'assurer que les couches existent
    if (!this.map.getLayer('3d-buildings')) {
      this.init3DLayers();
    }

    // Activer le relief
    if (this.map.getSource('mapbox-dem')) {
      this.map.setTerrain({
        source: 'mapbox-dem',
        exaggeration: 1.5
      });
    }

    // Afficher les bâtiments 3D
    if (this.map.getLayer('3d-buildings')) {
      this.map.setLayoutProperty('3d-buildings', 'visibility', 'visible');
    }

    // Animation vers vue 3D
    this.map.flyTo({
      pitch: 60, // Standard 3D pitch
      bearing: 0,
      // zoom: Math.max(this.map.getZoom(), 15), // REMOVED: User reported excessive zoom
      duration: 1500
    });

    this.update3DControls();
  }

  // Désactiver la vue 3D
  disable3DView() {
    if (!this.map) return;

    this.is3DEnabled = false;

    // Désactiver le relief
    this.map.setTerrain(null);

    // Masquer les bâtiments 3D
    if (this.map.getLayer('3d-buildings')) {
      this.map.setLayoutProperty('3d-buildings', 'visibility', 'none');
    }

    // Animation vers vue 2D
    this.map.flyTo({
      pitch: 0,
      bearing: 0,
      duration: 1500
    });

    this.update3DControls();
  }

  // Basculer entre 2D et 3D
  toggle3DView() {
    if (this.is3DEnabled) {
      this.disable3DView();
    } else {
      this.enable3DView();
    }
  }

  // Contrôles personnalisés
  initCustomControls() {
    console.log('Initializing Custom 3D Controls...');
    if (document.querySelector('.mapbox-3d-controls')) return;

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'mapbox-3d-controls';
    controlsContainer.innerHTML = `
      <div class="control-group">
        <button class="control-btn" id="custom-toggle-3d" title="Basculer 2D/3D">
          <span class="icon-3d">🏢</span>
          <span class="control-text">3D</span>
        </button>
        <button class="control-btn" id="custom-reset-view" title="Réinitialiser la vue">
          <span class="icon-reset">🔄</span>
        </button>
        <button class="control-btn" id="custom-locate-vehicles" title="Centrer sur les véhicules">
          <span class="icon-locate">📍</span>
        </button>
      </div>
      <div class="control-group" id="custom-pitch-controls" style="display: none;">
        <div class="control-row">
            <button class="control-btn small" id="custom-pitch-up" title="Incliner plus">⬆️</button>
            <button class="control-btn small" id="custom-pitch-down" title="Incliner moins">⬇️</button>
        </div>
        <div class="control-row">
            <button class="control-btn small" id="custom-rotate-left" title="Pivoter gauche">⬅️</button>
            <button class="control-btn small" id="custom-rotate-right" title="Pivoter droite">➡️</button>
        </div>
      </div>
    `;

    // Ajouter les styles CSS
    this.addControlsCSS();

    // Ajouter au conteneur de la carte
    this.map.getContainer().appendChild(controlsContainer);

    // Événements des boutons
    // Note: appended elements are now in the document, so simple getElementById works fine with unique IDs.
    const btnToggle = document.getElementById('custom-toggle-3d');
    const btnReset = document.getElementById('custom-reset-view');
    const btnLocate = document.getElementById('custom-locate-vehicles');

    const btnPitchUp = document.getElementById('custom-pitch-up');
    const btnPitchDown = document.getElementById('custom-pitch-down');
    const btnRotateLeft = document.getElementById('custom-rotate-left');
    const btnRotateRight = document.getElementById('custom-rotate-right');

    if (btnToggle) btnToggle.addEventListener('click', () => this.toggle3DView());
    if (btnReset) btnReset.addEventListener('click', () => this.resetView());
    if (btnLocate) btnLocate.addEventListener('click', () => this.centerOnVehicles());

    if (btnPitchUp) btnPitchUp.addEventListener('click', () => this.adjustPitch(10));
    if (btnPitchDown) btnPitchDown.addEventListener('click', () => this.adjustPitch(-10));

    if (btnRotateLeft) btnRotateLeft.addEventListener('click', () => this.adjustBearing(-15));
    if (btnRotateRight) btnRotateRight.addEventListener('click', () => this.adjustBearing(15));
  }

  resetView() {
    this.map.flyTo({
      center: this.config.defaultCenter,
      zoom: this.config.defaultZoom,
      pitch: this.is3DEnabled ? 60 : 0,
      bearing: 0,
      duration: 1000
    });
  }

  adjustPitch(amount) {
    if (!this.is3DEnabled) return;

    const currentPitch = this.map.getPitch();
    const newPitch = Math.max(0, Math.min(85, currentPitch + amount));

    this.map.easeTo({
      pitch: newPitch,
      duration: 300
    });
  }

  centerOnVehicles() {
    if (this.vehicles.size === 0) {
      this.resetView();
      return;
    }

    const positions = Array.from(this.vehicles.values()).map(v => v.marker.getLngLat());
    const bounds = positions.reduce((bounds, coord) => {
      return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(positions[0], positions[0]));

    this.map.fitBounds(bounds, {
      padding: 100,
      duration: 1000,
      pitch: this.is3DEnabled ? 60 : 0
    });
  }

  adjustBearing(amount) {
    const currentBearing = this.map.getBearing();
    this.map.easeTo({
      bearing: currentBearing + amount,
      duration: 300,
      easing: (t) => t
    });
  }

  // Mettre à jour l'affichage des contrôles
  update3DControls() {
    const pitchControls = document.getElementById('custom-pitch-controls');
    const toggleBtn = document.getElementById('custom-toggle-3d');

    if (!pitchControls || !toggleBtn) return;

    if (this.is3DEnabled) {
      pitchControls.style.display = 'flex';
      toggleBtn.classList.add('active');
      toggleBtn.querySelector('.control-text').textContent = '2D';
    } else {
      pitchControls.style.display = 'none';
      toggleBtn.classList.remove('active');
      toggleBtn.querySelector('.control-text').textContent = '3D';
    }
  }

  // CSS pour les contrôles
  addControlsCSS() {
    if (document.getElementById('mapbox-3d-controls-style')) return;

    const style = document.createElement('style');
    style.id = 'mapbox-3d-controls-style';
    style.textContent = `
      .mapbox-3d-controls {
        position: absolute;
        top: 20px;
        right: 60px; /* Décalé gauche */
        z-index: 1000; /* High Z-index */
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: auto;
      }
      
      .control-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
        background: white;
        border-radius: 8px;
        padding: 8px;
        box-shadow: 0 0 0 2px rgba(0,0,0,0.1);
      }
      
      .control-row {
        display: flex;
        gap: 5px;
        justify-content: space-between;
      }
      
      .control-btn.small {
        flex: 1;
        padding: 4px;
        min-width: unset;
        font-size: 14px;
      }
      
      .control-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        background: white;
        color: #333;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 6px 10px;
        cursor: pointer;
        transition: all 0.2s;
        font-size: 13px;
        font-weight: 600;
        height: 32px;
      }
      
      .control-btn:hover {
        background: #f5f5f5;
      }
      
      .control-btn.active {
        background: #047857;
        color: white;
        border-color: #047857;
      }
      
      .icon-3d, .icon-reset, .icon-locate {
        font-size: 16px;
      }
    `;

    document.head.appendChild(style);
  }

  // Gestion des véhicules
  addVehicle(vehicleId, position, options = {}) {
    const defaultOptions = {
      color: '#3b82f6',
      label: vehicleId,
      type: 'bus',
      popupContent: `Véhicule: ${vehicleId}`,
      // rotation: 0, // Remove default rotation
      ...options
    };

    // Créer un conteneur principal (positionné par Mapbox)
    const container = document.createElement('div');
    container.className = 'vehicle-marker-container';

    // Créer un élément interne pour l'animation et le style
    const el = document.createElement('div');
    el.className = 'vehicle-marker';
    // Use custom SVG if provided, else fallback to internal getVehicleIcon
    el.innerHTML = defaultOptions.customIcon || this.getVehicleIcon(defaultOptions.type);

    // Style de l'élément interne
    // Face Right by default using ScaleX(-1) if the source image faces Left
    // BUT specific icons might already have scaleX. Removing global scaleX to avoid double-flip.
    el.style.cssText = `
      font-size: 24px;
      transform-origin: center center;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      cursor: pointer;
    `;

    container.appendChild(el);

    const marker = new mapboxgl.Marker({
      element: container,
      anchor: 'center', // Center anchor allows better rotation
      rotation: defaultOptions.rotation || 0
    })
      .setLngLat(position)
      .setPopup(new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div class="vehicle-popup">
            <h4>${defaultOptions.label}</h4>
            <p>ID: ${vehicleId}</p>
            <p>Position: ${position[0].toFixed(4)}, ${position[1].toFixed(4)}</p>
            ${defaultOptions.popupContent}
          </div>
        `))
      .addTo(this.map);

    // Animation de flottement en 3D sur l'élément INTERNE seulement
    if (this.is3DEnabled) {
      this.animateVehicleFloat(el);
    }

    this.vehicles.set(vehicleId, { marker, innerElement: el, options: defaultOptions, coords: position }); // Store initial coords
    return marker;
  }

  // Add Static Location Marker (Agencies/Stations)
  addLocationMarker(id, position, options = {}) {
    const defaultOptions = {
      color: '#ef4444',
      icon: '🏢',
      label: 'Lieu',
      popupContent: '',
      ...options
    };

    const el = document.createElement('div');
    el.className = 'location-marker';
    el.innerHTML = `<div style="font-size: 24px;">${defaultOptions.icon}</div>`;
    el.style.cursor = 'pointer';

    const marker = new mapboxgl.Marker({
      element: el,
      anchor: 'bottom'
    })
      .setLngLat(position)
      .setPopup(new mapboxgl.Popup({ offset: 25 })
        .setHTML(`
          <div class="location-popup">
            <h4>${defaultOptions.label}</h4>
            ${defaultOptions.popupContent}
          </div>
        `))
      .addTo(this.map);

    this.markers.set(id, marker);
    return marker;
  }

  getVehicleIcon(type) {
    const icons = {
      bus: '🚌',
      car: '🚗',
      truck: '🚚',
      van: '🚐',
      default: '📍'
    };
    return icons[type] || icons.default;
  }

  animateVehicleFloat(element) {
    if (!this.is3DEnabled) return;

    let floatHeight = 0;
    let direction = 1;

    // Utiliser une propriété unique pour stopper l'animation si besoin
    element._animationId = Math.random();
    const currentAnimId = element._animationId;

    const animate = () => {
      if (!this.is3DEnabled || element._animationId !== currentAnimId) return;

      floatHeight += 0.05 * direction;
      if (floatHeight > 5) direction = -1;
      if (floatHeight < 0) direction = 1;

      // On anime translateY sur l'élément interne, ce qui est safe
      // Le 'translate(-50%, -100%)' n'est plus nécessaire car 'anchor: bottom' de Mapbox gère le centrage
      const flipTransform = element._flipState || 'scaleX(1)';
      element.style.transform = `${flipTransform} translateY(${-floatHeight}px)`;

      requestAnimationFrame(animate);
    };

    animate();
  }

  updateVehiclePosition(vehicleId, newPosition, bearing = null) {
    const vehicle = this.vehicles.get(vehicleId);
    if (vehicle) {
      vehicle.marker.setLngLat(newPosition);

      // Flip Logic (Mirror Left/Right)
      // Check if we need to flip the icon horizontally (Mirror East/Right)
      // Bearing or Direction logic passed from caller?
      // Let's assume the 3rd arg is now 'options' or specific 'shouldFlip' boolean

      // Let's repurpose 'bearing' argument as 'heading' or 'options' object in future, 
      // but for now let's just use it as is, or introduce a new way.
      // Calling code (map.js) calculates bearing.
      // If Bearing is between 0 and 180 (East-ish), we might want to flip.
      // Actually simpler: pass explicit "flip" boolean.

      const shouldFlip = (typeof bearing === 'boolean') ? bearing : false;

      vehicle.flip = shouldFlip; // Store state

      // Update transform immediately (will be overwritten by animation loop next frame, so we need to update animation loop too)
      // But we can trigger a style update here too if animation is not running?
      // Automation loop reads 'vehicle' state? No, it reads 'element'.
      // Let's store 'flip' on the element or the vehicle object and have the animation loop read it.
      vehicle.innerElement._flipState = shouldFlip ? 'scaleX(-1)' : 'scaleX(1)';

      // Pas besoin de toucher au transform du marker, Mapbox le fait.
      // On peut ajouter une transition CSS sur le marker container si on veut être fluide sur la carte
      // Mais attention, Mapbox met à jour 'transform' à chaque frame en mouvement, 
      // donc les transitions CSS sur 'transform' du conteneur Mapbox peuvent créer du lag.
      // Mieux vaut laisser Mapbox gérer le positionnement instantané ou utiliser animateMarkerTo de Mapbox si dispo.
      // Pour l'instant on fait simple setLngLat.

      // Recentrer si c'est le seul véhicule
      if (this.vehicles.size === 1 && this.config.autoCenter) {
        this.map.easeTo({
          center: newPosition,
          duration: 1000
        });
      }

      vehicle.coords = newPosition; // Update stored coords for next bearing calc
    }
  }

  removeVehicle(vehicleId) {
    const vehicle = this.vehicles.get(vehicleId);
    if (vehicle) {
      vehicle.marker.remove();
      this.vehicles.delete(vehicleId);
    }
  }

  // Gestion des routes
  addRoute(routeId, coordinates, options = {}) {
    const defaultOptions = {
      color: '#3b82f6',
      width: 5,
      opacity: 0.8,
      show3D: false, // Désactivé par défaut car l'extrusion ne suit pas le terrain
      ...options
    };

    // Source GeoJSON
    this.map.addSource(`route-${routeId}`, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    });

    // Ligne Principale (Drapée sur le terrain)
    this.map.addLayer({
      id: `route-line-${routeId}`,
      type: 'line',
      source: `route-${routeId}`,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': defaultOptions.color,
        'line-width': defaultOptions.width,
        'line-opacity': defaultOptions.opacity
      }
    });

    // Bordure de ligne pour meilleur contraste (optionnel, style "casing")
    this.map.addLayer({
      id: `route-casing-${routeId}`,
      type: 'line',
      source: `route-${routeId}`,
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#ffffff',
        'line-width': defaultOptions.width + 2,
        'line-opacity': 0.5
      }
    }, `route-line-${routeId}`); // Insérer SOUS la ligne principale
  }

  // Supprimer une route
  removeRoute(routeId) {
    if (this.map.getLayer(`route-casing-${routeId}`)) this.map.removeLayer(`route-casing-${routeId}`);
    if (this.map.getLayer(`route-line-${routeId}`)) this.map.removeLayer(`route-line-${routeId}`);
    if (this.map.getSource(`route-${routeId}`)) this.map.removeSource(`route-${routeId}`);
  }

  // Changer le style de la carte
  setMapStyle(styleUrl) {
    this.map.setStyle(styleUrl);

    // Réappliquer les couches 3D après changement de style
    this.map.once('styledata', () => {
      // Recréer les sources et layers car ils sont supprimés lors du changement de style
      this.init3DLayers();

      // Restaurer les routes
      this.routes.forEach((route, id) => {
        // TODO: réimplémenter l'ajout de route proprement de manière réactive
      });

      if (this.is3DEnabled) {
        this.enable3DView();
      }
    });
  }

  // Nettoyage
  destroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }

    // Supprimer tous les marqueurs
    this.vehicles.forEach(vehicle => vehicle.marker.remove());
    this.vehicles.clear();

    // Supprimer les contrôles personnalisés
    const controls = document.querySelector('.mapbox-3d-controls');
    if (controls) controls.remove();
  }
}

// Fonction d'initialisation simplifiée pour inclusion rapide
export function initMapbox3D(options) {
  return new Mapbox3DManager(options);
}
