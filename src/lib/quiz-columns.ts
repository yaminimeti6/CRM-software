export type QuizColumn={id:string;field_key:string;label:string;source_id:string|null;form_version:string|null};
export type QuizScope={source_id:string;form_version:string}|null;
export function columnApplies(column:QuizColumn,scope:QuizScope){return column.source_id===null?scope===null:scope!==null&&column.source_id===scope.source_id&&column.form_version===scope.form_version;}
