export class RightMenu_HotSwap {
  readonly panelPinCheckbox = document.getElementById('rm_button_panel_pin') as HTMLInputElement;
  constructor() {
    // this.panelPinCheckbox.checked = set initial from saved state
    this.panelPinCheckbox.nextElementSibling?.addEventListener('click', () => {
      const iconEl = this.panelPinCheckbox.nextElementSibling?.querySelector('.right-menu-button');
      if (!iconEl) throw new Error('Icon element not found');
      if (this.panelPinCheckbox.checked) {
        iconEl.classList.replace('fa-unlock', 'fa-lock');
      } else {
        iconEl.classList.replace('fa-lock', 'fa-unlock');
      }
    });
  }
}
