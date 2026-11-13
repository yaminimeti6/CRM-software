type Status = {label:string;category:string};
export function statusHelp(status?:Status):string {
 if(!status)return 'Choose the result of the call you actually made.';
 if(status.category==='new')return 'New inquiry. This status does not mean a call has been made.';
 if(status.category==='confirmed')return 'Marks the order confirmed. A call is counted only when you save a call result.';
 if(status.category==='cancelled')return 'Marks the order cancelled. Any pending follow-up stays pending until completed or cancelled separately.';
 if(status.label.trim().toUpperCase()==='CNP')return 'The meaning of CNP has not been defined in this CRM. Check with your team before choosing it.';
 if(status.label.trim().toLowerCase()==='retry')return 'Use for another contact attempt. This status does not set a next-call date; schedule a follow-up separately.';
 return 'Team-defined status. It does not automatically schedule or complete a follow-up.';
}
