// Field extraction belongs to the document service. No synthetic field values.
export function reviewSummary(task){return {flagged:task.document?.flaggedFields||[],pending:[],accepted:[],corrections:[],empty:[]};}
