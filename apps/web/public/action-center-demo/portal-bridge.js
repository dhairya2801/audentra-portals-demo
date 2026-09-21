// Portal-only navigation adapter. Approved workspace modules remain unchanged.
import { toast } from './src/ui.js';
import { SPACES, BOARDS } from './src/data.js';
import { view, switchBoard } from './src/board.js';
import { store } from './src/store.js';
import { currentTask } from './src/detail.js';

let previous = '';
function publish() {
  const state = {
    type: 'audentra:approved-board:state',
    taskContext: {surface:'task_board', project:view.board,
      ...(document.querySelector('#task-dialog[open]') && currentTask() ? {workItemKey:currentTask().key} : {})},
    dialogOpen: !!document.querySelector('dialog[open]'),
    navigation: { board: view.board, spaces: SPACES.map(space => ({
      id: space.id, name: space.name, color: space.color,
      boards: space.boards.map(id => ({ id, name: BOARDS[id].name, count: store.tasks.filter(task => task.board === id && task.status !== 'completed').length })),
    })) },
  };
  const encoded = JSON.stringify(state);
  if (encoded !== previous) { previous = encoded; parent.postMessage(state, location.origin); }
}
new MutationObserver(publish).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
window.addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== parent) return;
  if (event.data?.type === 'audentra:approved-board:select' && BOARDS[event.data.board]) switchBoard(event.data.board);
});
document.addEventListener('click', event => {
  if (!event.target.closest('[data-action="copy-task"]')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  const key = document.querySelector('.detail-breadcrumb strong')?.textContent;
  if (!key) return;
  const url = new URL(parent.location.href);
  url.searchParams.set('actionTask', key); url.hash = 'tasks';
  navigator.clipboard?.writeText(url.href).then(() => toast(`${key} link copied`)).catch(() => toast('Task link: ' + url.href));
}, true);
publish();
