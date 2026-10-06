// =========================================================
// TASK TEMPLATES
// File ini hanya "jembatan" agar TaskDeadlineModule otomatis
// memakai template baru yang ada di deadlineTemplates.ts
// =========================================================

export {
  DEADLINE_TEMPLATES as TASK_TEMPLATES,
  STAGE_INFO as STAGE_INFO_TASK,
} from './deadlineTemplates';

export type { DeadlineTemplate as TaskTemplate } from './deadlineTemplates';
