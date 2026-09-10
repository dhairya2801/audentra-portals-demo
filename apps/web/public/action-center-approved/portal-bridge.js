// Portal-only integration. The approved prototype files stay byte-for-byte intact.
import { toast } from './src/ui.js';

const destinations = {
  'Morning Brew': 'morning_brew',
  'Student 360': 'student_360',
  'Messages': 'messages',
  'Institution profile': 'institution_profile',
  'Academics': 'academics',
  'Campus Life': 'campus_life',
  'Knowledge base': 'knowledge',
};

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action], a.brand');
  if (!target) return;
  const action = target.dataset.action;
  const destination = target.matches('a.brand') ? 'morning_brew' : destinations[action?.replace(/^shell:/, '')];
  if (destination) {
    event.preventDefault();
    event.stopImmediatePropagation();
    parent.postMessage({ type: 'audentra:approved-board:navigate', destination }, location.origin);
  } else if (action === 'copy-task') {
    event.preventDefault();
    event.stopImmediatePropagation();
    const key = document.querySelector('.detail-breadcrumb strong')?.textContent;
    if (!key) return;
    const url = new URL(parent.location.href);
    url.searchParams.set('actionTask', key);
    url.hash = 'tasks';
    navigator.clipboard?.writeText(url.href)
      .then(() => toast(`${key} link copied`))
      .catch(() => toast('Task link: ' + url.href));
  }
}, true);
