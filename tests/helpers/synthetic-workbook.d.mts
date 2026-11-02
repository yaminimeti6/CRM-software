export function zip(entries:Record<string,string|Uint8Array>):Buffer;
export function workbook(sheets:{name:string;rows:(string|number|null|{number:number;style?:number}|{formula:string})[][]}[]):Buffer;
