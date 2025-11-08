import { RightMenu } from './components/RightMenu';
import './styles/main.scss';
import '@fortawesome/fontawesome-free/css/all.min.css';

document.addEventListener('DOMContentLoaded', () => {
  const topBar = document.getElementById('top-settings-holder');
  if (!topBar) throw new Error('Top settings holder not found');

  topBar.querySelectorAll('.drawer-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      toggle.nextElementSibling?.classList.toggle('active');
      toggle.querySelector('.drawer-icon')?.classList.toggle('active');
    });
  });

  new RightMenu();
});
