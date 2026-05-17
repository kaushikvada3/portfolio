export class LayerManager {
  constructor() {
    this._layers = {
      cells:   { label: 'Standard Cells',    visible: true,  color: '#7a2090' },
      m1:      { label: 'Metal 1 (Horiz)',    visible: true,  color: '#00c8c8' },
      m2:      { label: 'Metal 2 (Vert)',     visible: true,  color: '#00b8d4' },
      m3:      { label: 'Metal 3 (H-Power)',  visible: true,  color: '#00d4a0' },
      m4:      { label: 'Metal 4 (V-Power)',  visible: true,  color: '#00a8d4' },
      signals: { label: 'Signal Animation',   visible: true,  color: '#e0b96c' },
    };
    this._listeners = [];
  }

  isVisible(id) {
    return this._layers[id]?.visible ?? false;
  }

  toggle(id) {
    if (this._layers[id]) {
      this._layers[id].visible = !this._layers[id].visible;
      this._notify();
    }
  }

  setVisible(id, val) {
    if (this._layers[id]) {
      this._layers[id].visible = val;
      this._notify();
    }
  }

  getAll() {
    return Object.entries(this._layers).map(([id, def]) => ({ id, ...def }));
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _notify() {
    this._listeners.forEach(fn => fn());
  }
}
