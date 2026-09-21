// Connected records are fetched through the portal API client; remaining workflow state is preview-only.
import { PEOPLE, seedTasks } from './data.js';

let snapshot = null;
export function boardRequest(operation, payload) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const receive = event => {
      if (event.origin !== location.origin || event.source !== parent ||
          event.data?.type !== 'audentra:board:response' || event.data.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', receive);
      if (event.data.error) reject(Object.assign(new Error(event.data.error), {code:event.data.errorCode}));
      else resolve(event.data.result);
    };
    const timer = setTimeout(() => {
      window.removeEventListener('message', receive);
      reject(new Error('The requested data could not load. Please retry.'));
    }, 15000);
    window.addEventListener('message', receive);
    parent.postMessage({ type:'audentra:board:request', operation, payload, id }, location.origin);
  });
}
export async function loadIdentities() {
  snapshot = await boardRequest('demo-identities');
  if (!snapshot?.cards?.length || !snapshot.staff?.id) throw new Error('The demo board has not been configured.');
  PEOPLE.ML = {name:snapshot.staff.name, role:snapshot.staff.title || snapshot.staff.component,
    color:'purple', initials:snapshot.staff.name.split(' ').map(part => part[0]).slice(0,2).join('')};
}

function replaceText(value, replacements) {
  if (typeof value === 'string') {
    for (const [from, to] of replacements) if (from && to) value = value.replaceAll(from, to);
    return value;
  }
  if (Array.isArray(value)) return value.map(item => replaceText(item, replacements));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, ['owner','who'].includes(key) && ['AR','SP','JC'].includes(item) ? 'ML' : replaceText(item, replacements)]));
  return value;
}

export function identityTasks(previews = []) {
  if (!snapshot) return [];
  const templates = new Map(seedTasks().map(task => [task.key, task]));
  const saved = new Map(previews.map(task => [task.workItemId || task.id, task]));
  return snapshot.cards.map(card => {
    const original = templates.get(card.templateKey);
    if (!original) throw new Error('The demo board template needs to be updated.');
    const preview = saved.get(card.id) || original;
    const student = card.student;
    const replacements = [
      ['Maya Anika Patel', student.name],
      [preview.student, student.name], [original.student, student.name],
      [preview.student?.split(' ')[0], student.preferredName], [original.student.split(' ')[0], student.preferredName],
      ['Marcus Lee', snapshot.staff.name], ['Amelia Rivera', snapshot.staff.name],
      ['Sarah Park', snapshot.staff.name], ['James Chen', snapshot.staff.name],
    ];
    const task = replaceText(structuredClone(preview), replacements);
    const term = /^(\d{4})(FA|SP|SU)$/.exec(student.admitTerm || '');
    Object.assign(task, {
      id:card.id, workItemId:card.id, templateKey:card.templateKey, backendVersion:card.version,
      key:card.key, board:card.board, title:card.title,
      student:student.name, preferredName:student.preferredName, studentId:student.externalRef,
      studentRecordId:student.id, studentEmail:student.email, program:student.program,
      cohort:term ? `${{FA:'Fall',SP:'Spring',SU:'Summer'}[term[2]]} ${term[1]}` : `Class of ${student.classYear}`,
      advisor:snapshot.staff.name, staffRecordId:snapshot.staff.id,
    });
    task.documents = card.documents || [];
    const doc = task.documents[0];
    if (doc) {
      const changed = preview.documents?.[0]?.id !== doc.id;
      Object.assign(task, {uploaded:doc.uploadedAt, actualDocument:doc, version:task.documents.length,
        created:card.createdAt||task.created, source:'Student portal upload'});
      if (changed) {
        Object.assign(task, {status:'processing', owner:'ML', entered:doc.uploadedAt,
          updated:doc.uploadedAt, due:new Date(Date.parse(doc.uploadedAt)+48*3600000).toISOString(),
          labels:['Document uploaded'], resolved:[], exceptions:[], sourceExceptions:[], visited:[]});
        delete task.review;
        task.activity = [];
      }
      if (doc.status === 'accepted') {task.status = 'completed';task.due=null;}
      else if (doc.status === 'rejected') task.status = 'correction';
      else if (['completed','correction','requested','resubmitted'].includes(task.status)) task.status = 'processing';
      task.correctionNote = doc.decisions?.[0]?.note || '';
    } else delete task.actualDocument;
    task.requirements = card.requirements || [];
    task.conversations = card.conversations || [];
    task.created = card.createdAt;
    task.activity = (card.activity || []).map(e => ({id:e.id, who:e.actorType==='student'?'student':e.actor,
      text:e.message,at:e.createdAt,kind:e.action==='commented'?'comment':e.action==='communication_recorded'?'communication':'history'}));
    if (!task.activity.length) task.activity = [{who:'ML',text:'Task assigned to '+snapshot.staff.name,at:card.createdAt,kind:'history'}];
    // Canonical operational fields override cached preview values, including
    // confirmed Edward edits. Workflow stages and parser previews remain mock.
    task.updated = card.updatedAt;
    task.priority = card.priority[0].toUpperCase()+card.priority.slice(1);
    task.due = card.dueAt;
    task.nextStep = card.nextStep;
    task.operationalStatus = card.status;
    task.messages = (task.conversations[0]?.messages || []).map(m=>({who:m.direction==='student'?'student':'ML',
      text:m.body,at:m.createdAt,channel:'Student portal'}));
    if (!doc && task.requirements.length && task.type==='document') task.status='requested';
    if (task.owner !== 'EG' && task.owner !== 'TEAM') task.owner = 'ML';
    return task;
  });
}

export function identityStorageKey() {
  return snapshot ? `audentra.demo-board.preview:${snapshot.scenarioVersion}:${snapshot.staff.id}` : null;
}
