'use client'

import {useRef,useState,type FormEvent} from 'react'
import {api} from '@/lib/api'
import {Button,Field,Input,Modal} from './ui'

export type AccessRule={target_type:string;target_id:number;max_attempts:number;deadline_at:string|null}
export type AccessTarget={id:number;title:string;kind:'item'|'section';type?:string;section_id?:number|null;access_restricted?:boolean;access_configured?:boolean;access_group_ids?:number[];access_student_ids?:number[];quiz_access_rules?:AccessRule[]}
export type AccessStudent={id:number;full_name:string;email:string;groups:Array<{id:number;code:string}>}
export type AccessGroup={id:number;code:string;title:string;student_count:number}
const toggle=(ids:number[],id:number)=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]
export default function ContentAccessModal({courseId,target,students,groups,parent,onClose,onSaved}:{courseId:number;target:AccessTarget;students:AccessStudent[];groups:AccessGroup[];parent?:Omit<AccessTarget,'kind'>;onClose:()=>void;onSaved:()=>Promise<unknown>}){
 const [tab,setTab]=useState<'students'|'groups'>('students')
 const [query,setQuery]=useState('')
 const [studentIds,setStudents]=useState(target.access_student_ids??[])
 const [groupIds,setGroups]=useState(target.access_group_ids??[])
 const [restricted,setRestricted]=useState(target.access_restricted??true)
 const rules=target.quiz_access_rules??[]
 const mixed=new Set(rules.map(x=>`${x.max_attempts}:${x.deadline_at??''}`)).size>1
 const [attempts,setAttempts]=useState(String(!mixed&&rules[0]?rules[0].max_attempts:1))
 const [deadline,setDeadline]=useState(()=>{const d=!mixed&&rules[0]?.deadline_at?new Date(rules[0].deadline_at):null;return d?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16):''})
 const [dirty,setDirty]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const lock=useRef(false)
 const [confirmed,setConfirmed]=useState(false)
 const revoking=(target.access_student_ids??[]).some(id=>!studentIds.includes(id))||(target.access_group_ids??[]).some(id=>!groupIds.includes(id))||(target.kind==='section'&&restricted&&!target.access_restricted)
 const assessed=target.kind==='item'&&target.type==='quiz'
 const needsConfirmation=target.kind==='item'&&revoking
 const directGroup=(student:AccessStudent,ids:number[])=>student.groups.some(g=>ids.includes(g.id))
 function effective(student:AccessStudent){
  if(target.kind==='section'&&!restricted)return 'Материалдардың жеке ережелері қолданылады'
  if(dirty&&(!Number.isInteger(Number(attempts))||Number(attempts)<1||Number(attempts)>100))return 'Тапсыру санын енгізіңіз'
  const inherited=parent?.access_restricted
  const parentAllowed=!inherited||(parent.access_student_ids??[]).includes(student.id)||directGroup(student,parent.access_group_ids??[])
  if(!parentAllowed)return 'Бөлім рұқсаты жоқ'
  const selected=studentIds.includes(student.id)||directGroup(student,groupIds)
  if(!selected&&!(inherited&&!target.access_configured&&!studentIds.length&&!groupIds.length))return 'Рұқсат берілмеген'
  if(!assessed)return selected?'Рұқсат таңдалған':'Бөлімнен мұраланған'
  const applies=(r:AccessRule)=>r.target_type==='student'?r.target_id===student.id:student.groups.some(g=>g.id===r.target_id)
  const currentRules=dirty?[...studentIds.map(id=>({target_type:'student',target_id:id,max_attempts:Number(attempts),deadline_at:deadline?new Date(deadline).toISOString():null})),...groupIds.map(id=>({target_type:'group',target_id:id,max_attempts:Number(attempts),deadline_at:deadline?new Date(deadline).toISOString():null}))]:[
   ...rules.filter(r=>r.target_type==='student'?studentIds.includes(r.target_id):groupIds.includes(r.target_id)),
   ...studentIds.filter(id=>!rules.some(r=>r.target_type==='student'&&r.target_id===id)).map(id=>({target_type:'student',target_id:id,max_attempts:1,deadline_at:null})),
   ...groupIds.filter(id=>!rules.some(r=>r.target_type==='group'&&r.target_id===id)).map(id=>({target_type:'group',target_id:id,max_attempts:1,deadline_at:null}))]
  const applicable=[...currentRules,...(inherited?parent.quiz_access_rules??[]:[])].filter(applies)
  if(!applicable.length)return 'Тест рұқсаты жоқ'
  const dates=applicable.flatMap(r=>r.deadline_at?[r.deadline_at]:[]).sort((a,b)=>Date.parse(a)-Date.parse(b))
  return `${Math.min(...applicable.map(r=>r.max_attempts))} әрекет · ${dates[0]?new Date(dates[0]).toLocaleString():'мерзімсіз'}`
 }
 async function save(event:FormEvent){event.preventDefault();if(lock.current||needsConfirmation&&!confirmed)return;lock.current=true;setBusy(true);setError(null)
  try{await api(target.kind==='section'?`/courses/${courseId}/sections/${target.id}/access`:`/courses/items/${target.id}/access`,{method:'PUT',body:{student_ids:studentIds,group_ids:groupIds,...(target.kind==='section'?{access_restricted:restricted}:{}),...(assessed&&dirty?{quiz_rules:{max_attempts:Number(attempts),deadline_at:deadline?new Date(deadline).toISOString():null}}:{})}});await onSaved();onClose()}
  catch(err){setError((err as Error).message)}finally{lock.current=false;setBusy(false)}
 }
 const search=query.trim().toLocaleLowerCase()
 return <Modal open onClose={()=>{if(!lock.current)onClose()}} closeDisabled={busy} title={target.kind==='section'?'Бөлімге қолжетімділік':'Тақырыпқа қолжетімділік'}>
  <form onSubmit={save} className="min-w-0 space-y-4">
   <p className="break-words font-semibold">{target.title}</p>
   <p className="text-xs leading-relaxed text-muted">Курсқа тіркелу міндетті. Бөлім шектеуі және материалдың жеке рұқсаттары қатар тексеріледі. Жеке және топтық рұқсаттар бір-бірін өшірмейді. Материал рұқсаттарын сақтағаннан кейін бос таңдау материалды барлығына жабады. Көріну, кезектілік және тест ережелері сақталады.</p>
   {target.kind==='section'&&<label className="flex gap-2 text-sm"><input type="checkbox" checked={restricted} onChange={e=>setRestricted(e.target.checked)}/>Бөлімді таңдалған оқушылар мен топтармен шектеу</label>}
   {target.kind==='section'&&!restricted&&<p className="text-xs text-muted">Бөлім қосымша шектеу қоймайды. Материалдардың бұрынғы жеке рұқсаттары қолданылады; бөлімдегі таңдаулар сақталады.</p>}
   {parent?.access_restricted&&<p className="text-xs text-primary">Бұл материал үшін «{parent.title}» бөлімінің рұқсаты да қажет.</p>}
   <div role="tablist" aria-label="Қолжетімділік нысандары" className="flex border-b border-border">{(['students','groups'] as const).map(value=><button key={value} type="button" role="tab" id={`access-${value}-tab`} aria-selected={tab===value} tabIndex={tab===value?0:-1} onKeyDown={event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?'students':event.key==='End'?'groups':value==='students'?'groups':'students';setTab(next);setQuery('');event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next==='students'?0:1]?.focus()}}} aria-controls={`access-${value}-panel`} className={`flex-1 px-2 py-3 text-sm ${tab===value?'border-b-2 border-primary font-semibold text-primary':'text-muted'}`} onClick={()=>{setTab(value);setQuery('')}}>{value==='students'?`Оқушылар (${studentIds.length})`:`Топтар (${groupIds.length})`}</button>)}</div>
   <Input aria-label={tab==='students'?'Оқушыны іздеу':'Топты іздеу'} placeholder={tab==='students'?'Аты немесе пошта бойынша іздеу':'Топты іздеу'} value={query} onChange={e=>setQuery(e.target.value)}/>
   <div role="tabpanel" id={`access-${tab}-panel`} aria-labelledby={`access-${tab}-tab`} className="max-h-64 space-y-2 overflow-y-auto">
    {tab==='students'?(students.length?students.filter(s=>`${s.full_name} ${s.email}`.toLocaleLowerCase().includes(search)).map(student=>{const direct=studentIds.includes(student.id),group=directGroup(student,groupIds);return <label key={student.id} className="flex min-w-0 items-start gap-3 rounded-lg border border-border p-3 text-sm"><input className="mt-1 shrink-0" type="checkbox" checked={direct} onChange={()=>{setStudents(ids=>toggle(ids,student.id));if(target.kind==='section')setRestricted(true)}}/><span className="min-w-0"><strong className="block break-words">{student.full_name}</strong><span className="block break-all text-xs text-muted">{student.email}</span><span className="block text-xs text-primary">{direct&&group?'Жеке және топ арқылы':direct?'Жеке рұқсат':group?'Топ арқылы':'Жеке рұқсат жоқ'}</span><span className="block text-xs text-muted">{effective(student)}</span></span></label>}):<p className="text-sm text-muted">Курсқа тіркелген оқушы жоқ. Алдымен курсқа оқушы немесе топ қосыңыз.</p>):groups.length?groups.filter(g=>`${g.code} ${g.title}`.toLocaleLowerCase().includes(search)).map(group=><label key={group.id} className="flex min-w-0 gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" checked={groupIds.includes(group.id)} onChange={()=>{setGroups(ids=>toggle(ids,group.id));if(target.kind==='section')setRestricted(true)}}/><span className="min-w-0 break-words">{group.code} — {group.title}<small className="block text-muted">{group.student_count} оқушы</small></span></label>):<p className="text-sm text-muted">Курсқа топ қосылмаған. Жеке тіркелген оқушыларды «Оқушылар» қойындысынан таңдаңыз.</p>}
    {((tab==='students'?students.filter(s=>`${s.full_name} ${s.email}`.toLocaleLowerCase().includes(search)):groups.filter(g=>`${g.code} ${g.title}`.toLocaleLowerCase().includes(search))).length===0)&&search&&<p className="text-sm text-muted">Іздеу нәтижесі жоқ.</p>}
   </div>
   {target.kind==='item'&&<a className="block text-sm text-primary underline" href="#course-enrollments" onClick={onClose}>Курсқа тіркелуді басқару</a>}
   {assessed&&<div className="space-y-2"><p className="text-sm font-semibold">Тест шектеулері</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Тапсыру саны"><Input type="number" min={1} max={100} step={1} required value={attempts} onChange={e=>{setAttempts(e.target.value);setDirty(true)}}/></Field><Field label="Тапсыру мерзімі"><Input type="datetime-local" value={deadline} onChange={e=>{setDeadline(e.target.value);setDirty(true)}}/></Field></div><p className="text-xs text-muted">Өзгертпесеңіз, бұрынғы шектеулер сақталады. Жаңа рұқсат: 1 әрекет, мерзімсіз. Қабаттасқанда ең аз әрекет саны және ең ерте мерзім қолданылады. Басталған әрекеттің таймері өзгермейді.</p>{mixed&&!dirty&&<p role="status" className="text-xs text-muted">Бұрынғы рұқсаттардың шектеулері әртүрлі. Әр оқушының тиімді шектеуі тізімде көрсетілген.</p>}</div>}
   {needsConfirmation&&<label className="flex gap-2 text-sm"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Қолжетімділіктің шектелетінін растаймын. Нәтижелер мен тіркелімдер сақталады.</label>}
   {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
   <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Бас тарту</Button><Button type="submit" disabled={busy||needsConfirmation&&!confirmed}>{busy?'Сақталуда…':'Сақтау'}</Button></div>
  </form>
 </Modal>
}
