// BUG-001 browser regression. Only runs against the disposable 3101/8101 stack.
// PLAYWRIGHT_MODULE and E2E_CREDENTIALS_FILE may point to existing local tooling/fixtures.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const output = process.env.E2E_OUTPUT || '/tmp/fenomen-bug001'
fs.mkdirSync(output, {recursive:true})
const credentials = JSON.parse(fs.readFileSync(process.env.E2E_CREDENTIALS_FILE, 'utf8'))
const names = ['Synthetic Folder','Қысқа','Күрделі тақырыптарды жүйелі түрде қайталау және бекіту бөлімі','Раздел для повторения сложных тем и самостоятельной подготовки','Long English folder title for revision and independent learning','Тест']
const results=[]
;(async()=>{
 const browser=await chromium.launch({executablePath:process.env.E2E_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true})
 try {
 const page=await browser.newPage({viewport:{width:1440,height:900}})
 page.setDefaultTimeout(10000)
 await page.goto('http://localhost:3101/login')
 await page.getByRole('textbox',{name:'Электрондық пошта',exact:true}).fill(credentials.email)
 await page.getByRole('textbox',{name:'Құпиясөз',exact:true}).fill(credentials.password)
 await page.getByRole('button',{name:'Жүйеге кіру',exact:true}).click()
 await page.waitForURL('**/dashboard')
 const token=await page.evaluate(()=>sessionStorage.getItem('lms_token'))
 async function api(path,data,method){const r=await page.request.fetch('http://localhost:8101'+path,{method:method|| (data?'POST':'GET'),headers:{Authorization:'Bearer '+token},...(data?{data}:{})});assert(r.ok(),`${path}: ${r.status()}`);return r.json()}
 const course=await api('/courses',{title:'BUG-001 responsive fixture '+Date.now(),is_published:true,ent_subject:'informatics'})
 const sections=[]
 for(const title of names)sections.push(await api(`/courses/${course.id}/sections`,{title}))
 const item=await api(`/courses/${course.id}/items`,{type:'lesson',title:'Regression material',is_visible:true,section_id:sections[0].id})
 await page.goto(`http://localhost:3101/courses/${course.id}`)
 await page.getByRole('button',{name:`${names[0]}: бөлім әрекеттері`,exact:true}).waitFor()
 for(const [width,height] of [[375,812],[390,844],[768,1024],[1366,768],[1440,900]]){
  await page.setViewportSize({width,height})
  for(const section of sections){
   const toggle=page.locator(`button[aria-controls="course-${course.id}-section-${section.id}"]`)
   await toggle.scrollIntoViewIfNeeded()
   const title=toggle.locator('span').first()
   const actions=toggle.locator('..').locator(':scope > div')
   const titleBox=await title.boundingBox(), toggleBox=await toggle.boundingBox(), actionBox=await actions.boundingBox()
   assert(titleBox.width> (width<640?140:80),`Title squeezed: ${width}: ${section.title}`)
   assert(titleBox.height<160,`Vertical letter column: ${width}: ${section.title}`)
   if(width<640)assert(actionBox.y>=toggleBox.y+toggleBox.height-1,'Controls overlap title row')
   else assert(actionBox.x>=toggleBox.x+toggleBox.width-1,'Desktop actions moved out of row')
   await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.click()
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Page overflow')
  await page.screenshot({path:`${output}/course-${width}x${height}.png`,fullPage:true})
  results.push({name:`Six names, empty/nonempty, collapse, layout ${width}x${height}`,status:'PASS'})
 }
 await page.setViewportSize({width:390,height:844})
 // Exercise the same controls now placed on the separate mobile row.
 await page.getByRole('button',{name:'Бөлім қосу',exact:true}).click()
 await page.getByRole('dialog').getByRole('textbox').fill('Temporary regression section')
 await page.getByRole('dialog').getByRole('button',{name:'Сақтау',exact:true}).click()
 const tempActions=()=>page.getByRole('button',{name:'Temporary regression section: бөлім әрекеттері',exact:true})
 await tempActions().click();await page.getByText('Атауын өзгерту',{exact:true}).click()
 await page.getByRole('dialog').getByRole('textbox').fill('Renamed regression section')
 await page.getByRole('dialog').getByRole('button',{name:'Сақтау',exact:true}).click()
 await page.getByRole('button',{name:'Renamed regression section: бөлім әрекеттері',exact:true}).click()
 await page.getByText('Бөлімді өшіру',{exact:true}).click()
 await page.getByRole('button',{name:'Renamed regression section: бөлім әрекеттері',exact:true}).waitFor({state:'detached'})
 results.push({name:'Mobile section creation, rename, empty deletion',status:'PASS'})
 const toggle=page.locator(`button[aria-controls="course-${course.id}-section-${sections[0].id}"]`)
 await toggle.click()
 await page.getByRole('button',{name:'«Regression material» әрекеттері',exact:true}).click()
 await page.getByText('Басқа бөлімге көшіру',{exact:true}).click()
 await page.getByRole('dialog').getByRole('combobox').selectOption(String(sections[1].id))
 await page.getByRole('dialog').getByRole('button',{name:'Көшіру',exact:true}).click()
 await page.getByRole('dialog').waitFor({state:'detached'})
 const fresh=await api(`/courses/${course.id}`)
 assert.equal(fresh.items.find(i=>i.id===item.id).section_id,sections[1].id)
 results.push({name:'Mobile material move preserves organization',status:'PASS'})
 await page.getByRole('button',{name:`${names[0]}: төмен жылжыту`,exact:true}).click()
 await page.waitForTimeout(300)
 let ordered=(await api(`/courses/${course.id}`)).sections
 assert.equal(ordered[1].id,sections[0].id)
 await page.getByRole('button',{name:`${names[0]}: жоғары жылжыту`,exact:true}).click()
 await page.waitForTimeout(300)
 ordered=(await api(`/courses/${course.id}`)).sections
 assert.equal(ordered[0].id,sections[0].id)
 await page.getByRole('button',{name:`${names[0]}: элемент қосу`,exact:true}).click()
 assert.equal(await page.getByRole('dialog').getByRole('combobox',{name:'Бөлім',exact:true}).inputValue(),String(sections[0].id))
 await page.getByRole('dialog').getByRole('button',{name:'Жабу',exact:true}).click()
 results.push({name:'Mobile section reorder and contextual add controls',status:'PASS'})
 // Synthetic student fixture: read-only folder presentation, no management controls.
 const student=await api('/admin/users',{email:`bug001-${Date.now()}@e2e.example.com`,full_name:'Synthetic readonly student',role:'student'})
 await api(`/admin/courses/${course.id}/students`,{student_id:student.id})
 await api(`/courses/items/${item.id}/access`,{group_ids:[],student_ids:[student.id]},'PUT')
 const login=await page.request.post('http://localhost:8101/auth/login',{data:{email:student.email,password:student.temporary_password}})
 const initial=(await login.json()).token
 const pass=crypto.randomBytes(24).toString('base64url')
 const setup=await page.request.post('http://localhost:8101/auth/setup-password',{headers:{Authorization:'Bearer '+initial},data:{new_password:pass,confirmation:pass}})
 assert(setup.ok());const studentToken=(await setup.json()).token
 const context=await browser.newContext({viewport:{width:375,height:812}})
 await context.addInitScript(token=>sessionStorage.setItem('lms_token',token),studentToken)
 const readonly=await context.newPage();await readonly.goto(`http://localhost:3101/courses/${course.id}`)
 await readonly.locator(`button[aria-controls="course-${course.id}-section-${sections[1].id}"]`).waitFor()
 assert.equal(await readonly.getByRole('button',{name:'Бөлім қосу',exact:true}).count(),0)
 assert.equal(await readonly.getByRole('button',{name:/бөлім әрекеттері/}).count(),0)
 assert(await readonly.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
 await readonly.screenshot({path:`${output}/student-375x812.png`,fullPage:true})
 results.push({name:'Student readonly folders at 375px',status:'PASS'})
 } catch(error){results.push({name:'Regression execution',status:'FAIL',error:error.message});process.exitCode=1}
 finally {fs.writeFileSync(output+'/results.json',JSON.stringify(results,null,2));await browser.close();console.log(JSON.stringify(results))}
})()
