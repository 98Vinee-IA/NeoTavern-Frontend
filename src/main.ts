import { fixToastrForDialogs } from './components/Popup';
import { RightMenu } from './components/RightMenu';
import { token } from './state/Store';
import './styles/main.scss';
import '@fortawesome/fontawesome-free/css/all.min.css';

import toastr from 'toastr';

toastr.options = {
  positionClass: 'toast-top-center',
  closeButton: false,
  progressBar: false,
  showDuration: 250,
  hideDuration: 250,
  timeOut: 4000,
  extendedTimeOut: 10000,
  showEasing: 'linear',
  hideEasing: 'linear',
  showMethod: 'fadeIn',
  hideMethod: 'fadeOut',
  escapeHtml: true,
  onHidden: function () {
    // If we have any dialog still open, the last "hidden" toastr will remove the toastr-container. We need to keep it alive inside the dialog though
    // so the toasts still show up inside there.
    fixToastrForDialogs();
  },
  onShown: function () {
    // Set tooltip to the notification message
    // $(this).attr('title', t`Tap to close`);
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  const topBar = document.getElementById('top-settings-holder');
  if (!topBar) throw new Error('Top settings holder not found');

  topBar.querySelectorAll('.drawer-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggle.nextElementSibling?.classList.toggle('active');
      toggle.querySelector('.drawer-icon')?.classList.toggle('active');
    });
  });

  new RightMenu();

  try {
    const tokenResponse = await fetch('/csrf-token');
    const tokenData = await tokenResponse.json();
    token.set(tokenData.token);
  } catch {
    toastr.error(`Couldn't get CSRF token. Please refresh the page.`, `Error`, {
      timeOut: 0,
      extendedTimeOut: 0,
      preventDuplicates: true,
    });
    throw new Error('Initialization failed');
  }
});
