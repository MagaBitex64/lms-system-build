// BUG-002 regression. Disposable localhost:3101/8101 stack only. No real users.
const {chromium,request}=require(process.env.PLAYWRIGHT_MODULE||'playwright')
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process')
const creds=JSON.parse(fs.readFileSync(process.env.E2E_CREDENTIALS_FILE))
const meta=JSON.parse(fs.readFileSync(process.env.E2E_META_FILE))
const output=process.env.E2E_OUTPUT||'/tmp/fenomen-proctor';fs.mkdirSync(output,{recursive:true})
const results=[]
;(async()=>{
 const transport=await request.newContext({baseURL:'http://localhost:8101'})
 const a=await transport.post('/auth/login',{data:{email:creds.email,password:creds.password}});assert(a.ok())
 const ah={Authorization:'Bearer '+(await a.json()).token}
 const before=await (await transport.get(`/ent-trial/admin/attempts/${meta.attemptId}/review`,{headers:ah})).json()
 // Unique synthetic user per run avoids cross-run login rate-limit interference.
 const crypto=require('node:crypto')
 const account=await transport.post('/admin/users',{headers:ah,data:{email:`proctor-${crypto.randomUUID()}@e2e.example.com`,full_name:'Proctor regression fixture',role:'student'}})
 assert(account.ok());const created=await account.json()
 const login=await transport.post('/auth/login',{data:{email:created.email,password:created.temporary_password}})
 assert(login.ok());const initial=(await login.json()).token
 const personal=crypto.randomBytes(24).toString('base64url')
 const setup=await transport.post('/auth/setup-password',{headers:{Authorization:'Bearer '+initial},data:{new_password:personal,confirmation:personal}})
 assert(setup.ok());creds.studentEmail=created.email;creds.studentPassword=personal;meta.studentId=created.id

 let browser=await chromium.launch({executablePath:process.env.E2E_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--auto-select-desktop-capture-source=Entire screen','--enable-usermedia-screen-capturing']})
 let context,page,caps
 async function setupPage(){context=await browser.newContext({viewport:{width:1440,height:900},permissions:['camera']});page=await context.newPage();page.setDefaultTimeout(12000);await page.addInitScript(()=>{window.e2eStreams={};for(const [method,key]of [['getDisplayMedia','screen'],['getUserMedia','camera']]){const original=navigator.mediaDevices[method].bind(navigator.mediaDevices);navigator.mediaDevices[method]=async(...args)=>{const stream=await original(...args);window.e2eStreams[key]=stream;return stream}}});page.on('response',async r=>{if(r.url().endsWith('/proctor/activate')&&r.ok()){const value=await r.json();caps={session_id:r.request().postDataJSON().session_id,proctor_token:value.proctor_token}}});await page.goto('http://localhost:3101/login');await page.getByRole('textbox',{name:'Электрондық пошта',exact:true}).fill(creds.studentEmail);await page.getByRole('textbox',{name:'Құпиясөз',exact:true}).fill(creds.studentPassword);await page.getByRole('button',{name:'Жүйеге кіру',exact:true}).click();await page.waitForURL('**/dashboard')}
 async function test(name,fn){try{await fn();results.push({name,status:'PASS'})}catch(e){results.push({name,status:'FAIL',error:e.message.slice(0,700)});await page.screenshot({path:`${output}/failure-${results.length}.png`,fullPage:true}).catch(()=>{})}fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2))}
 async function activate(camera){await page.getByRole('heading',{name:'Assessment full fixture',exact:true}).waitFor();if(camera&&await page.getByRole('button',{name:/Камераны/}).count()){await page.getByRole('button',{name:/Камераны/}).click();await page.getByRole('button',{name:/Бүкіл экранды бөлісу|Толық экранды қосып/}).waitFor();}if(await page.getByRole('button',{name:/Бүкіл экранды бөлісу/}).count())await page.getByRole('button',{name:/Бүкіл экранды бөлісу/}).click();await page.getByRole('button',{name:/Толық экранды қосып/}).click();await page.getByRole('button',{name:'Тестті аяқтау',exact:true}).waitFor()}
 try{
 for(const camera of [false,true]){
 await setupPage()
 const token=await page.evaluate(()=>sessionStorage.getItem('lms_token')),sh={Authorization:'Bearer '+token}
 const access=await transport.post('/ent-trial/admin/accesses',{headers:ah,data:{variant_id:meta.variantId,target_type:'student',student_id:meta.studentId,camera_required:camera,max_attempts:1}});assert(access.ok());const accessId=(await access.json()).id
 const started=await transport.post(`/ent-trial/accesses/${accessId}/start`,{headers:sh});assert(started.ok());const aid=(await started.json()).attempt_id,path=`/ent-trial/attempts/${aid}`
 await page.goto('http://localhost:3101/ent-trial/'+aid)
 await test(`camera=${camera}: initial writes blocked`,async()=>{const r=await transport.patch(path+'/answers',{headers:sh,data:{revision:0,answers:[]}});assert([403,409].includes(r.status()))})
 await test(`camera=${camera}: normal browser activation`,()=>activate(camera))
 const original=await (await transport.get(path,{headers:sh})).json()
 const q=Object.values(original.questions).flat()[0]
 await test(`camera=${camera}: browser answer saved`,async()=>{await page.getByRole('radio').first().check();await page.waitForTimeout(1000);const saved=await (await transport.get(path,{headers:sh})).json();assert.equal(saved.questions[q.subject][0].selected_option_id,q.options[0].id)})
 let previous={...caps}
 await test(`camera=${camera}: refresh blocks UI and tokenless API`,async()=>{await page.reload();await page.getByRole('heading',{name:'Assessment full fixture',exact:true}).waitFor();assert.equal(await page.getByRole('radio').count(),0);const saved=await (await transport.get(path,{headers:sh})).json();const r=await transport.patch(path+'/answers',{headers:sh,data:{revision:saved.revision,answers:[]}});assert.equal(r.status(),403);await page.screenshot({path:`${output}/reload-camera-${camera}.png`,fullPage:true})})
 await test(`camera=${camera}: resume, stale capability rejected, timer/answers kept`,async()=>{await activate(camera);const saved=await (await transport.get(path,{headers:sh})).json();assert.equal(saved.deadline_at,original.deadline_at);assert.equal(saved.started_at,original.started_at);assert.equal(saved.questions[q.subject][0].selected_option_id,q.options[0].id);const r=await transport.patch(path+'/answers',{headers:sh,data:{...previous,revision:saved.revision,answers:[]}});assert.equal(r.status(),403)})
 await test(`camera=${camera}: expired session rejected`,async()=>{execFileSync('docker',['compose','-p','fenomen-e2e','-f','/tmp/fenomen-e2e-run/compose.yml','exec','-T','db','psql','-U','e2e','-d','fenomen_e2e','-c',`UPDATE ent_trial_attempts SET proctor_last_seen_at=now()-interval '46 seconds' WHERE id=${aid}`],{stdio:'pipe'});const saved=await(await transport.get(path,{headers:sh})).json();assert.equal((await transport.patch(path+'/answers',{headers:sh,data:{...caps,revision:saved.revision,answers:[]}})).status(),403);await page.reload();await page.getByRole('button',{name:/Бүкіл экранды бөлісу|Камераны/}).waitFor();await activate(camera)})
 await test(`camera=${camera}: fullscreen loss blocks edits and recovers`,async()=>{await page.evaluate(()=>document.exitFullscreen());await page.getByRole('button',{name:/Толық экранды қосып/}).waitFor();assert.equal(await page.getByRole('radio').count(),0);await activate(camera)})
 await test(`camera=${camera}: screen loss blocks edits and recovers`,async()=>{await page.evaluate(()=>{for(const t of window.e2eStreams.screen.getTracks()){t.stop();t.dispatchEvent(new Event('ended'))}});await page.getByRole('button',{name:/Бүкіл экранды бөлісу/}).waitFor();assert.equal(await page.getByRole('radio').count(),0);await activate(camera)})
 if(camera)await test('Required camera loss blocks and recovers',async()=>{await page.evaluate(()=>{for(const t of window.e2eStreams.camera.getTracks()){t.stop();t.dispatchEvent(new Event('ended'))}});await page.getByRole('button',{name:/Камераны/}).waitFor();assert.equal(await page.getByRole('radio').count(),0);await activate(camera)})
 await test(`camera=${camera}: fresh context/login blocks original attack`,async()=>{await context.close();if(!camera){await browser.close();browser=await chromium.launch({executablePath:process.env.E2E_CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--auto-select-desktop-capture-source=Entire screen','--enable-usermedia-screen-capturing']})}await setupPage();await page.goto('http://localhost:3101/ent-trial/'+aid);await page.getByRole('heading',{name:'Assessment full fixture',exact:true}).waitFor();assert.equal(await page.getByRole('radio').count(),0);await page.screenshot({path:`${output}/fresh-session-camera-${camera}.png`,fullPage:true});await activate(camera)})
 await test(`camera=${camera}: normal submission`,async()=>{page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Тестті аяқтау',exact:true}).click();await page.waitForURL('**/result');const saved=await(await transport.get(path,{headers:sh})).json();assert.equal(saved.status,'submitted');assert.equal(saved.scores.total,1);assert.equal(saved.deadline_at,original.deadline_at)})
 await context.close()
 }
 const after=await(await transport.get(`/ent-trial/admin/attempts/${meta.attemptId}/review`,{headers:ah})).json();assert.deepEqual(after,before);results.push({name:'Previously completed assessment review unchanged',status:'PASS'});fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2))
 }finally{await browser.close();await transport.dispose();process.exitCode=results.some(r=>r.status==='FAIL')?1:0;console.log(JSON.stringify({passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length}))}
})()
